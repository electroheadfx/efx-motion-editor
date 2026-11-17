---
phase: 63-brush-tip-pipeline
verified: 2026-11-17T10:33:27Z
status: gaps_found
score: 23/27 must-haves verified
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
covered_digest: "v4:sha256:468f79f485c982d0ff4389b7d17d7d8cd5eabc78fbf337c049ce280ef0e9707a"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 40/42
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "Close refusal is acknowledged once per latch episode — a later refused track must not close silently and destroy its withheld script"
    status: failed
    reason: "The acknowledgement is a per-window ref (closeWithheldAcknowledgedRef = useRef(false)), set true on the first refusal and never reset, so every later latch episode in the same Studio window closes without a notice and writes nothing."
    artifacts:
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "closeWithheldAcknowledgedRef at :4192, set true at :4237, never reset on a new episode"
    missing:
      - "Per-episode acknowledgement (e.g. a controller withheldEpisode() counter compared against the acknowledged episode in the close path, per the 63-REVIEW CR-03 fix sketch)"
  - truth: "hasWithheldContent() counts only this track's withheld content — an empty binding must not refuse the close"
    status: failed
    reason: "The durable-bases arm checks the launch-scoped map's size without filtering to this track's key ids, so another track's durable base makes a latched-but-empty binding refuse the close and names a destructive remedy."
    artifacts:
      - path: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts"
        issue: "hasWithheldContent() at :1153-1163 — `const bases = deps.getDurableBases?.(); return (bases?.size ?? 0) > 0;`"
    missing:
      - "Scope the durable-bases arm to this track's persisted key ids (63-REVIEW WR-15 fix sketch)"
advisory: []
behavior_unverified_items:
  - truth: "A 4K PNG/JPG import completes without freezing the Studio UI"
    test: "Import a 4096×4096 JPG on a cold machine and keep dragging the Studio canvas during the import"
    expected: "The import resolves promptly and the UI keeps responding — no multi-second stall"
    why_human: "The capped decode path is present and wired, but no test exercises decode latency; SC1's '4K responsive' claim is a runtime feel"
---

# Phase 63: Brush Tip Pipeline Verification Report

**Phase Goal (authoritative, amended):** An imported PNG or JPG becomes the actual brush tip — a real 512×512 mask in the machine-level user texture library that rebuilds on open and paints the same footprint live, baked and replayed.

**Supersession basis:** quick 261116-inu (UAT-approved 2026-11-16) superseded the `.mce` brush carrier, the per-project mask assets and the three shipped built-ins. The amended ROADMAP goal/success criteria and the REQUIREMENTS.md supersession note (line 12) are authoritative; the PLANs' 192×192 / `.mce`-carrier must-haves are intentionally superseded and are not reported as gaps. Key supersession commits: `762f2a9f5` (built-ins deleted), `87247fa9b` (`.mce` carrier + per-project asset bookkeeping removed), `9ad60a9e2` (script carrier metadata-only), `27aad8b34` (boot scan, machine-scoped catalog), `5d02eb62c` (mipmaps, rotation, retired ids), `4f0af8c39` (rotation through AQTL v4), `50e745a65` (standing warning line dropped), `fa25fffef` (AQTL v3 read), `8ed123a56` (supersession recorded).

**Verified:** 2026-11-17T10:33:27Z
**Status:** gaps_found
**Re-verification:** Yes — stale-report refresh. The prior report was written at 2026-11-16T10:20:07Z (frontmatter `passed`, body `human_needed`; score 40/42). Quick 261116-inu then redefined the shipped contract and deleted 8 previously-covered files, and 89+ covered inputs changed; the covered-input fingerprint was recomputed over the current 143-file covered set (`v4:sha256:468f79f4…`). CR-03/WR-15 are not regressions of the prior report's truths — they are new facts the prior report never asserted.

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | An imported PNG/JPG becomes the actual brush tip — selecting it paints the 512×512 mask footprint, not a round blob | ✓ VERIFIED | `importTip.ts` decodes to 512² and `deriveMask` returns 262,144 bytes; registered via `maskRegistry.ts`; `brushBridge.ts` maps `textureId → resolveMask(textureId) ?? base.tip` into the engine tip; 261116-inu UAT row 4 (512 px footprint) |
| 2 | Mask derivation is one pinned two-branch rule — alpha when any alpha < 250, else luminance with polarity from mean over opaque pixels | ✓ VERIFIED | `deriveMask.ts` module header documents both branches and `TIP_MASK_EDGE`/`TIP_MASK_BYTES`; `deriveMask.test.ts` covers both branches and the wrong-length refusal |
| 3 | 64 MB and 64 MP caps are enforced before read and before decode; a corrupt file with a valid PNG header is refused without crashing | ✓ VERIFIED | `importTip.ts`: `file.size` ≤ 64 MB and pixel-count gate before read/decode, magic sniff + header dimension walk, named failures, never throws; `importTip.test.ts` |
| 4 | The mask is stored content-addressed as a lossless 512×512 WebP in the machine library, exact byte length, and load never re-encodes | ✓ VERIFIED | `brush_library.rs` writes `<sha256>.webp` (collision refusal, symlink refusal, 4 MiB caps), `frame_codec.rs` `BRUSH_MASK_EDGE: 512` / `BRUSH_MASK_BYTES` header gate before allocation; `efxPaintBrushImport.ts` asserts exact `TIP_MASK_BYTES` |
| 5 | The machine library rebuilds at app start before the first render | ✓ VERIFIED | `main.tsx:110-115` awaits `loadBrushLibrary()` on the main-window branch before `render(<App />)`; Rust scan is lenient; `loadBrushLibrary` never rejects |
| 6 | Save → quit → relaunch → open replays the strokes with the texture | ✓ VERIFIED | Per-stroke `textureId`/`textureRotation` snapshot (`aquarelleRecordState.ts:585-627`) → AQTL v4 (`scriptTimelineCodec.ts`) → restore resolves via the machine registry; 261116-inu UAT row 6 |
| 7 | Live paint, bake and replay share one tip mapping | ✓ VERIFIED | Single resolution in `brushBridge.ts` (`strokeTipData` shares it); `aquarelleBake.test.ts`, `engineTipIdentity.test.ts`, `tipUpload.test.ts` |
| 8 | The source image is discarded at import; moving/deleting the source changes nothing | ✓ VERIFIED | Only the derived mask is persisted (`importTip.ts`, `efxPaintBrushImport.ts`); 261116-inu UAT row 3 (source-image no-op) |
| 9 | A stored mask that is missing, unreadable or the wrong size degrades to an unavailable chip plus the neutral round fallback — never a crash, never blank paint, never an aborted open | ✓ VERIFIED | `brushLibrary.ts` catches per-entry decode/size failures into `unavailableTipIds` and still `replaceLibraryEntries`; `WatercolorTextureStrip.tsx` renders `data-unavailable` greyed/disabled; open is unaffected; `brush_library.rs` lenient scan; delete/reopen UAT row 8 |
| 10 | A project or script opened on another machine replays with the response tip | ✓ VERIFIED | Two-axis fallback in `brushBridge.ts`; unregistered id resolves null → base procedural tip; 261116-inu UAT row 9 (response-tip replay) |
| 11 | A missing texture on another machine surfaces a user-visible warning (ROADMAP SC2 wording) | ? UNCERTAIN | SC2 still states a warning; `50e745a65` dropped the standing aggregate line on request and a pure cross-machine open has no catalog row, so no chip and no notice renders. Whether the drop is the final law (amend SC2) or a notice is still owed needs a human decision — see Human Verification |
| 12 | Re-importing the same texture on the other machine restores the recorded look | ✓ VERIFIED | Id is content-addressed (`wc/custom-<12 hex>`), so the recorded id resolves after import; 261116-inu UAT row 9 |
| 13 | The library is imported-only — no built-ins; retired ids resolve nowhere | ✓ VERIFIED | `resetMaskRegistry()` empty, three built-ins deleted (`762f2a9f5`); `noRetiredTextureIds.test.ts` builds the retired prefix at runtime and scans `src`, `packages/efx-watercolor/src`, `src-tauri/src`; machine scan at boot |
| 14 | Texture delete is confirmation-gated and container-scoped | ✓ VERIFIED | `PhysicsPaintTextureModal.tsx` single `pendingTextureDelete` confirmation; Delete/Backspace scope to the focused chip; `brush_library.rs` delete validates the container; 22 modal tests; UAT row 8 |
| 15 | Rotation is per-stroke integer degrees, snapshotted and carried through save, play and bake | ✓ VERIFIED | `snapshotAquarelleRecord` reads `libraryRowFor(textureId)?.textureRotation ?? 0`; AQTL v4 writes i16 hundredths with whole-degree ±180 validation; `aquarelleRecordState.restore/reopenTexture` tests; UAT rows 6/7 (37°) |
| 16 | The script carrier is metadata-only (id + rotation) and fail-closed on malformed input | ✓ VERIFIED | `pack.ts` `isTipRecord` refuses `mask`/`asset` (tolerates legacy `maskDataUrl` on read only); `scriptTimelineCodec`/`pack` tests; UAT row 7 cross-project script rotation |
| 17 | The catalog is machine-scoped — an import in one project is not listed or resolvable from another, and a registry replace leaves no ghost mask | ✓ VERIFIED | `aquarelleBrushCatalog.ts` machine-scoped rows/revision/payload; `replaceMaskRegistry` is replace-only; UAT cross-project rows |
| 18 | The retired `.mce` brush carrier, per-project mask assets and built-in tips are absent and are not resurrected | ✓ VERIFIED | `mceFieldContract.test.ts:422` declares no `.mce` root `brushPack` in either language; `models/project.rs:508-547` opens a legacy manifest and a save never re-emits it; `project_io.rs` provisions no `brushes/` tree; `noRetiredTextureIds.test.ts` |
| 19 | A corrupt catalog or unreadable entries cannot prevent the app from rendering | ✓ VERIFIED | `brush_library.rs` scan is lenient (fallible only on mutation reads); `loadBrushLibrary()` swallows scan/decode failures with `console.warn` and never rejects |
| 20 | A 4K PNG/JPG import stays responsive (SC1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Capped decode path present and wired, but no test exercises decode latency; the responsiveness claim is a runtime feel — see behavior_unverified_items |
| 21 | CR-01: a latched binding with withheld content refuses the first close and reports the withheld-save notice | ✓ VERIFIED | `PhysicsPaintStudio.tsx:4209-4240` — close gate includes `hasWithheldContent()`, refusal step sets the notice and rethrows; source pin `PhysicsPaintStudio.test.ts:4026-4028`; controller truth-table test `:1446-1458`; live 63-UAT row 8 (first close stays open, writes nothing) |
| 22 | CR-03: the close refusal is acknowledged once per latch episode, not once per window | ✗ FAILED (BLOCKER) | `closeWithheldAcknowledgedRef = useRef(false)` at `:4192` is set true at `:4237` and never reset — only occurrences 4192/4236/4237. A later refused track closes silently and its withheld script is destroyed (63-REVIEW CR-03, open critical) |
| 23 | AQTL v4 writes and v3 reads with upgrade; v1/v2 are refused with a named retirement; SNAP v1–4 retire by name | ✓ VERIFIED | `scriptTimelineCodec.ts` version word, v4 write + v3 read/upgrade (`fa25fffef`), `unsupported-version` for v1/v2; `studioScriptSnapshotCodec.ts:589` `snap-v4-retired`; codec tests |
| 24 | CR-02: the refused-restore latch clears only on the acknowledged whole-track clear | ✓ VERIFIED | `studioScriptSnapshotController.ts` `commitSave`/purge acknowledgement; WR-13 tests at `studioScriptSnapshotController.test.ts:1472,1491` ("a partial purge neither bypasses nor clears the latch", whole-track clear replaces) |
| 25 | WR-15: `hasWithheldContent()` counts only this track's withheld content | ✗ FAILED (BLOCKER) | `studioScriptSnapshotController.ts:1153-1163` returns `(bases?.size ?? 0) > 0` over the launch-scoped durable map — a foreign durable base refuses the close on an empty binding and names a destructive remedy (63-REVIEW WR-15, open warning) |
| 26 | WR-12: a deliberate format retirement is reported as a named notice, not a corrupt snapshot | ✓ VERIFIED | `studioScriptSnapshotCodec.ts` `snap-v4-retired` / inner `aqtl-retired` (v1/v2 only) surface as named outcomes and the Studio reports the notice; codec + snapshot controller tests |
| 27 | Per-stroke texture/rotation survive duplicate/clone and play-apply-bake | ✓ VERIFIED | `aquarelleStrokeSelection.ts:1043-1045` clone preserves `textureId`/`textureRotation`; `physicsPaintRotoDuplicateScript.test.ts`, `physicsPaintRotoPlayScriptApplyBake.test.ts`, `physicsPaintRotoPlayScriptController.bake.test.ts` |

**Score:** 23/27 truths verified (2 failed, 1 present-behavior-unverified, 1 uncertain; `behavior_unverified: 1`)

### Deferred Items

None. Phase 64 (Medium Engine) covers none of the failing or uncertain items; no later milestone phase owns the accepted live-vs-replay texture-sampling residual.

### Advisory (New Scope, Unevidenced)

None. CR-03 and WR-15 are carried into `gaps` with deterministic code evidence (per-line behavior), and both flagged files were git-modified after the prior `verified:` timestamp — the #3304 evidence gate does not demote them.

### Required Artifacts

`gsd_run query verify.artifacts` returned `total: 0` for 63-01/63-15/63-16 (their artifacts are declared as plain strings, not `{path}` objects), so every artifact below was verified manually at all levels (exists, substantive, wired).

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/brushes/deriveMask.ts` | 512² two-branch derivation | ✓ VERIFIED | `TIP_MASK_EDGE = 512`, `TIP_MASK_BYTES = 262,144`; total on wrong length/type |
| `packages/efx-watercolor/src/brushes/importTip.ts` | Decode path with caps | ✓ VERIFIED | 64 MB/64 MP, magic sniff, header walk, high-quality 512² downscale, named failures, single-flight queue |
| `packages/efx-watercolor/src/brushes/maskRegistry.ts` | Identity mask registry | ✓ VERIFIED | Exact-length admission; replace-only; reset is empty (no built-ins) |
| `packages/efx-watercolor/src/brushes/pack.ts` | Metadata-only script carrier | ✓ VERIFIED | `isTipRecord` refuses `mask`/`asset`; project carrier removed |
| `packages/efx-watercolor/src/playground/brushBridge.ts` | Single tip mapping | ✓ VERIFIED | `resolveMask(textureId) ?? base.tip`; `textureRotation` only with a mask |
| `packages/efx-watercolor/src/playground/brushes.ts` | `TIP_SIZE` 192 procedural only | ✓ VERIFIED | Line 122 constant; used by procedural tips, not imported masks |
| `packages/efx-watercolor/src/playground/Engine.ts` | Mipmapped tip upload | ✓ VERIFIED | Row-flipped masks, `generateMipmap`, mipmap min/mag filters |
| `app/src/main.tsx` | Boot scan before first render | ✓ VERIFIED | `await loadBrushLibrary()` before `render(<App />)` |
| `app/src/lib/brushLibrary.ts` | Scan/decode/register + degrade | ✓ VERIFIED | Per-entry catch → `unavailableTipIds`; `replaceLibraryEntries`; never rejects |
| `app/src/lib/efxPaintBrushImport.ts` | Import publish | ✓ VERIFIED | Exact `TIP_MASK_BYTES`; write then register then upsert; publish before answer |
| `app/src/stores/aquarelleBrushCatalog.ts` | Machine-scoped catalog | ✓ VERIFIED | Rows, `libraryRevision`, payload build/apply, publisher indirection |
| `app/src/lib/physicPaintBridge.ts` | Publisher install + mutations | ✓ VERIFIED | `_setBrushCatalogPublisher` at boot; delete/rotation dispatch; publisher default no-op |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Per-stroke texture/rotation | ✓ VERIFIED | Snapshot + restore + payload carry both fields |
| `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` | AQTL v4 | ✓ VERIFIED | v4 write, v3 read/upgrade, v1/v2 refuse; integer-degree validation both ways |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | Retirement notices | ✓ VERIFIED | `snap-v4-retired`, inner `aqtl-retired`; WR-14 dead fallback is info-only |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | Withheld-content gate | ✓ VERIFIED (wired) | Exists, substantive, wired; behavior defect in the durable-bases arm (truth 25) |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Close refusal | ✓ VERIFIED (wired) | Exists, substantive, wired; per-window acknowledgement defect (truth 22) |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | Import + library UI | ✓ VERIFIED | Import row, delete, unavailable chips; stale header comments (info) |
| `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` | Texture row | ✓ VERIFIED | `data-unavailable` greyed/disabled; rotation preview map; selection only when resolvable |
| `app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx` | Delete/rotation UI | ✓ VERIFIED | Single confirmation; container-scoped Delete/Backspace; integer-degree stepper; 22 tests |
| `app/src-tauri/src/commands/brush_library.rs` | Machine catalog | ✓ VERIFIED | Content-addressed write, 512 header gate, caps, rotation bounds, lenient scan; 30+ tests |
| `app/src-tauri/src/services/frame_codec.rs` | 512 mask gate | ✓ VERIFIED | `BRUSH_MASK_EDGE`/`BRUSH_MASK_BYTES`/`BRUSH_MASK_WRONG_SIZE`/`BRUSH_MASK_UNREADABLE` |
| `app/src-tauri/src/models/project.rs` | Legacy manifest tolerance | ✓ VERIFIED | Legacy `brushPack` opens; a save never re-emits it |
| `app/src/lib/noRetiredTextureIds.test.ts` / `app/src/lib/mceFieldContract.test.ts` | Retired-id + field-diff pins | ✓ VERIFIED | Runtime-built retired prefix scan (no whitelist); 20 field-contract tests incl. no root `brushPack` |

### Key Link Verification

`gsd_run query verify.key-links` reported every link `verified: false` ("Target not referenced in source") because the PLAN links are prose and the actual imports are relative (e.g. `brushBridge.ts` imports `'../brushes/maskRegistry'`). Each link was verified manually:

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `WatercolorBrushLibrary.tsx` import row | `importTip.ts` → main-realm import | `importTip(file, { decode, register: requestPhysicPaintBrushImport })` | WIRED | Decode in the Studio realm, publish through the main realm |
| `efxPaintBrushImport.ts` | `brush_library.rs` | `ipcBrushLibraryWrite(fileName, mask)` then catalog upsert + publish | WIRED | Exact 262,144-byte mask; answer after publish |
| `main.tsx` boot | `brushLibrary.ts` → Rust scan → `aquarelleBrushCatalog` | `await loadBrushLibrary()`; decode + `replaceLibraryEntries` | WIRED | Runs before first render on the main-window branch |
| `aquarelleBrushCatalog.ts` | Studio bridge | `buildBrushCatalogPayload` → publisher installed by `physicPaintBridge.ts:3325` | WIRED | Machine-scoped payload reaches the Studio child realm |
| Stroke snapshot | AQTL v4 / SNP1 → restore | `snapshotAquarelleRecord` → `scriptTimelineCodec` → restore → `brushBridge` | WIRED | Texture id + rotation survive save/play/bake |
| `PhysicsPaintTextureModal.tsx` delete/rotation | Rust mutation → catalog publish | bridge mutation dispatch (`:3457`, `:3460`) → `deleteBrushTexture` / `setBrushTextureRotation` | WIRED | Container id included; catalog republished |
| Bake path | `buildBrushForStroke` / `tipUpload` | Shared `brushBridge` resolution | WIRED | Same mask mapping live and baked |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Texture strip rows | catalog signal | Rust `catalog.json` scan → decode → `replaceLibraryEntries` | Yes | ✓ FLOWING |
| Engine tip | mask bytes | Machine-library WebP decoded to 512² (or derived mask at import) → `maskRegistry` | Yes | ✓ FLOWING |
| Stroke texture/rotation | `textureId` / `textureRotation` | Selection / restored stroke → AQTL/SNP → `brushBridge` | Yes | ✓ FLOWING |
| Rotation preview | `libraryRowFor(textureId).textureRotation` | Catalog row | Yes | ✓ FLOWING |
| Unavailable chips | `unavailableTipIds` | Per-entry decode/size failures during boot scan | Yes | ✓ FLOWING |
| Close gate | `hasWithheldContent()` | Session events + durable bases | Yes (wrong scope — WR-15) | ✓ FLOWING (defective scope) |

No rendered tip value ends in a hardcoded empty or mock path; the `?? base.tip` fallback is the intended neutral degradation, not a static stand-in.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 63 TS suites (10 targeted suite runs over the covered test files) | `pnpm vitest run <phase 63 suites>` | 930 tests passed across the 10 runs (130/113/86/53/89/114/50/80/29/186), 0 failed | ✓ PASS |
| Rust brush-library + frame-codec module tests | `cargo test` (filtered to the phase modules) | 46 passed, 0 failed, 120 filtered out | ✓ PASS |
| CR-01 withheld-content truth-table test exists | `grep -n "hasWithheldContent" studioScriptSnapshotController.test.ts` | Named test at `:1446-1458` (latched-but-empty → false; latched+content → true) | ✓ PASS (exists; suite green) |
| WR-13 partial-purge law tests exist | `grep -n "WR-13" studioScriptSnapshotController.test.ts` | `:1472` partial purge neither bypasses nor clears; `:1491` whole-track clear replaces | ✓ PASS (exists; suite green) |
| Close gate source pin | `grep -n "withheld" PhysicsPaintStudio.test.ts` | `:4026-4028` asserts the close path includes `|| studioScriptSnapshot.hasWithheldContent(),` | ✓ PASS (source-level only) |
| CR-03 per-episode acknowledgement | inspected `closeWithheldAcknowledgedRef` | Ref set once, never reset | ✗ FAIL (truth 22) |
| WR-15 cross-track bases | inspected `hasWithheldContent()` | Unfiltered launch-scoped map | ✗ FAIL (truth 25) |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| None | `find scripts -path '*/tests/probe-*.sh'`; grep of Phase 63 PLAN/SUMMARY for probe paths | No probe files exist and none is declared by Phase 63; the 261116-rp ink-parity probe is quick-scoped and needs the app/CDP runtime | N/A |

### Requirements Coverage

All 17 TIP IDs are declared across the phase plans (`63-01`..`63-16`) and mapped to Phase 63 in REQUIREMENTS.md. No orphaned requirements (MED-01..18 belong to Phase 64 and no plan claims them).

| Requirement | Source Plan(s) | Description | Verdict | Evidence |
| ----------- | -------------- | ----------- | ------- | -------- |
| TIP-01 | 63-05, 63-06, 63-12 | Imported image becomes the actual tip; selecting visibly changes the footprint | pass | Truth 1; UAT row 4 |
| TIP-02 | 63-01, 63-05 | Derived tip size/byte count and one import-time derivation | superseded — quick 261116-inu (`762f2a9f5`, `27aad8b34`): imported masks are 512×512 (262,144 bytes); `TIP_SIZE` 192 remains for procedural tips only (`brushes.ts:122`); the single high-quality import-time derivation survives | Truths 1/2; 261116-inu UAT row 4 |
| TIP-03 | 63-01 | One pinned two-branch mask derivation, tested and documented | pass | Truth 2 |
| TIP-04 | 63-05, 63-14 | 64 MP refusal before decode; corrupt-with-header refusal without crash | pass | Truth 3 |
| TIP-05 | 63-01, 63-12 | `buildBrushForStroke` is the single live/bake mapping | pass | Truth 7 |
| TIP-06 | 63-01, 63-05, 63-06, 63-13 | Registry fed by the import surface; reset leaves no ghost mask | superseded — quick 261116-inu (`27aad8b34`, `762f2a9f5`): the registry is machine-scoped and replaced wholesale; a reset/rescan leaves no ghost mask (truth 17) | Truth 17 |
| TIP-07 | 63-07, 63-11 | Imported tip survives save → quit → relaunch → open | superseded — quick 261116-inu (`87247fa9b`, `27aad8b34`): reproduction comes from the machine library, not from the `.mce`; save/relaunch/replay still holds (truth 6; UAT row 6) | Truth 6 |
| TIP-08 | 63-02, 63-04, 63-14 | Lossless content-addressed mask asset; copy the stored bytes, never re-encode | superseded — quick 261116-inu (`87247fa9b`, `762f2a9f5`): the asset now lives in the machine library as `<sha256>.webp`; the content-addressing / exact-byte / no-re-encode law survives (truth 4) | Truth 4 |
| TIP-09 | 63-02, 63-04, 63-14 | No tip depends on the source image; source is disposable | superseded — quick 261116-inu: the source image is still discarded and only the derived mask is stored; the tip now depends on the machine library, not the project package (truths 4, 8) | Truths 4, 8 |
| TIP-10 | 63-02, 63-05, 63-06, 63-07, 63-14 | Both import caps; a bad stored asset degrades to an unavailable tip + fallback + exactly one aggregate warning | superseded — quick 261116-inu (`50e745a65`, `762f2a9f5`): caps and per-asset degradation survive (truths 3, 9); the standing aggregate warning line was dropped on request; the residual SC2 "warning" wording is the uncertain item (truth 11) | Truths 3, 9, 11 |
| TIP-11 | 63-04, 63-10 | Brush pack in the `.mce` root with package-relative mask refs | superseded — quick 261116-inu (`87247fa9b`): the `.mce` root `brushPack` is removed in both languages (`mceFieldContract.test.ts:422`) | Truth 18 |
| TIP-12 | 63-07, 63-10 | Masks decoded and registered before the first replay | superseded — quick 261116-inu (`27aad8b34`): registration moved to the app-start boot scan, before the first render (truth 5) | Truth 5 |
| TIP-13 | 63-03, 63-06, 63-13 | Three built-in textured tips ship | superseded — quick 261116-inu (`762f2a9f5`): the three built-ins are deleted; the library is imported-only (truth 13) | Truth 13 |
| TIP-14 | 63-08, 63-11, 63-15, 63-16 | A roto script carries its tip's mask and rehydrates it on load | superseded — quick 261116-inu (`9ad60a9e2`): the script carrier is metadata-only (id + rotation); a missing texture replays with the response tip, and re-importing the same texture restores the look (truths 10, 12, 16; UAT rows 7, 9) | Truths 10, 12, 16 |
| TIP-15 | 63-04, 63-10 | `buildBrushPackSnapshot` is the one entry-shape authority, total and fail-closed | superseded — quick 261116-inu (`9ad60a9e2`): the project-level snapshot producer is removed; the script carrier's producer/validator remains metadata-only and fail-closed (`pack.ts`) | Truth 16 |
| TIP-16 | 63-04, 63-09, 63-10 | Untouched-project byte identity, mask bytes included | superseded — quick 261116-inu: no brush bytes live in the `.mce` any more, so the mask-asset clause no longer applies; the untouched-project round-trip is covered by the existing package suites | Truth 18 |
| TIP-17 | 63-07, 63-10 | Opening replaces the catalog/registry with the project's entries plus built-ins | superseded — quick 261116-inu (`27aad8b34`, `762f2a9f5`): catalogs are machine-scoped, built-ins are gone; project A's import is not listed or resolvable in project B (truth 17) | Truth 17 |

**No TIP ID is a gap.** Every surviving clause (TIP-01, TIP-03, TIP-04, TIP-05, plus the surviving parts of TIP-02/06..17) is verified above; every retired clause is attributed to quick 261116-inu and its commits.

**ROADMAP success-criteria alignment:** SC1 → truths 1-4, 20; SC2 → truths 6, 7, 10, 11 (uncertain), 12; SC3 → truths 13, 19; SC4 → truths 9, 14; SC5 → truths 15, 16, 17.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | 24-35, 107 | Stale comments: "one 192×192 mask", "exactly ONE aggregate warning line (63-06 D-19)", "project catalog" | ℹ️ Info | Misleading docs; the runtime honors the amended law (per-chip surface, machine catalog) |
| `app/src/lib/ipc.ts` | 686, 693, 774, 775 | Stale "36,864-byte 192×192" comments | ℹ️ Info | Comments only |
| `app/src/types/physicPaint.ts` / `app/src/lib/physicPaintBridge.ts` | 2481 / 153 | Stale "derives the 36,864-byte mask" comments | ℹ️ Info | Comments only |
| `app/src/lib/efxPaintPersistence.ts` | 8 | Stale header: "one `brushes/<sha256>.webp` mask asset per pending brush tip" | ℹ️ Info | Code below is retired; comment only |
| `app/src-tauri/src/services/project_io.rs` | 13-17 | Stale: "a new project carries only the three compile-time built-in tips" | ℹ️ Info | Comment only; no `brushes/` provisioning (correct) |
| `app/src/lib/ipc.ts` + `app/src-tauri/src/lib.rs` | 697, 719, 741, 778 / 973-976 | Dead IPC wrappers whose Rust commands are still registered | ℹ️ Info | Dead code; not a stub of a required behavior |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | 637-642 | Dead short-body fallback in the AQTL version read (WR-14) | ℹ️ Info | Unreachable branch |
| `.planning/ROADMAP.md` | 214 | Progress row says "16/16 · In Progress" while line 107 marks the phase completed | ℹ️ Info | Bookkeeping inconsistency |
| `.planning/phases/63-brush-tip-pipeline/63-REVIEW-DISPOSITION.md` | all | 34 findings still `open` (incl. CR-03 critical, WR-15 warning) | ⚠️ Warning | Recorded, untriaged; CR-03/WR-15 appear above as gaps |
| 261116-inu declared residual | — | Short textured strokes can differ slightly live vs replay (tick sampling) | ℹ️ Info (accepted) | Declared loss; replay-fidelity work, no later phase owns it |
| Debt-marker gate | — | No `TBD`/`FIXME`/`XXX` in Phase 63 source trees (only a docs placeholder URL in `app/src/lib/shaders/SHADER-SPEC.md:55`) | — | Gate clean |

### Review Findings (63-REVIEW.md) Disposition

| Finding | Severity | Disposition in this verification |
| ------- | -------- | -------------------------------- |
| CR-01 | critical | Verified closed — truth 21; 63-UAT row 8; source pin + controller truth-table test |
| CR-02 | critical | Verified — truth 24 (refused-restore latch clears only on the acknowledged whole-track clear) |
| CR-03 | critical | **Open gap** — truth 22 (per-window acknowledgement) |
| WR-12 | warning | Verified — truth 26 (named `snap-v4-retired` / `aqtl-retired` notices) |
| WR-13 | warning | Verified closed — partial purge neither bypasses nor clears the latch; whole-track clear test (`studioScriptSnapshotController.test.ts:1472,1491`) |
| WR-14 | warning | Info — dead short-body fallback, no behavioral impact |
| WR-15 | warning | **Open gap** — truth 25 (cross-track durable bases) |
| IN-01, IN-10..IN-16 | info | Info — recorded; not must-have blocking (unreachable latch release, `mutationId` u32 truncation, dead `getIdentity`, untested foreign-base guard, `persistAfterPurge` invariant, dead rotation validation, AQTL header unit law, encode-refusal reported as IO) |
| All other carried findings (WR-01..WR-11 except WR-12, IN-02..IN-09) | warning/info | Remaining `open` in the disposition; not re-reported by the current review, and this refresh collected no fresh failure evidence for them |

### Human Verification Required

#### 1. Cross-machine missing-texture warning surface (SC2 decision)

**Test:** Open a project (or apply a script) whose strokes reference a texture the machine library lacks, with no catalog row for it, and observe the Studio.
**Expected:** A decision, not a code check — either confirm the silent response-tip fallback is the final intent (and amend ROADMAP SC2's "a warning" clause), or specify the notice that must render.
**Why human:** SC2 still promises a warning, while the standing aggregate line was deliberately dropped on request (`50e745a65`); the documents conflict and only a human can settle which is law. This truth is scored UNCERTAIN, not a gap.

#### 2. 4K import responsiveness

**Test:** Import a 4096×4096 JPG on a cold Studio and drag the canvas during the import.
**Expected:** The import resolves promptly (SC1 "4K responsive") with no multi-second UI freeze.
**Why human:** The capped decode path is present and wired, but no automated test exercises decode latency; responsiveness is a runtime feel. This is the single present-behavior-unverified truth and is not counted as verified.

### Gaps Summary

Two must-have truths fail, both in the withheld-save close/settlement path and both deterministic:

1. **CR-03 (truth 22, blocker).** `PhysicsPaintStudio.tsx` acknowledges the withheld-close refusal with a per-window ref (`:4192`, set `:4237`, never reset). The first latch episode is safe, but a later refused track in the same Studio window closes silently and destroys its withheld script — the exact data loss CR-01 was meant to prevent. The review's fix sketch (a controller `withheldEpisode()` counter) is the basis for closure.
2. **WR-15 (truth 25, blocker).** `hasWithheldContent()` counts the launch-scoped durable-bases map without filtering to this track's key ids (`studioScriptSnapshotController.ts:1153-1163`), so another track's durable base makes a latched-but-empty binding refuse the close and name a destructive remedy.

Everything under the amended import/storage/replay law passes: 512×512 derivation and storage, boot scan, machine-scoped catalog, per-stroke texture/rotation through AQTL v4, metadata-only script carrier, unavailable-tip degradation, confirm-gated delete and retired-id absence. All 17 TIP IDs are accounted for: TIP-01/03/04/05 pass; the rest are superseded by quick 261116-inu (UAT-approved 2026-11-16) with the surviving clauses verified. One truth is present-but-behavior-unverified (4K responsiveness) and one requirement clause is uncertain (SC2's warning surface) pending a human decision. No deferred items; Phase 64 (Medium Engine) covers none of these.

---

_Verified: 2026-11-17T10:33:27Z_
_Verifier: Claude (gsd-verifier)_
