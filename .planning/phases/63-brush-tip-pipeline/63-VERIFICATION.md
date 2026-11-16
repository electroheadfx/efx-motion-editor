---
phase: 63-brush-tip-pipeline
verified: 2026-11-16T10:20:07Z
status: passed
score: 40/42 must-haves verified
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
  - .planning/phases/63-brush-tip-pipeline/63-10-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-10-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-11-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-11-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-12-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-12-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-13-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-13-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-14-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-14-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-15-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-15-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-16-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-16-SUMMARY.md
  - app/src-tauri/src/commands/efx_paint_media.rs
  - app/src-tauri/src/commands/project.rs
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/models/project.rs
  - app/src-tauri/src/services/efx_paint_media.rs
  - app/src-tauri/src/services/frame_codec.rs
  - app/src-tauri/src/services/project_io.rs
  - app/src-tauri/tests/physic_paint_cache_publication.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleFootprint.test.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.ts
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/engine/aquarelleTextureParity.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/view/BrushesDocker.tsx
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
  - app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts
  - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/watercolorMaskChip.test.ts
  - app/src/components/physic-paint/view/watercolorMaskChip.ts
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
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
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
  - packages/efx-watercolor/src/payload/codec.test.ts
  - packages/efx-watercolor/src/payload/codec.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/brushBridge.test.ts
  - packages/efx-watercolor/src/playground/brushBridge.ts
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/engineTipIdentity.test.ts
  - packages/efx-watercolor/src/playground/index.ts
covered_digest: "v4:sha256:47d2b145b461ba1ff481c09159484b77794c18542c02408940477a42ac36d702"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 29/30
  gaps_closed:
    - "CR-02 — a refused restore now latches the binding; every routine save and flush is withheld before `deps.write`, including the exact destructive shape (one stroke after the refusal makes the payload non-empty). The unread authoritative `<trackId>-v1.snap` survives first open intact. Pinned by 9 CR-02 tests."
    - "WR-12 — a valid SNP1 v5 container whose inner AQTL body is v1/v2 is refused with the dedicated `aqtl-retired` code and a named notice exactly once per binding; corrupt bodies keep the generic report; container v1-4 keep `snap-v4-retired`."
    - "CR-01 (close half) — the Studio close now refuses once with the withheld-save notice and keeps the window open instead of destroying the realm silently; the live close sequence remains behavior-unverified (human item 2)."
    - "WR-13 — only the whole-track clear acknowledges the refused restore; partial purges (single frame, rail subset, raster settle) neither bypass nor clear the latch."
    - "WR-01 — retirement classification is narrowed to AQTL v1/v2 only; every other unsupported version keeps the generic `watercolor` diagnosis."
    - "WR-02 — the durable-base scope set is built from the post-foreign-filter anchors, with an explicit foreign-key rejection on the session-base loop."
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-08 — the 16 MB cap bounds each stored-asset read but the number of reads per batch is unbounded; a crafted .mce whose brushPack.entries lists many distinct ids pointing at one maximal asset forces one full read and roughly 21 MB of base64 per entry in the main realm."
    category: security
    reason: "Carried-forward new-scope hardening finding. No must-have truth or prohibition requires a batch entry-count bound, every individual file respects the verified per-asset cap, and no failing test or reproducible artifact was supplied. Suggested fix: cap batch entries (e.g. 4096) in read_brush_assets and loadProjectBrushSet, and dedupe identical relativePath values."
    evidence_status: "none provided"
  - finding: "WR-09 — catalog pushes carry no ordering token; two overlapping fire-and-forget publishes can apply out of order in the Studio realm."
    category: architectural
    reason: "Carried-forward new-scope finding; the verified truths cover replace-only sequential delivery, not concurrent-publish ordering, and no deterministic evidence was provided. Suggested fix: a monotonic revision validated by the wire guard plus a last-applied-revision drop rule."
    evidence_status: "none provided"
  - finding: "WR-10 — the WR-03 save gate classifies custom ids by the 'wc/custom-' prefix, so a non-prefixed id can paint a tip whose mask is not carried into a later saved script."
    category: other
    reason: "Carried-forward new-scope finding; the approved 63-11 contract scoped the gate to wc/custom-* ids and every id this app mints carries that prefix, so no must-have fails for app-produced data. Suggested fix: classify by this realm's registry membership and add a non-prefixed-id pin."
    evidence_status: "none provided"
behavior_unverified_items:
  - truth: "SC5 — a script saved from a textured project paints that texture in a project that never imported it (the recording-side carrier is verified; the painted result is not)."
    test: "From a textured project, Save Script (and Copy), then apply it in a project that never imported the tip and Play in motion, static, reveal-tail and reveal-run."
    expected: "Every stroke paints its own recorded tip — no neutral round fallback — and the saved document carries each stroke's textureId through AQTL v3."
    why_human: "Vitest stubs the native mask-decode seam and never runs the watercolor wash. The AQTL v3 carrier chain is behaviorally pinned, but the rendered footprint in a foreign project is a live-behaviour claim; 63-UAT.md row 5 remains `issue`."
  - truth: "CR-01 close half — closing the Studio while a latched binding holds withheld content refuses the close and shows the notice instead of destroying the window."
    test: "With a latched (refused-restore) track holding at least one painted stroke, close the Studio window; then close it a second time."
    expected: "The first close keeps the window open and re-reports the withheld-save notice; no routine snapshot write occurs; the second close is the user's explicit choice and proceeds."
    why_human: "The close sequence runs inside the Tauri parent bridge (`preventDefault()` → flush → `appWindow.destroy()`), which vitest cannot exercise; the only automated pin is a source scan proving `hasWithheldContent()` is in the close pending gate."
human_verification:
  - test: "G-63-5 live retest — from a textured project, Save Script and Copy, then apply in a project that never imported the tip and Play in motion, static, reveal-tail and reveal-run."
    expected: "Every stroke paints its own recorded tip — no neutral round fallback — and the saved document carries each stroke's textureId (AQTL v3)."
    why_human: "Vitest stubs the native mask-decode seam and never runs the watercolor wash; the carrier chain is unit-pinned but the rendered footprint in a foreign project is a live-behaviour claim. 63-UAT.md row 5 remains `issue`."
  - test: "CR-01 close refusal — with a latched track holding at least one painted stroke, close the Studio window, then close it again."
    expected: "First close stays open with the withheld-save notice and performs no routine snapshot write; second close proceeds."
    why_human: "The close runs in the Tauri parent bridge; no test invokes the real close sequence. The only pin is a source-scan assertion on the close pending gate."
---

# Phase 63: Brush Tip Pipeline Verification Report

**Phase Goal:** An imported PNG or JPG becomes the actual brush tip — a real 192×192 mask that travels inside the `.mce`, rebuilds on open, and paints the same footprint live, baked and replayed, with three textured tips available on every install.
**Verified:** 2026-11-16T10:20:07Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (63-16: CR-02/WR-12) and review remediation (63-17, 63-18: CR-01/WR-01/WR-02/WR-13)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---| ----- | ------ | -------- |
| 1 | SC1 — An imported translucent/grayscale PNG/JPG changes the stroke footprint through the pinned two-branch derivation; caps hold; a corrupt file is refused with a named reason and no crash | ✓ VERIFIED | `deriveMask.ts` two-branch law; `importTip.ts` 64 MB/64 MP caps; `efxPaintBrushImport.test.ts`; `resolveStrokeBrush` → `mask ?? base.tip` (quick-oh9). UAT row 1 pass |
| 2 | SC2 — A stroke with an imported tip survives save → quit → relaunch → open and replays from the `.mce` alone; source-image changes are a no-op; a fresh-profile copy reproduces identical bytes | ✓ VERIFIED (mechanism) | `brushPack` root + `brushes/<sha256>.webp`; Rust round-trip and fresh-profile-copy tests; no re-encode path. UAT row 3 pass |
| 3 | SC3 — A fresh install lists and paints three textured tips (Bristle fan, Chalk grain, Sponge), app-owned and never written into a project | ✓ VERIFIED | `builtinTips.test.ts` (ids/labels/36,864-byte frozen masks); `builtinBake.test.ts`; `project_io` never provisions `brushes/`. UAT row 4 pass |
| 4 | SC4 — A missing/corrupt/wrong-size stored mask degrades to an unavailable tip with the neutral fallback and exactly one aggregate warning; close/New Project resets with no ghost mask | ✓ VERIFIED | `efxPaintBrushSet.ts` per-entry reasons; `WatercolorBrushLibrary.tsx` aggregate line; `resetAquarelleBrushState()`. UAT row 2 pass |
| 5 | SC5 — A script saved with an imported tip paints that texture in a project that never imported it | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Carrier pinned end to end (`aquarelleRecordState.reopenTexture.test.ts`, 4 play-routing pins), but no test renders the wash; UAT test 5 remains `issue` — see Human Verification 1 |
| 6 | SC5 — Opening a project replaces the tip catalog and mask registry with that project's entries plus the three built-ins | ✓ VERIFIED | `applyProjectBrushSet` replace-only; `projectStore.efxPaintCutover.test.ts`; `aquarelleBrushCatalog.test.ts`. UAT row 6 pass |
| 7 | Alpha branch: alpha wins whenever any pixel alpha < 250; the mask is the alpha channel verbatim | ✓ VERIFIED | `deriveMask.ts` + `deriveMask.test.ts` |
| 8 | Luminance branch only when every alpha ≥ 250; invert when mean luminance ≥ 128; Rec.709 coefficients | ✓ VERIFIED | `deriveMask.ts` header + both-branch tests |
| 9 | A registered mask becomes the live/bake brush's `tipData` at `tipSize` 192; the eight override multipliers still apply | ✓ VERIFIED (superseded by quick-oh9) | `resolveStrokeBrush` replaces only the footprint (`mask ?? base.tip`); `buildBrushForStroke` multipliers pinned in `brushBridge.test.ts`/`engineTipIdentity.test.ts` |
| 10 | A mask-backed brush's `tipMean` is exactly `max(0.01, mean/255)` | ✓ VERIFIED | `brushes.ts`; formula pins; `buildBrush` unchanged |
| 11 | Reset leaves no ghost and every registry mutation advances `maskGeneration` | ✓ VERIFIED | `maskRegistry.test.ts`; caches keyed on `maskGeneration()` |
| 12 | 36,864-byte mask ⇄ lossless WebP byte-identical; SHA-256 filename; digest and header-dimension refusals; `frames/` lock unchanged | ✓ VERIFIED | Rust brush tests incl. round trip, stem mismatch, header refusal, over-cap; `bound_guard` 2/2 |
| 13 | A whole brush set reads in one native call with per-entry reasons, never a throw for one bad entry | ✓ VERIFIED | `efxPaintBrushSet.ts` one batch + `unavailableTipIds`; suite |
| 14 | Three compile-time masks of exactly 36,864 bytes decoded once; the bake uses the same derivation; reset restores them | ✓ VERIFIED | `builtinTipMasks.generated.ts`, `builtinTips.ts`, `builtinBake.test.ts` |
| 15 | `.mce` root `brushPack` declared in both TS and Rust under the field-diff pin; entries carry refs only; inline masks refused; no-import project omits the key | ✓ VERIFIED | `mceFieldContract.test.ts`; `pack.ts`; `models/project.rs` round-trip; `pack.test.ts` |
| 16 | Catalog store replace-only, composes built-ins; untouched save writes nothing; save copies stored bytes and never re-encodes | ✓ VERIFIED | `applyProjectBrushSet`/`replaceCustomBrushTips`; `aquarelleBrushCatalog.test.ts`; `pendingBrushAssets` |
| 17 | Import decodes once, enforces 64 MB/64 MP, refuses a corrupt PNG header, mints distinct ids with content dedupe, registers/lists/marks dirty with no undo entry | ✓ VERIFIED | `importTip.ts`, `efxPaintBrushImport.ts` + suites |
| 18 | The main realm alone mutates on import and answers with the entry; the Studio consumer updates its realm; the mount pull survives a Studio re-boot | ✓ VERIFIED | Caught publish port, total `applyRequest`/`emitResult`, non-fatal handler publish; bridge/import pins; mount pull |
| 19 | The library surface offers the presets plus the texture strip and imported tips; thumbnails keyed on id + mask generation; one aggregate warning | ✓ VERIFIED (superseded by quick-oh9) | One Brushes section over `BRUSH_PRESETS` with `WatercolorTextureStrip`; UAT row 2 pass on this tree |
| 20 | Open reads one batch before any mutation; registration after close/reset and before hydrate; a failed tip degrades alone; project B replaces A; a superseded open never applies | ✓ VERIFIED | `projectStore.ts` ordering; cutover/catalog tests |
| 21 | Script carrier (mask): inline base64 WebP only; prefix/canonical/cap/192×192 validated pre-decode; load registers registry-only; save reads the Studio realm's cache | ✓ VERIFIED | `physicsPaintRotoScriptSchema.ts` + carrier suites; no catalog row on load |
| 22 | Wire guards refuse malformed catalog/import payloads and never throw | ✓ VERIFIED | Total `decodeBase64OrNull`; totality pins inside `not.toThrow()` |
| 23 | A fresh-profile directory copy reproduces brush assets byte for byte; `create_project_dir` never creates `brushes/` | ✓ VERIFIED | Rust copy test; `project_io` tests |
| 24 | AQTL v3 writes `engine.textureId` presence-prefixed after the vector block and before `pointCount`; absence stays absent | ✓ VERIFIED | `scriptTimelineCodec.ts` version 3, encode/decode layout pins (95 B minimal, 3747 B fixture) |
| 25 | The full G-63-5 chain keeps each stroke's own `textureId`: record → SNP1 → decode → restore → Save capture; second cycle byte-identical | ✓ VERIFIED | `aquarelleRecordState.reopenTexture.test.ts` (6 tests) through the real seam |
| 26 | A lift stroke never carries a texture in the carrier or after restore; no codec lift policy | ✓ VERIFIED | Single enforcement at `toStudioStroke.ts:207`; pin; codec grep |
| 27 | An id the registry cannot resolve travels verbatim and degrades fail-closed only at the live bind | ✓ VERIFIED | "carries an unknown id verbatim…"; `resolveStrokeBrush` returns `textureId: null` |
| 28 | A built-in texture id survives the same chain with no project imports and binds live | ✓ VERIFIED | "carries a built-in id with no imports…" (`wc/builtin-chalk`) |
| 29 | Motion, static, reveal-tail and reveal-run each hand the bake port the recorded stroke's own `textureId`; the bake reader consumes it unchanged | ✓ VERIFIED | Four carrier pins; transport; `engineAdapter.ts` nulls lift only |
| 30 | AQTL v3 is the ONE accepted version; v1/v2 refuse whole with no migration reader; SNP1 stays v5 | ✓ VERIFIED (as designed) | Single equality gate; tests refuse v1/v2; no legacy branch. The destructive consequence of the refusal is closed by truth 31 |
| 31 | CR-02 — after a refused restore, EVERY routine save/flush of that binding is withheld before `deps.write`, including the one-stroke destructive shape | ✓ VERIFIED | `refusedRestore` set on both refusal arms (`studioScriptSnapshotController.ts:777,791`); `prepareSave` gate at `:934-946` returns null before encode/write; tests "withholds saveNow and flushNow after a refused read with a non-empty session" (`studioScriptSnapshotController.test.ts:1011`), "the debounced drain writes nothing while latched" (`:1051`), "withholds the decode-refused arm too" (`:1072`); every pin asserts `write` is never called |
| 32 | CR-02 — the latch is per binding: repeated saves stay withheld; bind/reset clears; a successful restore clears; `missing` leaves it untouched | ✓ VERIFIED | `bind` clears (`:739-740`); success clears (`:846-847`); `reset` clears (`:1182-1183`); missing does not latch. Tests `:1033` (repeated saves), `:1104` (missing never latches), `:1168` (rebind whose restore succeeds saves) |
| 33 | CR-02 — the explicit purge is the only acknowledgement; it clears the latch only after a SUCCESSFUL write; a failed purge write leaves it set | ✓ VERIFIED | `commitSave` clears only in the successful `sessionOnly` arm (`:979-985`); `persistAfterPurge` forwards the acknowledgement (`:1079-1092`); tests `:1117` (purge writes once, clears, routine saves resume) and `:1140` (failed purge leaves the latch set) |
| 34 | CR-02 — a successful restore never latches; a missing snapshot never latches; a healthy binding's routine saves are unchanged | ✓ VERIFIED | Same tests `:1011/:1104/:1168`; healthy-save shape covered by the pre-existing suites re-run green |
| 35 | WR-12 — a valid SNP1 v5 with an inner AQTL v1/v2 body refuses with `aqtl-retired` and a named notice exactly once per binding; corrupt bodies stay generic; container v1-4 keep `snap-v4-retired` | ✓ VERIFIED | `studioScriptSnapshotCodec.ts:627-638` inspects the inner code and `fail('aqtl-retired', …)` only for v1/v2; controller tests `:519` (exactly one named notice per binding), `:546` (corrupt body keeps generic), `:558` (refusal latches); codec test `:388` |
| 36 | Clean break preserved — no AQTL v1/v2 reader, upgrade path or legacy decode branch; retirement is named, never migrated | ✓ VERIFIED | `scriptTimelineCodec.ts` version gate is the only version comparison; the codec only inspects the version word for the notice; no migration write exists |
| 37 | Seam preserved — Rust service, Tauri command and IPC adapter untouched; a latched generation never reaches `ipcStudioScriptSnapshotWrite`/`write_snapshot_at`, so no backup file and the atomic-replace law stand | ✓ VERIFIED | `git diff 13a80e34f..HEAD` over `app/src-tauri`, `app/src/lib/ipc.ts`, `app/src/types/project.ts`, `packages` is empty; each CR-02 pin asserts the write port is never invoked |
| 38 | CR-01 — a withheld save discloses the pause once per latch episode, after the empty-payload guard, never as a save failure | ✓ VERIFIED | Gate at `studioScriptSnapshotController.ts:934-946` reports `STUDIO_SCRIPT_SNAPSHOT_SAVE_WITHHELD_MESSAGE` once; tests `:1232` (reports once after the restore notice), `:1248` (once per episode, not per save), `:1307` (`hasWithheldContent` true only while latched AND holding content) |
| 39 | WR-01 — retirement is narrowed to AQTL v1/v2 only; v0/v4/v7 and a bit-flipped version keep the generic `watercolor` diagnosis | ✓ VERIFIED | Version word read at `studioScriptSnapshotCodec.ts:633-635`; v1/v2 → `aqtl-retired` at `:636-638`; boundary pinned in `studioScriptSnapshotCodec.test.ts:388` |
| 40 | WR-02 — a foreign track's session durable base can no longer be written under this track's snapshot | ✓ VERIFIED | `foreignIds` built from other tracks (`:503-508`); scope set from post-filter anchors (`:548-553`); explicit rejection on session bases (`:575`); tests `:1893` (drops a retained base owned by another track) and `:1915` (drops a SESSION base, WR-02). Null-live-map variant untested (IN-12) — code is fail-closed |
| 41 | CR-01 close half — closing the Studio while a latched binding holds withheld content refuses the close once, reports the notice, and keeps the window open; the second close proceeds | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Wired: `hasWithheldContent()` in the close pending gate (`PhysicsPaintStudio.tsx:4198`), one refusal via `closeWithheldAcknowledgedRef` + `reportSaveWithheld()` + throw (`:4221-4227`), and `runStudioFlush` rethrows so the bridge's catch skips `destroy()`. Only a source-scan pin exists (`PhysicsPaintStudio.test.ts:4024-4026`); no test invokes the real close sequence — see Human Verification 2 |
| 42 | WR-13 — only the whole-track clear acknowledges the unread snapshot; partial purges (single frame, rail subset, raster settle) neither bypass nor clear the latch | ✓ VERIFIED | Partial call sites pass no acknowledgement (`PhysicsPaintStudio.tsx:7490,7500,7511`); `clearMemoryRailScripts` is the only production caller with `{ acknowledgeRefusedRestore: true }` (`:7520`); controller test `:1333` ("a partial purge neither bypasses nor clears the latch") |

**Score:** 40/42 truths verified (2 present, behavior-unverified)

**Prohibitions:** the 29 prohibitions from plans 63-01..63-15 remain verified (unchanged code; suites re-run green). Of 63-16's six: P1 (no AQTL v1/v2 reader/upgrade path) verified — the version gate is the only comparison and no migration branch exists; P2 (no Rust/Tauri/IPC/manifest/filename change) verified — `git diff 13a80e34f..HEAD` for those paths is empty, and protection is by NOT WRITING; P3 (controller purity) verified — `grep -c 'PhysicsPaintStudio\|useEffect\|useSignal\|useState\|useMemo'` = 0, `grep -c '^import .*@preact'` = 1; P5 (latch never set by missing, never cleared by routine save/failed write/report) verified by tests `:1104/:1140/:1033`; P6 (retirement notice once per binding) verified by test `:519`. **P4 is intentionally superseded:** 63-16 forbade a new save option, but the WR-13 remediation (63-18) adds `acknowledgeRefusedRestore?: boolean` to `StudioScriptSnapshotSaveOptions` (`:242`) — the explicit, non-dead acknowledgement WR-13 requires, with exactly one production caller (`PhysicsPaintStudio.tsx:7520`, the whole-track clear only) and the gate still requiring `sessionOnly`. This is a deliberate contract change by the later gap-closure plan, not an unreviewed violation; recorded as ℹ️ INFO below.

### UAT Evidence Carried (63-UAT.md, 2026-11-15)

| UAT row | Result | Note |
| ------- | ------ | ---- |
| 1. Studio import round trip | pass | Live, post-quick-oh9 tree |
| 2. Library surface and degraded tip | pass | One-section model + texture strip |
| 3. Persistence UAT | pass | Save/quit/reopen + source-image changes + fresh-profile copy |
| 4. Fresh-install built-ins | pass | Three textured tips on a clean project |
| 5. Roto script carrier | issue (major) | Carrier fixed by 63-15 and re-pinned; row stays `issue` — live retest is human item 1 |
| 6. Project scoping | pass | Replace/reset in the live UI |

### Gap Closure (previous report → current tree)

| Previous gap / item | Closure evidence in code |
| ------------------- | ------------------------ |
| CR-02 — the refused restore let the next routine save overwrite the unread authoritative `.snap` | `refusedRestore` latched on both refusal arms; `prepareSave` returns null before encode/`deps.write`; clears only on bind/reset, successful restore, or a successful acknowledged purge. Nine CR-02 tests including the one-stroke shape, the debounced drain, the per-binding lifecycle, and the failed-purge case. No Rust/IPC change — the write is simply never issued |
| WR-12 — a deliberate retirement reported as corruption | `aqtl-retired` code for inner AQTL v1/v2 only; named notice once per binding; corrupt bodies stay `watercolor`; container v1-4 keep `snap-v4-retired` |
| CR-01 disclosure half | Once-per-episode notice after the empty guard; tests `:1232/:1248` |
| CR-01 close half (re-review critical) | Close gate includes `hasWithheldContent()`; one refusal with a named notice, window stays open; bridge catch skips `destroy()`. Source-pinned, live behavior unverified |
| WR-13 (re-review warning) | Only the whole-track clear acknowledges; partial purges keep the latch and the unread file |
| WR-01 (re-review warning) | Retirement narrowed to v1/v2; boundary pinned |
| WR-02 (re-review warning) | Post-foreign-filter scope set + explicit session-base rejection |
| Prior closures CR-01/CR-03..CR-07, WR-01..WR-07 | Remain closed; their pins live in the suites re-run green below |

### Deferred Items

None. Phase 64 (Medium Engine, MED-01..18) is the only later roadmap phase and does not cover any brush-pipeline or snapshot finding.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
| - | ------- | -------- | ------------ |
| 1 | WR-08 — per-asset read cap holds, but the batch entry count is unbounded | security | New-scope; no must-have requires a batch-count bound; no failing test or artifact supplied. Suggested fix: cap the batch count and dedupe identical `relativePath` values |
| 2 | WR-09 — catalog pushes carry no ordering token; overlapping publishes can apply out of order | architectural | New-scope; sequential replace-only delivery is verified, concurrent-publish ordering is not; no deterministic evidence. Suggested fix: monotonic revision + last-applied-revision drop rule |
| 3 | WR-10 — the save gate classifies custom ids by the `wc/custom-` prefix | other | New-scope; the approved 63-11 contract scoped the gate to that prefix and every app-minted id carries it; no must-have fails for app-produced data. Suggested fix: registry-membership classification + a non-prefixed-id pin |

These remain `open` in `63-REVIEW-DISPOSITION.md`; they do not regress any verified truth or prohibition.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | Restore/save/authority controller with the refused-restore latch | ✓ VERIFIED | Substantive and wired; latch gates the write seam; disclosure and purge acknowledgement implemented (`:687-1183`) |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | SNP1 v5 container; AQTL v3; named retirement for inner v1/v2 | ✓ VERIFIED | `aqtl-retired` classification at `:627-638`; container versions 1-4 unchanged |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Close refusal + purge acknowledgement wiring | ✓ VERIFIED (close behavior unverified) | Gate at `:4198`, refusal step at `:4221-4227`, single ack call site at `:7520` |
| `packages/efx-watercolor/src/brushes/deriveMask.ts` | Two-branch derivation + bake-only normalize | ✓ VERIFIED | Exists, substantive, consumed by import and bake |
| `packages/efx-watercolor/src/brushes/maskRegistry.ts` | Module-level registry, generation, reset-to-builtins | ✓ VERIFIED | Built-in ids reserved; wired by catalog, bridge, thumbnails, footprint |
| `packages/efx-watercolor/src/playground/brushBridge.ts` | The ONE live/bake mapping | ✓ VERIFIED | Response preset + mask footprint; unknown id fails closed |
| `packages/efx-watercolor/src/brushes/builtinTipMasks.generated.ts` | Three base64 compile-time masks | ✓ VERIFIED | Decoded once; 36,864 bytes each |
| `packages/efx-watercolor/src/brushes/builtinTips.ts` | Three frozen tip records + masks | ✓ VERIFIED | Single source of built-in ids/labels |
| `packages/efx-watercolor/src/brushes/pack.ts` | One pack shape authority, carrier modes | ✓ VERIFIED | Total, fail-closed |
| `app/src-tauri/src/services/frame_codec.rs` | Lossless mask encode + header dimension walk | ✓ VERIFIED | Byte-identical round trip; refusal before decode |
| `app/src-tauri/src/services/efx_paint_media.rs` | Bound-path brush branch, digest/stem, batch read | ✓ VERIFIED | 16 MB cap before `fs::read`; 20 brush tests |
| `app/src-tauri/src/commands/efx_paint_media.rs` | Encode/write/decode/batch-read commands | ✓ VERIFIED | Registered in `lib.rs` |
| `app/src-tauri/src/services/project_io.rs` | No `brushes/` provisioning | ✓ VERIFIED | Test asserts absence |
| `app/src/lib/efxPaintPackage.ts` | Fail-closed brush path helpers | ✓ VERIFIED | Mirrors Rust bound shape |
| `app/src/types/project.ts` / `app/src-tauri/src/models/project.rs` | `brushPack` declared both languages | ✓ VERIFIED | Field-diff pin `mceFieldContract.test.ts` |
| `app/src/lib/efxPaintBrushAssets.ts` | Session asset cache + staging list | ✓ VERIFIED | Refuses digest/bytes conflict |
| `app/src/lib/efxPaintBrushSet.ts` | One-batch loader + normalization law | ✓ VERIFIED | `normalizeProjectBrushTip`; built-in refusal |
| `app/src/lib/efxPaintBrushImport.ts` | Main-realm import mutation | ✓ VERIFIED | Registers/lists/dirty/publishes; no undo |
| `packages/efx-watercolor/src/brushes/importTip.ts` | Header sniffing, caps, fresh ids | ✓ VERIFIED | Named failures, never throws |
| `app/src/stores/aquarelleBrushCatalog.ts` | Project-scoped catalog, payload producer/applier | ✓ VERIFIED | Replace-only; per-entry fallback |
| `app/src/types/physicPaint.ts` | Wire guards for the four brush events | ✓ VERIFIED | Total guards |
| `app/src/lib/physicPaintBridge.ts` | Import/catalog transport | ✓ VERIFIED | Caught publish port; total producer/emitter |
| `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` | Studio receiver + mount pull + close refusal catch | ✓ VERIFIED | Calls `applyBrushCatalogPayload`; close catch skips `destroy()` |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | Brushes section, texture strip, import row, one warning | ✓ VERIFIED | Current one-section model; UAT row 2 pass |
| `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` | Texture row + import controls | ✓ VERIFIED | Wired to catalog + import request |
| `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` | Per-tip painted thumbnails | ✓ VERIFIED | Cache keyed `id\|g{maskGeneration}` |
| `app/src/components/physic-paint/engine/aquarelleFootprint.ts` | Mask-aware footprint caching | ✓ VERIFIED | Signature includes mask generation |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` | Script carrier parser/serializer (mask) | ✓ VERIFIED | 512 KB cap; canonical base64; exact 192×192 pre-decode |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` | Save/load legs | ✓ VERIFIED | Per-entry unavailable skip; registry-only load |
| `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` | AQTL v3 with presence-prefixed `textureId` | ✓ VERIFIED | Version 3; append-at-tail layout; no policy |
| `app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts` | End-to-end G-63-5 pin through the real seam | ✓ VERIFIED | 6 tests; byte-identical second cycle |
| `app/src/components/physic-paint/view/BrushesDocker.tsx` | (No mount site; D-02 retires it) | ⚠️ ORPHANED | Dead code with a mask-dropping importer (IN-02); not mounted |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `brushBridge.ts` | `maskRegistry.ts` | `resolveStrokeBrush` resolves the registered mask before the response preset tip | ✓ WIRED | Tested; unknown id fails closed |
| `maskRegistry.ts` | `brushes.ts` | `TIP_SIZE` defines the only legal mask length | ✓ WIRED | `TIP_MASK_BYTES` enforced |
| `commands/efx_paint_media.rs` | `services/efx_paint_media.rs` | Commands route through the bound guard and write transaction | ✓ WIRED | Rust tests |
| `efxPaintPackage.ts` | `efx_paint_media.rs` | `buildBrushAssetRelativePath` mints the shape the parser accepts | ✓ WIRED | `efxPaintPackage.test.ts` |
| `projectStore.ts` | `aquarelleBrushCatalog.ts` | `buildMceProject` emits `buildProjectBrushPack()` at the root | ✓ WIRED | `projectStore.ts` |
| `efxPaintPersistence.ts` | `efxPaintBrushAssets.ts` | `pendingBrushAssets` supplies staged bytes | ✓ WIRED | Save stages stored bytes only |
| `models/project.rs` | `types/project.ts` | Field-diff pin on `MceProject.brushPack` | ✓ WIRED | `mceFieldContract.test.ts` |
| `efxPaintBrushImport.ts` | `aquarelleBrushCatalog.ts` | One mutation adds entry, registers mask, marks dirty | ✓ WIRED | `efxPaintBrushImport.test.ts` |
| `physicPaintBridge.ts` | `efxPaintBrushImport.ts` | Import handler runs in the main realm only | ✓ WIRED | Bridge round-trip; answer totality pinned |
| `usePhysicsPaintParentBridge.ts` | `aquarelleBrushCatalog.ts` | Receiver calls `applyBrushCatalogPayload` in the child realm | ✓ WIRED | Producer emits wire-conforming entries |
| `physicPaintBridge.ts` | `usePhysicsPaintParentBridge.ts` | Triple transport + mount pull | ✓ WIRED | Install pin; pull tested |
| `WatercolorBrushLibrary.tsx` | `physicPaintBridge.ts` | Import row calls `requestPhysicPaintBrushImport` | ✓ WIRED | Library tests |
| `WatercolorBrushLibrary.tsx` / `WatercolorTextureStrip.tsx` | `aquarelleBrushCatalog.ts` | Both mounts read THAT realm's catalog signal | ✓ WIRED | Child-realm signals |
| `watercolorStrokeThumb.ts` | `brushBridge.ts` | Mask-backed thumbnails via the shared builder | ✓ WIRED | Cache/generation tests |
| `projectStore.ts` | `efxPaintBrushSet.ts` | Load before `closeProject`, apply after, before hydrate | ✓ WIRED | Source-order pin |
| `aquarelleBrushCatalog.ts` | `maskRegistry.ts` | `applyProjectBrushSet` replaces the whole registry | ✓ WIRED | Replace-only tests |
| `projectStore.ts` | `aquarelleBrushCatalog.ts` | `closeProject` → `resetAquarelleBrushState()` | ✓ WIRED | `projectStore.ts` |
| `physicsPaintRotoScriptLibrary.ts` | `efxPaintBrushAssets.ts` | Save leg reads the STUDIO realm's stored bytes | ✓ WIRED | Fresh-module test |
| `aquarelleBrushCatalog.ts` | `efxPaintBrushAssets.ts` | Payload remembers each entry's `webpBase64` | ✓ WIRED | `applyBrushCatalogPayload` |
| `physicsPaintRotoScriptLibrary.ts` | `aquarelleBrushCatalog.ts` | Load registers masks without a catalog row; save reads the sync flag/unavailable set | ✓ WIRED | Registry-only test; WR-02/WR-03 pins |
| `project_io.rs` | `efx_paint_media.rs` | Copied package's asset read through the same bound guard | ✓ WIRED | Fresh-profile test |
| `aquarelleRecordState.getAquarelleEventsForFrame` | `scriptTimelineCodec.encodeScriptTimelineBinary` | Recorded stroke's `engine.textureId` written at the AQTL tail | ✓ WIRED | End-to-end test; byte layout pins |
| `scriptTimelineCodec.decodeScriptTimelineBinary` | `restoreAquarelleRecordTimeline` | Decoded engine rebuild adds `textureId` only when present | ✓ WIRED | Same suite; absence pin |
| `physicsPaintRotoPlayScriptController` | bake port | `stored?.textureId` carried on motion/static/reveal-tail/reveal-run | ✓ WIRED | Four carrier pins |
| `engineAdapter.ts` | AQTL payload | Bake reader consumes `payload.textureId`, nulls lift | ✓ WIRED | Reader unchanged since prior verification |
| `studioScriptSnapshotController.prepareSave` | `deps.write` (→ `ipcStudioScriptSnapshotWrite` → `write_snapshot_at`) | The latch returns null BEFORE the write call for a refused binding | ✓ WIRED | Every CR-02 pin asserts the write port is never called; the Rust/IPC seam is byte-identical |
| `studioScriptSnapshotCodec` | `studioScriptSnapshotController` | `corrupt:aqtl-retired` maps to the named retirement notice | ✓ WIRED | Controller tests `:519/:546`; codec test `:388` |
| `studioScriptSnapshotController.persistAfterPurge` | purge acknowledgement gate | `sessionOnly` + `acknowledgeRefusedRestore` required together; single production caller | ✓ WIRED | `PhysicsPaintStudio.tsx:7520`; test `:1333` proves partial purges cannot pass |
| `studioScriptSnapshotController.hasWithheldContent` | Studio close pending gate + refusal step | Close reads the live controller and refuses once | ✓ WIRED (behavior unverified) | Source pin `PhysicsPaintStudio.test.ts:4024-4026`; no test invokes the close sequence |
| `usePhysicsPaintParentBridge` close hook | `appWindow.destroy()` | `destroy()` runs only when the flush resolves; a thrown refusal keeps the window open | ✓ WIRED | Catch at the close hook; behavior unverified end to end |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `WatercolorBrushLibrary.tsx` | `customBrushTips` / built-ins | Real catalog signal filled by `applyProjectBrushSet` + `applyBrushCatalogPayload` | Yes — imported/serialized entries | ✓ FLOWING |
| `watercolorStrokeThumb.ts` / `aquarelleFootprint.ts` | mask bytes | `resolveMask(id)` from the module registry | Yes — real 192×192 bytes | ✓ FLOWING |
| `efxPaintBrushImport.ts` → save staging | stored WebP | Rust encode result → `rememberBrushAsset` → `pendingBrushAssets` → Rust write | Yes — actual encoded bytes | ✓ FLOWING |
| `physicsPaintRotoScriptLibrary.ts` save leg | `webpBase64` / mask data URL | Studio realm's `brushAssetBytes` from the published payload | Yes — real stored bytes; refuses when absent | ✓ FLOWING |
| `efxPaintBrushSet.ts` | masks/assets | Native batch read `efx_paint_read_brush_assets` | Yes — disk bytes; per-entry reasons | ✓ FLOWING |
| `aquarelleRecordState` → AQTL v3 → SNP1 → restore → Save capture | `engine.textureId` | The recorded stroke's own engine field | Yes — no literal in the record/encode/decode path | ✓ FLOWING |
| `physicsPaintRotoPlayScriptController` → bake | `textureId` | `getRecordedAquarellePayload(stroke.mutationId)?.textureId` | Yes — the restored record's value | ✓ FLOWING |
| `brushBridge.resolveStrokeBrush` | `tipData` / `textureId` | `resolveMask(textureId)` | Yes — real registry bytes; unresolved → response tip and `textureId: null` | ✓ FLOWING |
| `restore()` outcome | `refusedRestore` | The codec's refusal code (read refusal / decode failure) | Yes — set from the actual restore result; drives the `prepareSave` gate | ✓ FLOWING (gated) |
| `hasWithheldContent()` | session content presence | `deps.getWatercolorEvents()` / `deps.getDurableBases()` — the live record store | Yes — real session state; `isDirty` deliberately not used | ✓ FLOWING |
| Studio close gate | close refusal | `studioScriptSnapshot.hasWithheldContent()` read at close time | Yes — live controller value at `PhysicsPaintStudio.tsx:4198/:4222` | ✓ FLOWING (behavior unverified) |

No static-return, hardcoded-empty or mock data path was found in the shipped pipeline. The unknown-id → response-tip branch is the declared neutral fallback, not a stub.

### Behavioral Spot-Checks

Run on the current tree (HEAD `bc8c757fc`, fingerprint `v4:sha256:47d2b145…`).

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Changed snapshot/Studio suites (controller + codec + Studio source pins) | `vitest run` on `studioScriptSnapshotController.test.ts`, `studioScriptSnapshotCodec.test.ts`, `PhysicsPaintStudio.test.ts` from `app/` | 3 files passed; 545 passed (32 codec + 84 controller + 429 Studio) | ✓ PASS |
| Full app suite (all files) | `vitest run` (447 files) | 445 files passed \| 2 skipped; 9448 tests passed; exit 0 | ✓ PASS |
| One load-dependent test under parallel load (`physicPaintBridge.test.ts` › "removes its one-shot listener when no receiver answers (bounded wait)") | same file in isolation | 178 passed \| 1 skipped; 1.6 s — passes in isolation; the 20 s timeout in the parallel block is pre-existing load sensitivity, not a phase regression | ✓ PASS (isolated) |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` (`tsc --noEmit`) | exit 0 | ✓ PASS |
| Native brush-asset boundary | `cargo test --manifest-path app/src-tauri/Cargo.toml --lib brush_` | Not re-run this round — the native tree is byte-identical to the prior verification (`git diff 13a80e34f..HEAD` empty for `app/src-tauri`); prior run 20 passed | ✓ PASS (carried) |
| Native mask round-trip / provisioning / bound guard / cache publication | cargo tests | Not re-run this round — same unchanged-native-byte argument; prior runs 16/2/2/39 passed | ✓ PASS (carried) |
| Decision coverage (non-blocking) | `gsd_run check decision-coverage-verify <phaseDir> <CONTEXT>` | total 23, honored 23, `not_honored: []` | ✓ PASS |

The 2 skipped files are the pre-existing native-window-close test (`physicPaintBridge.test.ts`) and the env-gated authoring bake (`builtinBake.test.ts`, `BAKE_BUILTIN_TIPS=1`); the latter's output is independently pinned by `builtinTips.test.ts`.

### Probe Execution

No probe scripts were declared in the phase plans/summaries and none exist under `scripts/*/tests/probe-*.sh`. Step 7c: not applicable (not a migration/CLI phase).

### Requirements Coverage

All 17 phase requirement IDs appear in at least one plan's `requirements:` field — no orphaned requirements; REQUIREMENTS.md maps no additional IDs to Phase 63.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| TIP-01 | 63-05, 63-06, 63-12 | Import changes the stroke footprint to the image's texture | ✓ SATISFIED | Import handler + library + mapping tests; UAT row 1 pass |
| TIP-02 | 63-01, 63-05 | Exactly 192×192 = 36,864 bytes, derived once at import | ✓ SATISFIED | `deriveMask`/`importTip` + suites |
| TIP-03 | 63-01 | One pinned two-branch rule documented in the module header | ✓ SATISFIED | `deriveMask.ts` header + both-branch tests |
| TIP-04 | 63-05 | 64 MP refusal before decode; corrupt PNG header refused without crash | ✓ SATISFIED | `importTip.test.ts`, `efxPaintBrushImport.test.ts` |
| TIP-05 | 63-01, 63-12 | One live/bake mapping; texture replaces only the footprint | ✓ SATISFIED | `brushBridge.test.ts`, `engineTipIdentity.test.ts`; no second mapping |
| TIP-06 | 63-01, 63-05, 63-06 | Registry fed by the import surface; reset leaves no ghost mask | ✓ SATISFIED | `maskRegistry.test.ts`, catalog reset tests |
| TIP-07 | 63-07, 63-11 | Imported tip survives save → quit → relaunch → open from the `.mce` | ✓ SATISFIED (mechanism) | Persistence/open tests; UAT row 3 pass |
| TIP-08 | 63-02, 63-04 | Lossless content-addressed asset, byte-identical decode, never re-encoded, source discarded | ✓ SATISFIED | Rust round-trip/digest tests; staging copy |
| TIP-09 | 63-02, 63-04 | No tip depends on a file outside the package | ✓ SATISFIED | Shape guards on both sides |
| TIP-10 | 63-02, 63-05, 63-06, 63-07 | Caps before read/decode; degraded stored mask → unavailable + one warning, never abort | ✓ SATISFIED | Loader reasons, aggregate warning, per-asset cap tests |
| TIP-11 | 63-04 | `brushPack` root carrier declared in both languages under the field pin | ✓ SATISFIED | `mceFieldContract.test.ts` |
| TIP-12 | 63-07 | Decode/register inside the open await, before first replay; one call; a failing tip never aborts | ✓ SATISFIED | Ordering source pin; batch loader; superseded-open tests |
| TIP-13 | 63-03, 63-06 | Three built-ins on every install, app-owned, never in a project | ✓ SATISFIED | `builtinTips.test.ts`; no built-in ids in packs; UAT row 4 pass |
| TIP-14 | 63-08, 63-11, 63-15, 63-16 | Script carries each stroke's texture tip and paints in a project that lacks it | ✓ SATISFIED (unit); live paint behavior-unverified | Mask carrier suites + AQTL v3 chain + four play routing pins; live paint is human item 1. The snapshot lifecycle carrying that script is now latch-protected (truths 31-37) |
| TIP-15 | 63-04, 63-10 | `buildBrushPackSnapshot` is the one shape authority, total and fail-closed | ✓ SATISFIED | `pack.ts` + `pack.test.ts` |
| TIP-16 | 63-04, 63-09, 63-10 | Untouched save/reopen byte-identical; fresh-profile copy identical | ✓ SATISFIED | Rust copy test; persistence/catalog tests; UAT row 3 pass |
| TIP-17 | 63-07, 63-10 | Opening replaces never appends; A absent in B; close/New resets to three built-ins | ✓ SATISFIED | Replace/reset tests; UAT row 6 pass |

### Anti-Patterns Found

Debt-marker scan: no `TBD`, `FIXME` or `XXX` in any of the six gap-closure files (grep exit 1). No empty-return stubs, no ignored fetch, no placeholder copy in the shipped paths.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` | 529-533 | Legacy-byte fixture inserts at 117 (inside anchor 2's width slot) instead of the anchor-block end at 118 (WR-11) | ⚠️ WARNING | The legacy-branch test passes only because both bytes are 0; a future non-zero anchor width would desynchronize the fixture. Test quality only, no shipped behavior |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | 633-635 | Short-body fallback in the AQTL version read can never be taken (WR-14) | ℹ️ INFO | Impossible-state guard; removal is safe because the inner codec rejects < 24 bytes before raising `unsupported-version` |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | 846-847, 1200 | The "later successful restore" latch release has no production call site; `bind()` already clears the latch (IN-01) | ℹ️ INFO | Public-API seam pin; maintenance judgement, not a defect |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | 548-575 | The explicit foreign-base guard's null-live-map configuration is untested (IN-12) | ℹ️ INFO | The production-relevant non-null-map case is pinned (`:1915`); the guard's unique contribution is fail-closed but unpinned |
| `app/src/components/physic-paint/view/BrushesDocker.tsx` | 88-100, 232-235 | Dead docker with a mask-dropping importer (IN-02) | ℹ️ INFO | Unmounted; a trap if revived |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | 431, 439-441 | Stale codec section comments (IN-03) | ℹ️ INFO | Documentation only |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | 375-381, 389 | Anchor encoder does not bound `mutationId` to `0xffffffff` (IN-10) | ℹ️ INFO | Practically unreachable (engine ledger ids); decoder duplicate check would refuse a truncated file |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | 122-124 | `deps.getIdentity` is declared and supplied but never read (IN-11) | ℹ️ INFO | Dead interface member; `boundIdentity` is the only identity source |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | 242 | 63-16 prohibition P4 (no new save option) superseded by `acknowledgeRefusedRestore` (WR-13 remediation) | ℹ️ INFO | Single live production caller (`PhysicsPaintStudio.tsx:7520`); intent preserved — no dead option; gate still requires `sessionOnly` |
| Carried prior-review rows IN-05..IN-09 (script carrier raw-message failure, wire-guard built-in-id admission, JSON baseline validator, decode-side empty-id pin, ASCII-only fixtures) | — | Unchanged by 63-16..63-18; not re-litigated this round | ℹ️ INFO | Remain `open` in the disposition; no verified truth or prohibition is affected |

**Record-keeping note.** `63-REVIEW-DISPOSITION.md` still marks CR-01, CR-02, WR-01, WR-02 and WR-13 `open` even though the code and tests above close them. This is disposition bookkeeping drift, not a code defect; it does not affect any truth status.

**Test Quality Audit.**
- Disabled tests: the only phase-relevant skip is the env-gated authoring bake (`builtinBake.test.ts`); its output is independently pinned. One unrelated pre-existing skip (native window close).
- RED evidence: every gap-closure task followed RED-before-GREEN — `b4bc2a572` (CR-02 RED) → `2ccecaa52`; `b4cd2f584` (CR-01/WR-01/WR-02 RED) → `4a9890b9c`; `cc598018c` (close refusal + partial purge RED) → `79721434f`.
- Fixture strength: WR-11 and IN-09 weaken specific pins but mask no production defect.
- Circularity: none — the only write inside a test is the intentional authored bake artifact; projectStore tests use `writeFile: vi.fn` mocks for the IPC seam.
- Assertion strength: the CR-02 pins assert absence of the write call and decoded content counts; disclosure pins assert exact message equality and exactly-once counts; the retirement boundary asserts the exact classification per version.
- Harness caveat: vitest collects only `.test.ts`; every verify target is a `.test.ts` file and executed (non-zero counts reported).

### Decision Coverage

`gsd_run check decision-coverage-verify .planning/phases/63-brush-tip-pipeline .planning/phases/63-brush-tip-pipeline/63-CONTEXT.md` (non-blocking): total 23, honored 23, `not_honored: []`. Message: "All trackable CONTEXT.md decisions are honored by shipped artifacts."

### Human Verification Required

#### 1. G-63-5 live retest — Roto script texture portability (63-UAT.md test 5)

**Test:** From a project with an imported textured tip, paint several strokes and Save Script (and Copy). Open a project that never imported that tip, apply the script, and Play in motion, static, reveal-tail and reveal-run.
**Expected:** Every stroke paints its own recorded tip — no neutral round fallback — and the saved document carries each stroke's `textureId`.
**Why human:** Vitest stubs the native mask-decode seam and never runs the watercolor wash. The AQTL v3 carrier chain is behaviorally pinned, but the rendered footprint in a foreign project is a live-behaviour claim; the UAT row remains `issue`.

#### 2. CR-01 close refusal — live Studio close on a latched binding

**Test:** Arrange a refused-restore track (a pre-v3 AQTL snapshot is the natural trigger), paint at least one stroke, and close the Studio window. Then close it a second time.
**Expected:** The first close keeps the window open and shows the withheld-save notice; no routine snapshot write occurs. The second close proceeds (explicit user choice).
**Why human:** The close sequence runs inside the Tauri parent bridge (`preventDefault()` → flush → `appWindow.destroy()`); no test invokes it. The only automated pin is a source scan proving `hasWithheldContent()` is in the close pending gate.

### Gaps Summary

**No gaps. CR-02 is closed and the phase goal is achieved at the automated-evidence level; two behaviour-dependent truths remain for live verification.**

CR-02, the previous report's sole gap, is closed in code on this tree. Both refusal arms set the binding-scoped latch (`studioScriptSnapshotController.ts:777`, `:791`); `prepareSave` returns null at `:934-946` — upstream of `encodeStudioScriptSnapshot` and `deps.write` — so a refused binding's routine saves (debounce, `saveNow`, close `flushNow`, and even the one-stroke non-empty shape) never reach `ipcStudioScriptSnapshotWrite` or Rust's atomic rename. The latch clears only on `bind`/`reset`, a successful restore, or a successful `sessionOnly` purge carrying the explicit `acknowledgeRefusedRestore` acknowledgement; a failed purge leaves it set. Nine CR-02 tests pin the destructive shape, the repeated-save persistence, the debounced drain, the decode-refused arm, the missing-snapshot non-latch, the binding lifecycle, and the failed-purge case. WR-12 is also closed: a pre-v3 AQTL body is named with a dedicated `aqtl-retired` code and a once-per-binding notice, while genuinely corrupt bodies and retired containers keep their existing diagnoses.

The re-review findings that followed are closed as well: CR-01's disclosure fires once per episode after the empty guard, the Studio close refuses once with the notice (source-pinned; live behavior in human item 2), WR-01 narrows retirement to AQTL v1/v2, WR-02 filters foreign durable bases, and WR-13 restricts the latch-clearing purge acknowledgement to the whole-track clear.

Evidence on this tree: the three changed suites run 545/545 green; the full app suite runs 447 files, 9448 tests, 0 failures; the one timeout observed in a smaller parallel block (`physicPaintBridge.test.ts` one-shot listener) is pre-existing load sensitivity and passes in isolation; typecheck is clean; decision coverage is 23/23. The native tree is byte-identical to the prior verification, so the prior Rust runs (20 brush, 16 mask, 2 provisioning, 2 bound guard, 39 cache-publication) carry unchanged.

The two behavior-unverified truths are SC5's live painted result (UAT test 5 remains `issue`) and the CR-01 close refusal end-to-end. Both are recorded in `behavior_unverified_items` and surfaced as human items; on their own they make the status `human_needed`, not `gaps_found`. Remaining review items (WR-11, WR-14, IN-01..IN-12, and the carried prior-review rows) are follow-ups or advisories, not blockers.

---

_Verified: 2026-11-16T10:20:07Z_
_Verifier: Claude (gsd-verifier)_
