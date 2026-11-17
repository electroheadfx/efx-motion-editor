---
phase: 63-brush-tip-pipeline
verified: 2026-11-17T12:41:50Z
status: passed
score: 27/27 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
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
  - .planning/phases/63-brush-tip-pipeline/63-17-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-17-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-CONTEXT.md
  - .planning/phases/63-brush-tip-pipeline/63-UAT.md
  - app/src-tauri/src/commands/brush_library.rs
  - app/src-tauri/src/commands/efx_paint_media.rs
  - app/src-tauri/src/commands/mod.rs
  - app/src-tauri/src/commands/project.rs
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/models/project.rs
  - app/src-tauri/src/services/frame_codec.rs
  - app/src-tauri/src/services/project_io.rs
  - app/src-tauri/src/services/script_library.rs
  - app/src-tauri/tests/physic_paint_cache_publication.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleBrushSize.test.ts
  - app/src/components/physic-paint/engine/aquarelleBrushSize.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.test.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.ts
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/engine/aquarelleTextureParity.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
  - app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
  - app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.clone.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/watercolorMaskChip.test.ts
  - app/src/components/physic-paint/view/watercolorMaskChip.ts
  - app/src/lib/brushLibrary.test.ts
  - app/src/lib/brushLibrary.ts
  - app/src/lib/efxPaintBrushImport.test.ts
  - app/src/lib/efxPaintBrushImport.ts
  - app/src/lib/efxPaintPackage.test.ts
  - app/src/lib/efxPaintPackage.ts
  - app/src/lib/efxPaintPersistence.test.ts
  - app/src/lib/efxPaintPersistence.ts
  - app/src/lib/ipc.ts
  - app/src/lib/mceFieldContract.test.ts
  - app/src/lib/noRetiredTextureIds.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/main.tsx
  - app/src/stores/aquarelleBrushCatalog.test.ts
  - app/src/stores/aquarelleBrushCatalog.ts
  - app/src/stores/projectStore.efxPaintCutover.test.ts
  - app/src/stores/projectStore.ts
  - app/src/types/physicPaint.ts
  - app/src/types/project.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
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
  - packages/efx-watercolor/src/payload/toStudioStroke.test.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/brushBridge.test.ts
  - packages/efx-watercolor/src/playground/brushBridge.ts
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/engineStartDwell.test.ts
  - packages/efx-watercolor/src/playground/engineTipIdentity.test.ts
  - packages/efx-watercolor/src/playground/index.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/shaders.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/tipUpload.test.ts
covered_digest: "v4:sha256:7f5f4d6870b9c34392d75c9e2f2ccf7b7030493cec8f29289aa61304f2b40362"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 25/27 must-haves verified
  gaps_closed: [] # the previous pass reported no gaps — its two open items were human-verification items, both resolved by the completed UAT
  gaps_remaining: []
  regressions: []
advisory: []
---

# Phase 63: Brush Tip Pipeline Verification Report

**Phase Goal:** An imported PNG or JPG becomes the actual brush tip — a real 512×512 mask in the machine-level user texture library that rebuilds on open and paints the same footprint live, baked and replayed. The `.mce` brush carrier, per-project mask assets and the three shipped built-ins were superseded by quick 261116-inu (UAT-approved 2026-11-16); the supersession is recorded in REQUIREMENTS.md.

**Verified:** 2026-11-17T12:41:50Z
**Status:** passed
**Re-verification:** Yes — the two open human items of the prior `human_needed` pass are resolved by the now-complete UAT ledger (`63-UAT.md`, `7ff349db4`). Re-derived against the current working tree; no implementation file changed since the prior pass (`git log --since=2026-11-17T12:21:05Z -- app packages` is empty; `git status --porcelain -- app packages` is empty). The only covered input that moved is `63-UAT.md`, which is why the fingerprint digest changed (`v4:sha256:1bed5a67…87c6` → `v4:sha256:7f5f4d68…0362`). Planning-root edits in the working tree (`ROADMAP.md`, `REQUIREMENTS.md`, `PROJECT.md`, `STATE.md`, `63-BEADS.md` — Phase 64 scope expansion and bookkeeping) are excluded from the v4 digest by construction (#4623).

**Supersession basis:** quick 261116-inu (UAT-approved 2026-11-16) superseded the `.mce` brush carrier, the per-project mask assets and the three shipped built-ins. The amended ROADMAP goal/success criteria and the REQUIREMENTS.md supersession note (line 12) are authoritative; the PLANs' 192×192 / `.mce`-carrier must-haves are intentionally superseded and are not reported as gaps. Key supersession commits: `762f2a9f5` (built-ins deleted), `87247fa9b` (`.mce` carrier + per-project asset bookkeeping removed), `9ad60a9e2` (script carrier metadata-only), `27aad8b34` (boot scan, machine-scoped catalog), `5d02eb62c` (mipmaps, rotation, retired ids), `4f0af8c39` (rotation through AQTL v4), `50e745a65` (standing warning line dropped), `fa25fffef` (AQTL v3 read), `8ed123a56` (supersession recorded).

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | An imported PNG/JPG becomes the actual brush tip — selecting it paints the 512×512 mask footprint, not a round blob | ✓ VERIFIED | `deriveMask.ts:49` (`TIP_MASK_EDGE = 512`); `maskRegistry.ts:38-40` exact-length admission; `brushBridge.ts:100` `resolveMask(textureId) ?? base.tip`; 261116-inu UAT row 4 |
| 2 | Mask derivation is one pinned two-branch rule — alpha when any alpha < 250, else luminance with polarity from mean over opaque pixels | ✓ VERIFIED | `deriveMask.ts:13-24` documents both branches; `deriveMask.test.ts` (25 tests, green this pass) covers both branches and the wrong-length refusal |
| 3 | 64 MB and 64 MP caps are enforced before read and before decode; a corrupt file with a valid PNG header is refused without crashing | ✓ VERIFIED | `importTip.ts:37` `IMPORT_TIP_MAX_BYTES`, `:40` `IMPORT_TIP_MAX_PIXELS`, magic sniff + bounded header walk; `importTip.test.ts` (18 tests, green this pass) |
| 4 | The mask is stored content-addressed as a lossless 512×512 WebP in the machine library, exact byte length, and load never re-encodes | ✓ VERIFIED | `brush_library.rs:7,142` writes `<sha256>.webp` (symlink refusal, 4 MiB cap, lenient scan); `frame_codec.rs:23-30` `BRUSH_MASK_EDGE = 512` / `BRUSH_MASK_BYTES`; `efxPaintBrushImport.ts:81` asserts exact `TIP_MASK_BYTES` |
| 5 | The machine library rebuilds at app start before the first render | ✓ VERIFIED | `main.tsx:114-115` — `await loadBrushLibrary(); render(<App />, root);` re-confirmed in the current tree |
| 6 | Save → quit → relaunch → open replays the strokes with the texture | ✓ VERIFIED | Per-stroke `textureId`/`textureRotation` snapshot (`aquarelleRecordState.ts`) → AQTL v4 (`scriptTimelineCodec.ts:749-762,1056-1063,1123`) → restore resolves via the machine registry (`brushLibrary.ts`); record-state suites (35 tests) green this pass; 261116-inu UAT row 6 |
| 7 | Live paint, bake and replay share one tip mapping | ✓ VERIFIED | Single resolution in `brushBridge.ts:100`; `aquarelleBake.test.ts` (55), `engineTipIdentity.test.ts` (6), `tipUpload.test.ts` (4) green this pass |
| 8 | The source image is discarded at import; moving/deleting the source changes nothing | ✓ VERIFIED | Only the derived mask is persisted (`importTip.ts` — source released, never retained; `efxPaintBrushImport.ts`); 261116-inu UAT row 3 |
| 9 | A stored mask that is missing, unreadable or the wrong size degrades to an unavailable chip plus the neutral round fallback — never a crash, never blank paint, never an aborted open | ✓ VERIFIED | `brushLibrary.ts:60-95` catches scan/decode failures per entry into `unavailableTipIds` and still `replaceLibraryEntries`; `WatercolorTextureStrip.tsx:95-107` renders `data-unavailable` greyed/disabled; `brush_library.rs:216` lenient scan; `brushLibrary.test.ts` (17) green |
| 10 | A project or script opened on another machine replays with the response tip | ✓ VERIFIED | Two-axis fallback in `brushBridge.ts:100-110`; unregistered id resolves null → base procedural tip; 261116-inu UAT row 9 |
| 11 | A missing texture on another machine surfaces a user-visible warning (ROADMAP SC2 wording) | ✓ VERIFIED (human-decided) | **Resolved by the completed UAT, `63-UAT.md` row 9 = `pass` (2026-11-17T12:36:21Z):** the silent response-tip fallback is confirmed as the final intent — no notice is owed. The cross-machine path still renders no aggregate line by design (`WatercolorBrushLibrary.tsx:194-199`) and a texture with no catalog row has no chip. ROADMAP.md:136 still carries the literal "and a warning" prose; that stale wording is recorded as Info below, not a behavior gap |
| 12 | Re-importing the same texture on the other machine restores the recorded look | ✓ VERIFIED | Id is content-addressed (`wc/custom-<first 12 hex of the digest>`, `efxPaintBrushImport.ts:24`), so the recorded id resolves after import; 261116-inu UAT row 9 |
| 13 | The library is imported-only — no built-ins; retired ids resolve nowhere | ✓ VERIFIED | No `builtin-bristle` / `builtin-chalk` / `builtin-sponge` occurrence in `app/src`, `packages/efx-watercolor/src` or `app/src-tauri/src` (re-run this pass, no matches); `maskRegistry` reset is empty; `noRetiredTextureIds.test.ts` green |
| 14 | Texture delete is confirmation-gated and container-scoped | ✓ VERIFIED | `PhysicsPaintTextureModal.tsx:99` single `pendingTextureDelete` confirmation; `:418-425` Delete/Backspace scoped to the sheet's OWN container subtree; `brush_library.rs:415,445` digest-shape validation and symlink refusal; modal suite (22) green |
| 15 | Rotation is per-stroke integer degrees, snapshotted and carried through save, play and bake | ✓ VERIFIED | `aquarelleRecordState.ts` snapshot; AQTL v4 writes i16 hundredths with whole-degree ±180 validation (`scriptTimelineCodec.ts`); restore/reopenTexture tests green; UAT rows 6/7 |
| 16 | The script carrier is metadata-only (id + rotation) and fail-closed on malformed input | ✓ VERIFIED | `pack.ts:49-63` `isTipRecord` refuses `mask`/`asset` (tolerates legacy `maskDataUrl` on read only); `pack.test.ts` (28) green |
| 17 | The catalog is machine-scoped — an import in one project is not listed or resolvable from another, and a registry replace leaves no ghost mask | ✓ VERIFIED | `aquarelleBrushCatalog.ts:12-24` machine-scoped rows/revision/payload, replace-only; `maskRegistry` replace-only; `aquarelleBrushCatalog.test.ts` (21) green |
| 18 | The retired `.mce` brush carrier, per-project mask assets and built-in tips are absent and are not resurrected | ✓ VERIFIED | `mceFieldContract.test.ts` declares no `.mce` root `brushPack` in either language (green this pass); `models/project.rs:508-547` opens a legacy manifest and a save never re-emits it; `project_io.rs` provisions no `brushes/` tree |
| 19 | A corrupt catalog or unreadable entries cannot prevent the app from rendering | ✓ VERIFIED | `brush_library.rs:216` lenient scan; `loadBrushLibrary()` (`brushLibrary.ts`) swallows scan/decode failures and never rejects; boot awaits it before render |
| 20 | A 4K PNG/JPG import stays responsive (SC1) | ✓ VERIFIED (UAT) | **Resolved by the completed UAT, `63-UAT.md` row 10 = `pass`:** a 4096×4096 JPG import resolved promptly with no multi-second UI freeze (human-observed 2026-11-17). The capped decode path is present and wired (`importTip.ts:37,40`); no automated latency test exists, so the evidence is the recorded human observation |
| 21 | CR-01: a latched binding with withheld content refuses the first close and reports the withheld-save notice | ✓ VERIFIED | `PhysicsPaintStudio.tsx:4240` close gate includes `hasWithheldContent()`; refusal step `:4239-4246`; source pin `PhysicsPaintStudio.test.ts:4030`; controller truth-table test; 63-UAT row 8 |
| 22 | CR-03: the close refusal is acknowledged once per latch episode, not once per window | ✓ VERIFIED (gap re-confirmed closed) | `studioScriptSnapshotController.ts:715` factory-scoped `latchEpisode`, incremented as the first statement of `bind()` at `:757`, exposed via `withheldEpisode()` (`:272`, `:1225-1227`, `:1260`), compared through the exported pure `admitsWithheldClose` (`:674-679`). Studio `PhysicsPaintStudio.tsx:4195` `closeWithheldAcknowledgedEpisodeRef = useRef(-1)`; close step `:4240` content check BEFORE `:4241` episode read, `:4242` gate, `:4243` record, refusal containing "closing again will discard the unsaved script". Controller CR-03 pins (`studioScriptSnapshotController.test.ts:1474-1514`) prove episode A refused → same episode admitted → rebind to latched track B → fresh episode refused again, stable across `saveNow()`/`flushNow()`; Studio source pin at `PhysicsPaintStudio.test.ts:4036-4044`. Target suites re-run this pass: 525/525 green |
| 23 | AQTL v4 writes and v3 reads with upgrade; v1/v2 are refused with a named retirement; SNAP v1–4 retire by name | ✓ VERIFIED | `scriptTimelineCodec.ts:114` `SCRIPT_TIMELINE_BINARY_VERSION = 4`, `:121` read set {3,4}, `:1170-1171` `unsupported-version`; v1/v2 refusal pinned in `scriptTimelineCodec.test.ts` (60 tests, green this pass); `studioScriptSnapshotCodec.ts` `snap-v4-retired` / `aqtl-retired` |
| 24 | CR-02: the refused-restore latch clears only on the acknowledged whole-track clear | ✓ VERIFIED | `studioScriptSnapshotController.ts` clears on a successful restore and only on a successful `sessionOnly` (explicit purge) commit; routine saves stay withheld. CR-02 pins at `studioScriptSnapshotController.test.ts:1173` (repeated routine saves), `:1191` (debounced drain writes nothing), `:1244` (missing never latches), `:1280` (failed purge leaves the latch set); WR-13 partial-purge pins at `:1527-1560`; controller suite green |
| 25 | WR-15: `hasWithheldContent()` counts only this track's withheld content | ✓ VERIFIED (gap re-confirmed closed) | `studioScriptSnapshotController.ts:1195-1223`: empty/absent base map → false; `getLiveKeyIds()` null/undefined → true conservative; else `ownIds` = live-key VALUES ∪ `getWatercolorKeyAnchors()` VALUES; true only when a durable-base key is in `ownIds`. Production ports wired: `getLiveKeyIds` at `PhysicsPaintStudio.tsx:1385-1390`, `getWatercolorKeyAnchors` at `:1411`, `getDurableBases` at `:1420-1428`. Four behavioural pins (`studioScriptSnapshotController.test.ts:2153-2200`): own base → true, foreign-only base → false, unknown identity → true, anchor-owned base → true; controller suite green |
| 26 | WR-12: a deliberate format retirement is reported as a named notice, not a corrupt snapshot | ✓ VERIFIED | `studioScriptSnapshotCodec.ts` `snap-v4-retired` / `aqtl-retired` surface as named outcomes; the once-per-binding notice pin exists at `studioScriptSnapshotController.test.ts:659`; codec suite green |
| 27 | Per-stroke texture/rotation survive duplicate/clone and play-apply-bake | ✓ VERIFIED | `aquarelleStrokeSelection.ts:1043-1045` clone preserves `textureId`/`textureRotation`; `physicsPaintRotoDuplicateScript.test.ts`; bake controller tests assert the snapshot `textureId` reaches `bake.bake`; targeted suites green |

**Score:** 27/27 truths verified (0 behavior-unverified, 0 overrides)

### Prohibitions (must-NOT)

The two gap-closure plans declare nine prohibitions (`63-16-PLAN.md` ×6, `63-17-PLAN.md` ×3). All are enforced by a deterministic pin or grep; all enforcement is present and green in the current tree.

| Plan | Prohibition | Enforcement | Status |
| ---- | ----------- | ----------- | ------ |
| 63-16 | No AQTL v1/v2 reader, upgrade path, migration write or legacy decode branch; retirement is reported, never migrated | `scriptTimelineCodec.ts:1170-1171` is the only version comparison; read set `{3,4}` at `:121`; no v1/v2 branch | ✓ ENFORCED |
| 63-16 | No Rust, Tauri command, IPC adapter, manifest or snapshot filename/layout change; the refused bytes are protected by NOT WRITING, never a backup file | `git diff --name-only bc8c757fc..240236401` lists only the four declared TypeScript files (re-run this pass) | ✓ ENFORCED |
| 63-16 | The controller keeps its purity law — no Preact component, hook, effect or Studio import | `grep -c 'PhysicsPaintStudio\|useEffect\|useSignal\|useState\|useMemo'` = 0; `grep -c '^import .*@preact'` = 1 (re-run this pass) | ✓ ENFORCED |
| 63-16 | No new save option or UI affordance; the existing `sessionOnly` purge marker is the only overwrite acknowledgement | **Superseded:** WR-13 added `acknowledgeRefusedRestore` (`studioScriptSnapshotController.ts:241-247`), wired into the purge gate and pinned by the WR-13 partial-purge tests. The intent (no dead option) holds; the literal "exactly two fields" is stale | ℹ️ Info — deliberate review fix |
| 63-16 | The latch is never set by the missing branch and never cleared by any routine save, failed write, or report | Pins at `studioScriptSnapshotController.test.ts:1173`, `:1191`, `:1244`, `:1280`, `:1340` | ✓ ENFORCED |
| 63-16 | The retirement notice is emitted once per binding, never per restore attempt or per save | Pin `studioScriptSnapshotController.test.ts:659`; re-arms on a new bind | ✓ ENFORCED |
| 63-17 | A new latch episode is never implicitly acknowledged — an acknowledgement for one binding never authorizes another | CR-03 pin `studioScriptSnapshotController.test.ts:1474-1502` | ✓ ENFORCED |
| 63-17 | A destructive remedy must never be presented for withheld content the binding does not hold | WR-15 pins `studioScriptSnapshotController.test.ts:2153-2200` (foreign-only base → false) | ✓ ENFORCED |
| 63-17 | A close that would discard unsaved script is never acknowledged without stating the discard consequence | Studio source pin `PhysicsPaintStudio.test.ts:4036-4044` asserts "closing again will discard the unsaved script"; thrown only for a fresh episode (`PhysicsPaintStudio.tsx:4245`) | ✓ ENFORCED |

### UAT Resolution

`63-UAT.md` is now `status: complete` (10 tests, 9 passed, 1 issue, 0 pending). The ledger is the human decision record:

- **Row 5 (G-63-5 issue) — resolved, not open.** The reported failure (scripts dropped every stroke's texture) was root-caused in `.planning/debug/roto-script-drops-texture.md` and closed by executed plan `63-15` (summary present). The fix is in the tree: AQTL v4 writes a presence-prefixed `engine.textureId` (`scriptTimelineCodec.ts:749-762`) and reads it back (`:1056-1063`, `:1123`), pinned by the `AQTL v3 textureId (63-15 G-63-5)` suite block (`scriptTimelineCodec.test.ts:804+`, green). The live retest is UAT row 7 = `pass`.
- **Row 9 (SC2 warning wording) — passed.** The human confirmed the silent response-tip fallback as the final intent (truth 11).
- **Row 10 (4K import responsiveness) — passed.** Human-observed prompt import with no multi-second freeze (truth 20).
- Rows 1-4, 6-8 were already `pass`; none regressed.

### Deferred Items

None. Phase 64 (Medium Engine, MED-01..MED-38) covers none of the phase's residual items; no later milestone phase owns the accepted live-vs-replay texture-sampling residual.

### Advisory (New Scope, Unevidenced)

None. Re-verification ran; no new-scope blocker was raised. No covered source file changed since the prior `verified:` timestamp, so no Step 7 finding is regression-eligible, and there are no carried-forward gaps. The remaining open `63-REVIEW-DISPOSITION.md` rows predate this round and this pass collected no fresh failure evidence for them.

### Required Artifacts

`gsd_run query verify.artifacts` returns `total: 0` for all 17 phase plans (artifacts declared as plain strings, not `{path}` objects — re-run this pass), so every artifact below was verified manually at all levels (exists, substantive, wired). All implementation inputs are digest-identical to the prior pass.

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/brushes/deriveMask.ts` | 512² two-branch derivation | ✓ VERIFIED | `TIP_MASK_EDGE = 512` (`:49`); total on wrong length/type |
| `packages/efx-watercolor/src/brushes/importTip.ts` | Decode path with caps | ✓ VERIFIED | 64 MB/64 MP (`:37,40`), magic sniff, bounded header walk, high-quality 512² downscale, named failures, source released |
| `packages/efx-watercolor/src/brushes/maskRegistry.ts` | Identity mask registry | ✓ VERIFIED | Exact-length admission (`:38-40`); replace-only; reset empty |
| `packages/efx-watercolor/src/brushes/pack.ts` | Metadata-only script carrier | ✓ VERIFIED | `isTipRecord` refuses `mask`/`asset`; project carrier removed |
| `packages/efx-watercolor/src/playground/brushBridge.ts` | Single tip mapping | ✓ VERIFIED | `resolveMask(textureId) ?? base.tip` (`:100`); rotation only with a mask |
| `packages/efx-watercolor/src/playground/Engine.ts` | Mipmapped tip upload | ✓ VERIFIED | Row-flipped masks, `generateMipmap`, mipmap min filter |
| `app/src/main.tsx` | Boot scan before first render | ✓ VERIFIED | `await loadBrushLibrary()` `:114` before `render(<App />)` `:115` |
| `app/src/lib/brushLibrary.ts` | Scan/decode/register + degrade | ✓ VERIFIED | Per-entry decode failures degrade into `unavailableTipIds`; never rejects |
| `app/src/lib/efxPaintBrushImport.ts` | Import publish | ✓ VERIFIED | Exact `TIP_MASK_BYTES` (`:81`); write then register then upsert |
| `app/src/stores/aquarelleBrushCatalog.ts` | Machine-scoped catalog | ✓ VERIFIED | Rows, revision, payload build/apply; machine-scoped law documented |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Per-stroke texture/rotation | ✓ VERIFIED | Snapshot + restore + payload carry both fields |
| `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` | AQTL v4 + v3 read + textureId | ✓ VERIFIED | v4 write (`:114`), v3 read (`:121`), v1/v2 refuse (`:1170-1171`), presence-prefixed `textureId` write/read (`:749-762`, `:1056-1063`) |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | Retirement notices | ✓ VERIFIED | `snap-v4-retired` / `aqtl-retired` named outcomes |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | Withheld gate + latch episode | ✓ VERIFIED | Per-episode counter and own-key durable-base scope verified (truths 22/25); purity law intact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Close refusal per episode | ✓ VERIFIED | Per-episode acknowledgement with informed refusal (truth 22) |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | Import + library UI | ✓ VERIFIED | Import row, delete, chip-level unavailable state; no aggregate line by request |
| `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` | Texture row | ✓ VERIFIED | `data-unavailable` greyed/disabled; rotation preview |
| `app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx` | Delete/rotation UI | ✓ VERIFIED | Single confirmation; container-subtree Delete/Backspace |
| `app/src-tauri/src/commands/brush_library.rs` | Machine catalog | ✓ VERIFIED | Content-addressed write, 512 header gate, caps, rotation bounds, lenient scan, digest-validated delete |
| `app/src-tauri/src/services/frame_codec.rs` | 512 mask gate | ✓ VERIFIED | `BRUSH_MASK_EDGE` / `BRUSH_MASK_BYTES` / wrong-size / unreadable named failures |
| `app/src/lib/noRetiredTextureIds.test.ts` / `app/src/lib/mceFieldContract.test.ts` | Retired-id + field-diff pins | ✓ VERIFIED | Runtime-built retired prefix scan; no root `brushPack` in either language (both green this pass) |

### Key Link Verification

`gsd_run query verify.key-links` reports `verified: 0` of 2-4 links per plan (re-run this pass) because the links are prose descriptions while the actual references are relative imports/method calls. Each critical link was verified manually:

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `PhysicsPaintStudio.tsx` close step | `studioScriptSnapshotController.ts` latch episode | `withheldEpisode()` + `admitsWithheldClose(ref.current, episode)` | WIRED | Import at `:202`; content check `:4240`, episode read `:4241`, gate `:4242`, record `:4243`, refusal `:4245`; rebind increments the episode at controller `:757` |
| `PhysicsPaintStudio.tsx` | `hasWithheldContent()` own-key scope | `getLiveKeyIds` (:1385-1390), `getWatercolorKeyAnchors` (:1411), `getDurableBases` (:1420-1428) | WIRED | Controller consumes all three at `:1203-1218`; the same ports feed the save's scope |
| `WatercolorBrushLibrary.tsx` import row | `importTip.ts` → main-realm import | `importTip(file, { decode, register: requestPhysicPaintBrushImport })` | WIRED | Decode in the Studio realm, publish through the main realm |
| `efxPaintBrushImport.ts` | `brush_library.rs` | `ipcBrushLibraryWrite(fileName, mask)` then catalog upsert + publish | WIRED | Exact 262,144-byte mask |
| `main.tsx` boot | `brushLibrary.ts` → Rust scan → `aquarelleBrushCatalog` | `await loadBrushLibrary()`; decode + `replaceLibraryEntries` | WIRED | Runs before first render |
| Stroke snapshot | AQTL v4 / SNP1 → restore | `snapshotAquarelleRecord` → `scriptTimelineCodec` (incl. `engine.textureId`) → restore → `brushBridge` | WIRED | Texture id + rotation survive save/play/bake |
| `PhysicsPaintTextureModal.tsx` delete/rotation | Rust mutation → catalog publish | bridge mutation dispatch → `deleteBrushTexture` / `setBrushTextureRotation` | WIRED | Digest included; catalog republished |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Texture strip rows | catalog signal | Rust `catalog.json` scan → decode → `replaceLibraryEntries` | Yes | ✓ FLOWING |
| Engine tip | mask bytes | Machine-library WebP decoded to 512² (or derived mask at import) → `maskRegistry` | Yes | ✓ FLOWING |
| Stroke texture/rotation | `textureId` / `textureRotation` | Selection / restored stroke → AQTL/SNP → `brushBridge` | Yes | ✓ FLOWING |
| Rotation preview | `libraryRowFor(textureId).textureRotation` | Catalog row | Yes | ✓ FLOWING |
| Unavailable chips | `unavailableTipIds` | Per-entry decode/size failures during boot scan | Yes | ✓ FLOWING |
| Close gate | `hasWithheldContent()` + `withheldEpisode()` | Session events + own-key durable bases + bind-keyed episode | Yes | ✓ FLOWING (scope and episode verified) |

No rendered tip value ends in a hardcoded empty or mock path; the `?? base.tip` fallback is the intended neutral degradation.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| CR-03/WR-15 target suites (re-run this pass) | `pnpm --filter efx-motion-editor exec vitest run studioScriptSnapshotController.test.ts PhysicsPaintStudio.test.ts` | 2 files, 525 passed (92 + 433), 0 failed | ✓ PASS |
| AQTL textureId / record-state suites (re-run this pass) | `pnpm --filter efx-motion-editor exec vitest run scriptTimelineCodec.test.ts aquarelleRecordState.test.ts aquarelleRecordState.restore.test.ts aquarelleRecordState.reopenTexture.test.ts` | 4 files, 95 passed, 0 failed | ✓ PASS |
| App truth-pinning suites (re-run this pass) | `pnpm --filter efx-motion-editor exec vitest run noRetiredTextureIds.test.ts mceFieldContract.test.ts brushLibrary.test.ts efxPaintBrushImport.test.ts aquarelleBrushCatalog.test.ts WatercolorBrushLibrary.test.ts PhysicsPaintTextureModal.test.ts` | 7 files, 126 passed, 0 failed | ✓ PASS |
| Package truth-pinning suites (re-run this pass) | `pnpm --filter @efxlab/efx-watercolor exec vitest run deriveMask.test.ts maskRegistry.test.ts importTip.test.ts pack.test.ts brushBridge.test.ts engineTipIdentity.test.ts tipUpload.test.ts aquarelleBake.test.ts` | 8 files, 182 passed, 0 failed | ✓ PASS |
| Phase app regression suites (32 files: engine, codecs, roto, view, library, catalog, bridge, clone) | `npx vitest run <32 phase suites>` | 32 files, 1196 passed / 1 skipped, 0 failed — carried forward; every source input is digest-identical to that pass | ✓ PASS (carried) |
| efx-watercolor package regression | `pnpm --filter @efxlab/efx-watercolor run test` | 429 passed / 8 skipped (GPU-gated), 0 failed — carried forward; inputs digest-identical | ✓ PASS (carried) |
| App typecheck | `pnpm --filter efx-motion-editor run typecheck` | exit 0 — carried forward; inputs digest-identical | ✓ PASS (carried) |
| Rust brush-library + frame-codec | `cargo test --lib brush_library` / `--lib frame_codec` | 27 passed + 10 passed, 0 failed — carried forward; inputs digest-identical | ✓ PASS (carried) |
| CR-03 per-episode pins are behavioural | `studioScriptSnapshotController.test.ts:1474-1514` | Re-confirmed this pass: episode A refused, same episode admitted, rebind to track-2 yields a different episode refused again; stable across saveNow/flushNow; suite green | ✓ PASS |
| WR-15 own/foreign/anchor/unknown pins are behavioural | `studioScriptSnapshotController.test.ts:2153-2200` | Re-confirmed this pass: own true / foreign-only false / unknown true / anchor-owned true; suite green | ✓ PASS |
| Studio wiring pin | `PhysicsPaintStudio.test.ts:4036-4044` | Asserts `withheldEpisode()` read, `admitsWithheldClose(...)`, and "closing again will discard the unsaved script" | ✓ PASS (source-level; behaviour proven by the controller pins) |
| Retired per-window identifier absent | `grep -c "closeWithheldAcknowledgedRef" PhysicsPaintStudio.tsx` | 0 occurrences (re-run this pass); `closeWithheldAcknowledgedEpisodeRef` at declaration/read/write | ✓ PASS |
| No retired built-in ids | `grep -rn "builtin-bristle\|builtin-chalk\|builtin-sponge" app/src packages/efx-watercolor/src app/src-tauri/src` | No matches (re-run this pass) | ✓ PASS |
| Controller purity | `grep -c 'PhysicsPaintStudio\|useEffect\|useSignal\|useState\|useMemo'` = 0; `grep -c '^import .*@preact'` = 1 | Re-run this pass, matches the prohibition | ✓ PASS |
| Debt-marker gate | `grep -nE "TBD\|FIXME\|XXX"` on the phase source files | No matches (re-run this pass) | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| None | `find scripts -path '*/tests/probe-*.sh'`; grep of Phase 63 PLAN/SUMMARY for probe paths | No probe files exist and none is declared by Phase 63 | N/A |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `studioScriptSnapshotController.test.ts` | TIP (close/withheld path), CR-03/WR-15/WR-13 | 92 | 0 | No | Behavioral (real controller, DI ports, episode/gate values) | ✓ PASS |
| `PhysicsPaintStudio.test.ts` | CR-03 wiring | 433 | 0 | No | Source pins + behavioural helpers | ✓ PASS |
| `scriptTimelineCodec.test.ts` | TIP-14, G-63-5 | 60 | 0 | No | Value/behavioral (presence-stable round trip) | ✓ PASS |
| Phase app regression suites | TIP-01..17 | 1196 | 1 (one unrelated native-window `it.skip` in `physicPaintBridge.test.ts`) | No | Value/behavioral | ✓ PASS |
| `@efxlab/efx-watercolor` suites | TIP-01/02/03/05/07 | 429 | 8 (GPU `describe.skipIf`) | No | Value/behavioral | ✓ PASS |

**Disabled tests on requirements:** 0 tied to a Phase 63 truth. The 8 `describe.skipIf(!gpu)` skips are environment-gated GPU suites; the single `it.skip` covers native-window close-after-save (not a TIP truth, and other tests cover the phase behaviours it touches).
**Circular patterns detected:** 0 (no fixture-writing in the target suites; controller tests drive real ports through DI).
**Insufficient assertions:** 0 for the gap-closure truths (the controller pins assert specific episode values and gate outcomes; the AQTL pins assert byte-stable round trips).

### Requirements Coverage

All 17 TIP IDs are declared across the phase plans (`63-01`..`63-16`; `63-17` declares none) and mapped to Phase 63 in REQUIREMENTS.md (rows 113-129, all `Complete`). No orphaned requirements: no other requirement ID maps to Phase 63.

| Requirement | Source Plan(s) | Description | Verdict | Evidence |
| ----------- | -------------- | ----------- | ------- | -------- |
| TIP-01 | 63-05, 63-06, 63-12 | Imported image becomes the actual tip; selecting visibly changes the footprint | pass | Truth 1; UAT row 4 |
| TIP-02 | 63-01, 63-05 | Derived tip size/byte count and one import-time derivation | superseded — quick 261116-inu (`762f2a9f5`, `27aad8b34`): imported masks are 512×512 (262,144 bytes); `TIP_SIZE` 192 remains for procedural tips only; the single high-quality import-time derivation survives | Truths 1/2 |
| TIP-03 | 63-01 | One pinned two-branch mask derivation, tested and documented | pass | Truth 2 |
| TIP-04 | 63-05, 63-14 | 64 MP refusal before decode; corrupt-with-header refusal without crash | pass | Truth 3 |
| TIP-05 | 63-01, 63-12 | `buildBrushForStroke` is the single live/bake mapping | pass | Truth 7 |
| TIP-06 | 63-01, 63-05, 63-06, 63-13 | Registry fed by the import surface; reset leaves no ghost mask | superseded — quick 261116-inu (`27aad8b34`, `762f2a9f5`): machine-scoped registry replaced wholesale; no ghost mask (truth 17) | Truth 17 |
| TIP-07 | 63-07, 63-11 | Imported tip survives save → quit → relaunch → open | superseded — quick 261116-inu (`87247fa9b`, `27aad8b34`): reproduction comes from the machine library; save/relaunch/replay still holds (truth 6; UAT row 6) | Truth 6 |
| TIP-08 | 63-02, 63-04, 63-14 | Lossless content-addressed mask asset; copy stored bytes, never re-encode | superseded — quick 261116-inu (`87247fa9b`, `762f2a9f5`): asset lives in the machine library as `<sha256>.webp`; content-addressing / exact-byte law survives (truth 4) | Truth 4 |
| TIP-09 | 63-02, 63-04, 63-14 | No tip depends on the source image; source is disposable | superseded — quick 261116-inu: source still discarded; tip depends on the machine library (truths 4, 8) | Truths 4, 8 |
| TIP-10 | 63-02, 63-05, 63-06, 63-07, 63-14 | Both import caps; bad stored asset degrades to unavailable tip + fallback + one aggregate warning | superseded — quick 261116-inu (`50e745a65`, `762f2a9f5`): caps and per-asset degradation survive (truths 3, 9); the standing aggregate warning line was dropped on request; the cross-machine warning clause is human-decided (truth 11) | Truths 3, 9, 11 |
| TIP-11 | 63-04, 63-10 | Brush pack in the `.mce` root with package-relative mask refs | superseded — quick 261116-inu (`87247fa9b`): the `.mce` root `brushPack` is removed in both languages | Truth 18 |
| TIP-12 | 63-07, 63-10 | Masks decoded and registered before the first replay | superseded — quick 261116-inu (`27aad8b34`): registration moved to the app-start boot scan before the first render | Truth 5 |
| TIP-13 | 63-03, 63-06, 63-13 | Three built-in textured tips ship | superseded — quick 261116-inu (`762f2a9f5`): built-ins deleted; library is imported-only | Truth 13 |
| TIP-14 | 63-08, 63-11, 63-15, 63-16 | A roto script carries its tip's mask and rehydrates it on load | superseded — quick 261116-inu (`9ad60a9e2`): carrier is metadata-only; a missing texture replays with the response tip; re-importing restores the look. The 63-15 fix carries `engine.textureId` through the per-track snapshot; UAT rows 5/7 resolved and re-tested | Truths 10, 12, 16 |
| TIP-15 | 63-04, 63-10 | `buildBrushPackSnapshot` is the one entry-shape authority, total and fail-closed | superseded — quick 261116-inu (`9ad60a9e2`): project-level producer removed; the script carrier's producer/validator remains metadata-only and fail-closed (`pack.ts`) | Truth 16 |
| TIP-16 | 63-04, 63-09, 63-10 | Untouched-project byte identity, mask bytes included | superseded — quick 261116-inu: no brush bytes live in the `.mce`; the untouched-project round-trip is covered by the existing package suites | Truth 18 |
| TIP-17 | 63-07, 63-10 | Opening replaces the catalog/registry with the project's entries plus built-ins | superseded — quick 261116-inu (`27aad8b34`, `762f2a9f5`): catalogs are machine-scoped, built-ins gone; no cross-project ghost | Truth 17 |

**No TIP ID is a gap.** Every surviving clause (TIP-01, TIP-03, TIP-04, TIP-05, plus the surviving parts of TIP-02/06..17) is verified above; every retired clause is attributed to quick 261116-inu and its commits.

**ROADMAP success-criteria alignment:** SC1 → truths 1-4, 20; SC2 → truths 6, 7, 10, 11 (human-decided), 12; SC3 → truths 13, 19; SC4 → truths 9, 14; SC5 → truths 15, 16, 17.

### Decision Coverage

`check.decision-coverage-verify`: 23/23 trackable CONTEXT.md decisions honored by shipped artifacts (`not_honored: []`), re-run this pass.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `.planning/ROADMAP.md` | 136 | SC2 still literally says "and a warning" although UAT row 9 confirmed the silent response-tip fallback as final intent | ℹ️ Info | Stale roadmap prose; the human decision is the law (truth 11). Amend the clause on the next roadmap touch |
| `.planning/ROADMAP.md` | 216 | Progress row says "17/17 · In Progress" while line 107 marks the phase completed | ℹ️ Info | Bookkeeping inconsistency; no code impact |
| `.planning/phases/63-brush-tip-pipeline/63-UAT.md` | 20, 24, 28, 38 | Rows 2/3/4/6 retain pre-supersession wording ("exactly one aggregate warning line", "from the `.mce` alone", three built-ins) | ℹ️ Info | Rows passed before quick 261116-inu superseded those clauses; the superseding quick's own UAT (approved 2026-11-16) is the current evidence |
| `.planning/phases/63-brush-tip-pipeline/63-16-PLAN.md` | prohibitions | `verification:` values are prose instead of the canonical `test \| judgment` tier | ℹ️ Info | Schema nit; every prohibition names a real, wired and green enforcement (see Prohibitions table) |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | 1188-1193 | Doc block says the gate is "exactly the set of bases a save would write"; it is a deliberate superset (pre-foreign-filter anchors) — 63-REVIEW IN-01 | ℹ️ Info | Safe direction (at most one extra refusal); the comment over-claims |
| `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` | 4036-4044 | The CR-03 source pin checks substrings anywhere in a ~518 KB file; the content-check-before-ack order is unpinned — 63-REVIEW IN-02 | ℹ️ Info | The shipped order is correct (`:4240` before `:4243`); a future inversion would not be caught by this pin |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | 26, 33, 107 | Stale comments: "one 192×192 mask", "aggregate warning line for the whole set" | ℹ️ Info | Misleading docs; runtime honors the amended law |
| `app/src/lib/ipc.ts`, `app/src/types/physicPaint.ts`, `app/src/lib/physicPaintBridge.ts`, `app/src/lib/efxPaintPersistence.ts`, `app/src-tauri/src/services/project_io.rs` | various | Stale "36,864-byte 192×192" / per-project `brushes/<sha256>.webp` comments | ℹ️ Info | Comments only |
| `app/src/lib/ipc.ts` + `app/src-tauri/src/lib.rs` | 697, 719, 741, 778 / 973-976 | Dead IPC wrappers whose Rust commands are still registered | ℹ️ Info | Dead code; not a stub of a required behavior |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | 637-642 | Dead short-body fallback in the AQTL version read (WR-14) | ℹ️ Info | Unreachable branch |
| `.planning/phases/63-brush-tip-pipeline/63-REVIEW-DISPOSITION.md` | rows | Some findings still marked `open` although their code is fixed and verified (CR-01/CR-02/WR-12/WR-13) | ℹ️ Info | Bookkeeping inconsistency; no code impact |
| 261116-inu declared residual | — | Short textured strokes can differ slightly live vs replay (tick sampling) | ℹ️ Info (accepted) | Declared loss; no later phase owns it |
| Debt-marker gate | — | No `TBD`/`FIXME`/`XXX` in the phase source files (re-run this pass) | — | Gate clean |

### Human Verification Required

None. Both prior human items are resolved by the completed UAT ledger:

1. **SC2 missing-texture warning wording** — `63-UAT.md` row 9 = `pass`: the silent response-tip fallback is the final intent (truth 11).
2. **4K import responsiveness** — `63-UAT.md` row 10 = `pass`: prompt import, no multi-second freeze (truth 20).

No new human-dependent behavior was introduced since the prior pass (no source change), and the UAT ledger covers every user-facing row of the phase.

### Gaps Summary

No gaps. Both previously open human items are resolved by the now-complete UAT ledger, and both previously closed gap-closure fixes are re-confirmed in the current tree:

1. **Truth 11 — resolved by decision.** UAT row 9 passed; the silent response-tip fallback is accepted as the final intent. The only residue is stale ROADMAP SC2 prose (Info).
2. **Truth 20 — resolved by human observation.** UAT row 10 passed; the 4K import is responsive.
3. **CR-03 (truth 22) — VERIFIED, no regression.** Bind-incremented `latchEpisode`, pure `admitsWithheldClose` gate, per-episode Studio acknowledgement with the informed refusal; every production `restore()` is preceded by `bind()`; the retired per-window identifier has zero occurrences. Target suites re-run this pass: 525/525.
4. **WR-15 (truth 25) — VERIFIED, no regression.** The durable-base arm scopes the launch-scoped map to `ownIds` (live-key values plus session-anchor values), stays conservative on an unknown live key map, and returns false for a foreign track's base. Four behavioural pins re-confirmed and green.
5. **G-63-5 (UAT row 5) — resolved, not open.** Executed plan `63-15` is present with its SUMMARY; AQTL v4 carries `engine.textureId` on encode and decode with byte-stable pins, and the live retest (UAT row 7) passed.

No other truth regressed: no implementation file changed since the prior `verified:` timestamp, and the only covered input that moved is `63-UAT.md`. The phase goal — an imported PNG/JPG becoming a real 512×512 machine-library brush tip that rebuilds on open and paints the same footprint live, baked and replayed — is achieved in the current tree.

---

_Verified: 2026-11-17T12:41:50Z_
_Verifier: Claude (gsd-verifier)_
