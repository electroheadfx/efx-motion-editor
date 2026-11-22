---
phase: 64-medium-engine
verified: 2026-11-22T13:46:23Z
status: gaps_found
score: 143/174 must-haves verified
covered_files: [".planning/phases/64-medium-engine/64-01-PLAN.md",".planning/phases/64-medium-engine/64-01-SUMMARY.md",".planning/phases/64-medium-engine/64-02-PLAN.md",".planning/phases/64-medium-engine/64-02-SUMMARY.md",".planning/phases/64-medium-engine/64-03-PLAN.md",".planning/phases/64-medium-engine/64-03-SUMMARY.md",".planning/phases/64-medium-engine/64-04-PLAN.md",".planning/phases/64-medium-engine/64-04-SUMMARY.md",".planning/phases/64-medium-engine/64-05-PLAN.md",".planning/phases/64-medium-engine/64-05-SUMMARY.md",".planning/phases/64-medium-engine/64-06-PLAN.md",".planning/phases/64-medium-engine/64-06-SUMMARY.md",".planning/phases/64-medium-engine/64-07-PLAN.md",".planning/phases/64-medium-engine/64-07-SUMMARY.md",".planning/phases/64-medium-engine/64-08-PLAN.md",".planning/phases/64-medium-engine/64-08-SUMMARY.md",".planning/phases/64-medium-engine/64-09-PLAN.md",".planning/phases/64-medium-engine/64-09-SUMMARY.md",".planning/phases/64-medium-engine/64-10-PLAN.md",".planning/phases/64-medium-engine/64-10-SUMMARY.md",".planning/phases/64-medium-engine/64-11-PLAN.md",".planning/phases/64-medium-engine/64-11-SUMMARY.md",".planning/phases/64-medium-engine/64-12-PLAN.md",".planning/phases/64-medium-engine/64-12-SUMMARY.md",".planning/phases/64-medium-engine/64-13-PLAN.md",".planning/phases/64-medium-engine/64-13-SUMMARY.md",".planning/phases/64-medium-engine/64-14-PLAN.md",".planning/phases/64-medium-engine/64-14-SUMMARY.md",".planning/phases/64-medium-engine/64-15-PLAN.md",".planning/phases/64-medium-engine/64-15-SUMMARY.md",".planning/phases/64-medium-engine/64-16-PLAN.md",".planning/phases/64-medium-engine/64-16-SUMMARY.md",".planning/phases/64-medium-engine/64-17-PLAN.md",".planning/phases/64-medium-engine/64-17-SUMMARY.md",".planning/phases/64-medium-engine/64-18-PLAN.md",".planning/phases/64-medium-engine/64-18-SUMMARY.md",".planning/phases/64-medium-engine/64-19-PLAN.md",".planning/phases/64-medium-engine/64-19-SUMMARY.md",".planning/phases/64-medium-engine/64-20-PLAN.md",".planning/phases/64-medium-engine/64-20-SUMMARY.md",".planning/phases/64-medium-engine/64-21-PLAN.md",".planning/phases/64-medium-engine/64-21-SUMMARY.md",".planning/phases/64-medium-engine/64-22-PLAN.md",".planning/phases/64-medium-engine/64-22-SUMMARY.md",".planning/phases/64-medium-engine/64-23-PLAN.md",".planning/phases/64-medium-engine/64-23-SUMMARY.md",".planning/phases/64-medium-engine/64-24-PLAN.md",".planning/phases/64-medium-engine/64-24-SUMMARY.md","app/src-tauri/src/models/project.rs","app/src/components/physic-paint/PhysicsPaintStudio.test.ts","app/src/components/physic-paint/PhysicsPaintStudio.tsx","app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx","app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx","app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.runtime.test.ts","app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx","app/src/components/physic-paint/engine/aquarelleEnginePort.ts","app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts","app/src/components/physic-paint/engine/aquarelleLiftEngineContract.test.ts","app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts","app/src/components/physic-paint/engine/committedFrameRelight.test.ts","app/src/components/physic-paint/engine/committedFrameRelight.ts","app/src/components/physic-paint/engine/documentLightGesture.test.ts","app/src/components/physic-paint/engine/documentLightGesture.ts","app/src/components/physic-paint/engine/paintMutationLedger.test.ts","app/src/components/physic-paint/engine/paintMutationLedger.ts","app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts","app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts","app/src/components/physic-paint/hooks/rotoReferenceOnlyTolerance.test.ts","app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts","app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts","app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts","app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts","app/src/components/physic-paint/performance/scriptTimelineCodec.ts","app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts","app/src/components/physic-paint/roto/aquarelleFrameBytes.test.ts","app/src/components/physic-paint/roto/aquarelleFrameBytes.ts","app/src/components/physic-paint/roto/aquarelleLiftErase.ts","app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts","app/src/components/physic-paint/roto/aquarelleLiftPreview.test.ts","app/src/components/physic-paint/roto/aquarelleLiftPreview.ts","app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts","app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts","app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts","app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts","app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts","app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts","app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts","app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts","app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx","app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx","app/src/components/physic-paint/view/AquarelleToolRow.test.tsx","app/src/components/physic-paint/view/AquarelleToolRow.tsx","app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts","app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx","app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts","app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts","app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts","app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx","app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts","app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts","app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts","app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx","app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts","app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx","app/src/components/physic-paint/view/RightPanelPaperTab.tsx","app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts","app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx","app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts","app/src/components/physic-paint/view/aquarellePaintControls.test.ts","app/src/components/physic-paint/view/aquarellePaintControls.ts","app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts","app/src/components/physic-paint/view/aquarelleParamVisibility.ts","app/src/components/physic-paint/view/aquarellePresetSelection.test.ts","app/src/components/physic-paint/view/aquarelleRecordState.test.ts","app/src/components/physic-paint/view/aquarelleRecordState.ts","app/src/components/physic-paint/view/aquarelleStrokeBand.ts","app/src/components/physic-paint/view/aquarelleToolFamily.test.ts","app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts","app/src/components/physic-paint/view/aquarelleWetPaintGate.ts","app/src/components/physic-paint/view/brushGroupMedium.test.ts","app/src/components/physic-paint/view/brushGroups.test.ts","app/src/components/physic-paint/view/brushMenuPresets.ts","app/src/components/physic-paint/view/brushToolFamily.test.ts","app/src/components/physic-paint/view/brushToolFamily.ts","app/src/components/physic-paint/view/mediumSelection.test.ts","app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts","app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts","app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts","app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts","app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts","app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts","app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts","app/src/components/physic-paint/view/scriptStrokeEdition.ts","app/src/components/physic-paint/view/strokeSettingsModel.test.ts","app/src/components/physic-paint/view/strokeSettingsModel.ts","app/src/components/physic-paint/view/vectorPathSession.test.ts","app/src/efx-paint/document/efxPaintDocument.ts","app/src/efx-paint/document/efxPaintDocumentParsers.ts","app/src/efx-paint/document/efxPaintDocumentRevision.ts","app/src/efx-paint/document/paintDocumentLight.test.ts","app/src/efx-paint/document/paintDocumentPaperSeed.test.ts","app/src/lib/mceFieldContract.test.ts","app/src/lib/physicPaintBridge.launchPackBytes.test.ts","app/src/stores/efxPaintStore.ts","app/src/stores/physicPaintStore.ts","app/src/types/project.ts","app/src/viteBuild.test.ts","packages/efx-watercolor/probe/chalk-deposit/probe.ts","packages/efx-watercolor/probe/chalk-deposit/run.mjs","packages/efx-watercolor/probe/long-stroke/probe.ts","packages/efx-watercolor/probe/long-stroke/run.mjs","packages/efx-watercolor/probe/medium-engine/.gitignore","packages/efx-watercolor/probe/medium-engine/baselines/cover-advect.json","packages/efx-watercolor/probe/medium-engine/baselines/cover-lift.json","packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-prefix.json","packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-subtract.json","packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json","packages/efx-watercolor/probe/medium-engine/baselines/cover-textured.json","packages/efx-watercolor/probe/medium-engine/baselines/neutral-identity.json","packages/efx-watercolor/probe/medium-engine/baselines/neutral-pigment.json","packages/efx-watercolor/probe/medium-engine/baselines/red-over-blue-50.json","packages/efx-watercolor/probe/medium-engine/baselines/watercolor-50.json","packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json","packages/efx-watercolor/probe/medium-engine/compare.mjs","packages/efx-watercolor/probe/medium-engine/harness.test.ts","packages/efx-watercolor/probe/medium-engine/index.html","packages/efx-watercolor/probe/medium-engine/probe.ts","packages/efx-watercolor/probe/medium-engine/run.mjs","packages/efx-watercolor/probe/pickup-collapse/probe.ts","packages/efx-watercolor/probe/pickup-collapse/run.mjs","packages/efx-watercolor/probe/port-comparison/bristle-records.mjs","packages/efx-watercolor/probe/port-comparison/compose.mjs","packages/efx-watercolor/probe/port-comparison/metrics.test.ts","packages/efx-watercolor/probe/port-comparison/metrics.ts","packages/efx-watercolor/probe/port-comparison/probe.ts","packages/efx-watercolor/probe/port-comparison/reference.mjs","packages/efx-watercolor/probe/port-comparison/run.mjs","packages/efx-watercolor/probe/small-brush/probe.ts","packages/efx-watercolor/probe/small-brush/run.mjs","packages/efx-watercolor/src/adapter/engineAdapter.test.ts","packages/efx-watercolor/src/adapter/engineAdapter.ts","packages/efx-watercolor/src/bake/aquarelleBake.test.ts","packages/efx-watercolor/src/bake/aquarelleBake.ts","packages/efx-watercolor/src/bake/aquarelleSeed.ts","packages/efx-watercolor/src/determinismContract.test.ts","packages/efx-watercolor/src/engine/deposit.ts","packages/efx-watercolor/src/engine/fluid.test.ts","packages/efx-watercolor/src/index.ts","packages/efx-watercolor/src/payload/toStudioStroke.test.ts","packages/efx-watercolor/src/payload/toStudioStroke.ts","packages/efx-watercolor/src/playground/Engine.ts","packages/efx-watercolor/src/playground/bristles.test.ts","packages/efx-watercolor/src/playground/bristles.ts","packages/efx-watercolor/src/playground/brushes.test.ts","packages/efx-watercolor/src/playground/brushes.ts","packages/efx-watercolor/src/playground/coverage.test.ts","packages/efx-watercolor/src/playground/coverageLifecycle.test.ts","packages/efx-watercolor/src/playground/dryMedia.test.ts","packages/efx-watercolor/src/playground/emboss.test.ts","packages/efx-watercolor/src/playground/engineStartDwell.test.ts","packages/efx-watercolor/src/playground/engineTipIdentity.test.ts","packages/efx-watercolor/src/playground/engineTraceSpacing.test.ts","packages/efx-watercolor/src/playground/gl.ts","packages/efx-watercolor/src/playground/index.ts","packages/efx-watercolor/src/playground/kmBand.test.ts","packages/efx-watercolor/src/playground/lastTouch.test.ts","packages/efx-watercolor/src/playground/liveSeed.test.ts","packages/efx-watercolor/src/playground/mediums.test.ts","packages/efx-watercolor/src/playground/mediums.ts","packages/efx-watercolor/src/playground/paperSeed.test.ts","packages/efx-watercolor/src/playground/params.test.ts","packages/efx-watercolor/src/playground/params.ts","packages/efx-watercolor/src/playground/relief.test.ts","packages/efx-watercolor/src/playground/scattering.test.ts","packages/efx-watercolor/src/playground/scattering.ts","packages/efx-watercolor/src/playground/shaders.test.ts","packages/efx-watercolor/src/playground/shaders.ts","packages/efx-watercolor/src/playground/spectral.ts","packages/efx-watercolor/src/playground/viscosity.test.ts"]
covered_digest: "v4:sha256:4d7243dfcf792492d9a1f14a67fb419d6993a593eb8487ba32cde40ae025b9e1"
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 147/150
  previous_covered_digest: "v4:sha256:157591d985a5d9875c8930e585dab25fc39a22d02cfde3e9f21f8abbd48b9cc3"
  previous_covered_plans: "64-01..64-20 only"
  gaps_closed: []
  gaps_remaining:
    - "64-03 truth 8 — undo/redo restores the thickness field exactly (behavior-unverified)"
    - "64-03 truth 11 — replay rebuilds thickness from the stroke script alone (behavior-unverified)"
    - "64-04 truth 6 — fixed document-space gradient prevents zoom shimmer (behavior-unverified)"
  regressions:
    - "CR-03 — the 64-24 last-touch ping-pong reverts the field outside the current dab (64-24 truth 3 FAILED)"
    - "CR-04 — the coverage-composite white-fill inverts the merge law and wipes the committed base (64-15 truths 2/4 FAILED)"
    - "12 of 15 committed probe gates now FAIL (identity of the Body>0 and bristle sets, plus every coverage-alpha invariant)"
    - "The Body row was removed from the Paint panel (64-06 truth 1, MED-19)"
    - "Emboss slider capped at 15, not 0..100 (64-04 truth 5)"
    - "WR-04 — a committed-frame relight refused during playback/draft/wireframe is permanently dropped (64-19 truth 2)"
gaps:
  - truth: "64-15 truth 2 — The commit consumes the coverage sheet end to end ('pigment' export, eager, mergeBlend 'pigment-alpha')"
    status: failed
    reason: "Replaced by the coverage-composite merge (2026-11-21, commit 14bb73f77) and that replacement is broken (CR-04): exportCoverageCanvas writes cover into RGB AND alpha; scratchOf white-fills the coverage raster, so source-over yields observed red = 255(1−cover+cover²); the merge then reads that as cover. At cover 0 the exponent becomes 1−255/255 = 0 and the committed base is replaced by the sheet (paper white) everywhere the new stroke did not paint. At cover 0.5 the exponent is 0.25 instead of 0.5. Reachable: a fresh key opens with aquarelleSheetSeeded=false and a non-null cached base. The unit test seeds scratch pixels directly (drawImage is a no-op), so it cannot see it."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts"
        issue: "scratchOf() white-fills the coverage raster (lines 116-128); cov = c[i] reads the inflated red; b[i+3] = 255"
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "merges with 'coverage-composite' + coverageCanvas at 10300/10321"
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts"
        issue: "PixelContext.drawImage() is a no-op; the production compositor path is never modelled"
    missing:
      - "Draw the coverage raster onto a TRANSPARENT scratch (no white fill), or read it directly, so red stays = cover"
      - "Add a regression that composites a real RGBA coverage raster (alpha = cover) and asserts cover 0 keeps the base"
  - truth: "64-15 truth 4 — Committed alpha at a coverage pixel is the engine's coverage alpha"
    status: failed
    reason: "The coverage-composite merge sets b[i+3] = 255 unconditionally, so the committed payload's alpha is opaque, not coverage-derived. The 2026-11-21 display amendment (mode-4 alpha is darkness-only, alpha = 1−min(t)) removes the coverage claim from the pigment export as well."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts"
        issue: "b[i+3] = 255; no coverage-derived alpha"
      - path: "packages/efx-watercolor/src/playground/shaders.ts"
        issue: "mode-4 alpha = clamp(1.0 - tMin); the coverage-alpha law survives only in the live underlay branch"
    missing:
      - "Re-establish an alpha law that matches the committed merge and the screen, or amend the plan/requirement text to the darkness-only law and re-author the probes"
  - truth: "64-24 truth 3 — Each bristle dab refreshes the last-touch field AFTER its deposit, weighted by cover and bounded by the dab amount, so a later dab reads the age of the paint it crosses"
    status: failed
    reason: "CR-03 confirmed in source: bristleTouch draws a scissored dab rect into lastTouch.write reading lastTouch.read and swaps, but DoubleTarget halves are independent textures (gl.ts double() creates two targets; swap() only swaps references) and nothing copies read into write. Every texel outside the dab rect reverts to its value from two stamps earlier, so the field's memory rolls back on every dab. The docstring at Engine.ts:3553-3560 ('Texels outside the dab rect keep their age untouched') is false. bristleTouchFS reads only the cover channel as weight; uAmount is declared and uploaded but unused (IN-04), so the documented amount bound does not exist either."
    artifacts:
      - path: "packages/efx-watercolor/src/playground/Engine.ts"
        issue: "bristleTouch (3561-3576): no read→write carry before the scissored draw"
      - path: "packages/efx-watercolor/src/playground/gl.ts"
        issue: "double() halves are independent; swap() swaps references only"
      - path: "packages/efx-watercolor/src/playground/shaders.ts"
        issue: "bristleTouchFS weight = clamp(cover); uAmount unused"
    missing:
      - "Preserve read→write (full-document blit, or the union of dab rects stamped since the last capture) before the scissored stamp"
      - "Add a gate that stamps two non-overlapping dabs and asserts the first dab's age survives the second"
  - truth: "64-04 truth 5 — Emboss is the globals row on 0..100 via the one mapping"
    status: failed
    reason: "Post-UAT the Emboss slider is capped at 15 (EMBOSS_MAX = 15, aquarelleParamVisibility.ts:90; comment: 'emboss relief is very hard above 15'). The row exists and maps through the one mapping, but not on 0..100."
    artifacts:
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
        issue: "EMBOSS_MAX = 15"
    missing:
      - "Either restore the 0..100 row or record the artist's cap as an amendment to the plan/requirement text"
  - truth: "64-06 truth 1 — Body row between Viscosity and Emboss; default 0"
    status: failed
    reason: "Quick 261121-mtu removed the Body row entirely: 'body has no row anywhere (bag-only, Reset-only)' (aquarelleParamVisibility.ts:29) and a test pins that no row key is 'body'. Body is now reachable only through medium selection. MED-19 explicitly requires Body exposed as a row in the existing globals panel, and roadmap SC5 describes the user setting Body high / Body 50."
    artifacts:
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
        issue: "AQUARELLE_PARAM_ROWS has no body row"
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts"
        issue: "pins 'never gives body, wetSeconds or size a row'"
    missing:
      - "Restore the Body row, or obtain an explicit amendment of MED-19/SC5 and the plan truth"
  - truth: "64-22 truth 3 — The Body cover pass for a bristle response is bristle-modulated and writes fixed (alpha-shaped) and relief (LINEAR) on the gather mask"
    status: failed
    reason: "The D-21 Body erode pass is deleted for bristle responses (bristleBodyCoverFS pinned absent; coverPass is skipped when !bristle, Engine.ts stamp()). The current dab law (2026-11-21) attenuates ink AND fixed by (1−a) inside bristleInk, Body-independent ('Body does not appear in this draw'), and thickness is deposited by bristleReliefFS rather than eroded. The written truth no longer describes the shipped law."
    artifacts:
      - path: "packages/efx-watercolor/src/playground/Engine.ts"
        issue: "coverPass skipped for bristle responses; bristleInk draws 1/1b attenuate ink+fixed regardless of Body"
      - path: "packages/efx-watercolor/src/playground/shaders.ts"
        issue: "bristleBodyCoverFS removed; third gather consumer is bristleReliefFS"
    missing:
      - "Reconcile the plan truth/prohibition text with the shipped dab law (delivery-law amendment), or restore the Body-modulated cover pass"
  - truth: "64-22 truth 4 — Feather/Pickup/Refill are canonical globals in the Paint tab in the thirteen-row order (Feather after Body, Pickup then Refill after Feather, Emboss last), and Feather widens the gather's softness band (0.09 + 0.25·feather)"
    status: failed
    reason: "Row law changed: no Body row; emboss is second, not last; pickup/refill precede feather; pickup is hidden for watercolor and refill for watercolor/acrylic (quick 261121-mtu). gatherSoftness(_feather) returns the constant BRISTLE_SOFTNESS (0.09) — 'Feather never widens it (that was the inversion)' (commit 5b0cad17f), so the widening clause is false; the bristle-edge census confirms it (Feather 100 narrower than Feather 0)."
    artifacts:
      - path: "packages/efx-watercolor/src/playground/bristles.ts"
        issue: "gatherSoftness ignores feather"
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
        issue: "13 rows with a different order; body absent; pickup/refill hidden per medium"
    missing:
      - "Amend the plan truth to the artist's row law and softness constant, or restore the written behaviour"
  - truth: "64-22 truth 5 / 64-23 truth 6 / 64-21 truth 5 — Every non-bristle response is byte-identical; the identity gates reproduce their committed baselines"
    status: failed
    reason: "The committed gates for white-over-blue, red-over-blue-50, cover-advect, cover-lift, cover-over-wet and cover-textured all FAIL on digestPigment and/or their scenario invariants (12 of 15 gates red in this run). The drift is caused by the 2026-11-21 display-alpha amendment plus later acrylic/bristle commits that were never re-baselined. The claims are false against the committed baselines."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/*.json"
        issue: "cover-* and red/white-over-blue baselines captured 2026-11-18 (7ca0c63d2), before the alpha amendment"
      - path: "packages/efx-watercolor/probe/medium-engine/compare.mjs"
        issue: "invariants still assert coverage-derived alpha (crossCoverAlpha / coverAlpha*), which the pigment export no longer carries"
    missing:
      - "Re-author the affected baselines and invariants to the shipped alpha law, or restore the coverage-alpha law"
  - truth: "64-23 truth 5 — The bristle-edge census proves Feather 100 is wider than Feather 0 with non-zero directional variation and width below half-width"
    status: failed
    reason: "Deterministic gate failure: 'INVARIANT edgeSoftnessPxFeather100 1.87 is not wider than edgeSoftnessPxFeather0 20.27 (Feather is not widening the band)'. The census direction is inverted relative to its own invariant."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/bristle-edge-1080.json"
        issue: "captured 2026-11-19; current capture fails the relation invariant"
    missing:
      - "Fix the feather/edge law so the census direction holds, or re-specify the census invariant with the artist's ruling"
  - truth: "64-24 truth 6 — Every non-bristle render is byte-identical and the four bristle gates are re-authored from verified pairs plus a bristle-wet proof"
    status: failed
    reason: "All four bristle gates FAIL: bristle-body0-1080, bristle-body100-1080, bristle-round-body0-1080, bristle-body100-2048 each report 4 differing digests and 'coverAlphaCoveredFraction 0 is outside [0.02, 0.80]'; bristle-wet-1080 fails with 4 differing digests. The non-bristle identity set is also red (see above)."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/bristle-*.json"
        issue: "captured 2026-11-19, before the 2026-11-21/22 alpha and acrylic commits"
    missing:
      - "Re-author the four bristle baselines and the wet proof after the alpha/acrylic law settles"
  - truth: "64-19 truth 2 — The visible committed frame is re-baked with the new light exactly once per gesture"
    status: failed
    reason: "WR-04 confirmed: the relight runner returns false while playing, in draft mode or in wireframe; the single-flight grants one immediate follow-up that also returns false while the state persists; nothing re-requests on the idle edge (settle() has no caller anywhere), so a light commit made during playback is permanently dropped until an unrelated trigger."
    artifacts:
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "refusal guards at the relight runner; no idle-edge re-request"
      - path: "app/src/components/physic-paint/engine/committedFrameRelight.ts"
        issue: "single follow-up budget is consumed by a persistent refusal; settle() unused"
    missing:
      - "Re-request on the playing/draft/wireframe → idle edge while the light signature still differs, or do not consume the follow-up on a refusal"
  - truth: "Roadmap SC5 / MED-19 — Body is a user-facing order term; a light pigment covers and lightens a dark one, Body 50 lightens without erasing"
    status: failed
    reason: "No Body row (above), the Body-100 white-over-blue gate fails both alpha bars, and the Body-60 bar fails (gap 0 < 0.04). The phase's own UAT files this twice: row 12 says Body 'behaves as a transparency/coverage term, the rim is a hard line, and a pale halo outlines every bristle stroke'."
    artifacts:
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
        issue: "no Body row"
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json"
        issue: "crossCoverAlpha 0.05, gap 0; Body 60 gap 0"
    missing:
      - "Make Body a real order term with a visible control, and re-prove the crossing bars"
  - truth: "Roadmap SC7 / MED-18 / MED-25 / MED-38 — Export matches the screen on every uMode path; undo restores the eroded pigment and thickness exactly"
    status: failed
    reason: "CR-04 breaks the committed result (base wiped outside the new stroke). The mode-4 pigment export no longer carries coverage (darkness-only alpha), so export/screen parity is not demonstrated on the committed path; the probe gates that assert it are red. Undo of the eroded pools remains structurally pinned only (behavior-unverified, carried)."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts"
        issue: "CR-04 base wipe"
      - path: "packages/efx-watercolor/src/playground/shaders.ts"
        issue: "mode-4 alpha is darkness-only; live underlay law differs"
    missing:
      - "Fix CR-04; re-establish and re-gate the export/screen parity contract"
  - truth: "64-02 truth 3 — The five built-ins cover exactly the ten medium keys"
    status: failed
    reason: "The medium key set is now fourteen (64-22 added feather, pickup, refill, wetSeconds) and the canonical global set is sixteen keys. The five records exist over the canonical set, but not over 'exactly the ten medium keys' as written."
    artifacts:
      - path: "packages/efx-watercolor/src/playground/mediums.ts"
        issue: "14 keys per record"
    missing:
      - "Amend the plan truth / MED-09 wording to the 16-key canonical set"
  - truth: "64-16 truth 1 / 64-16 truth 2 / 64-17 truth 3 / 64-17 truth 4 / 64-17 truth 5 / 64-20 truth 1 / 64-20 truth 2 / 64-14 truth 6 — the committed probe matrices and coverage-alpha invariants are green"
    status: failed
    reason: "Deterministic gate failures: white-over-blue (gap 0 < 0.60; crossCoverAlpha 0.05 < 0.90; digestPigment differs), white-over-blue-60 (gap 0 < 0.04), cover-advect (0.12 < 0.60), cover-lift (0.12 < 0.90; afterLift 0.08 > 60% of before), cover-textured (4 digests differ; coveredFraction 0), cover-over-wet (digestPigment differs), red-over-blue-50 (digestPigment differs). The invariants measure coverage through an alpha channel that is now darkness-only."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/compare.mjs"
        issue: "coverage-alpha invariants still active"
      - path: "packages/efx-watercolor/probe/medium-engine/probe.ts"
        issue: "crossCoverAlpha = alphaMean(pigment, cross); the pigment alpha is darkness-only"
    missing:
      - "Re-specify the invariants/instrument on the coverage raster (exportCanvas('coverage')) or restore coverage-derived display alpha; re-capture baselines from verified deterministic pairs"
  - truth: "64-16 truth 4 — UAT rows 2/7/8 describe the coverage model and no row is answered"
    status: failed
    reason: "64-UAT.md has 10 pending rows and 4 FAILED rows (11-14), updated 2026-11-18T19:08:56Z, and its summary states: 'Phase status: NOT complete.'"
    artifacts:
      - path: ".planning/phases/64-medium-engine/64-UAT.md"
        issue: "4 failed rows + 10 pending"
    missing:
      - "Pass the 14 UAT rows (or amend the failing ones with the artist's ruling)"
behavior_unverified_items:
  - truth: "64-03 truth 8 — Undo and redo of a stroke that changed thickness restore the field exactly, and a later redo restores the same deposited or eroded value."
    test: "Paint a thick embossed brush stroke on the live sheet, undo it, then redo it."
    expected: "Both the pigment and the half-float thickness field restore exactly; redo restores the same deposited value."
    why_human: "vitest has no real WebGL2 surface. The positional undo pairing (pool-0 formats, snapshotLayers(), WholeDoc capture/upload) is pinned structurally, but the field restore is only observable on a live sheet."
  - truth: "64-03 truth 11 — Replay rebuilds thickness from the stroke script alone — a reopened document repaints the same relief without any persisted thickness field."
    test: "Save a project with thick embossed strokes, reopen it, and replay the strokes."
    expected: "The same relief repaints from the stroke script; no thickness field exists in the saved document."
    why_human: "The absence of a persisted thickness field and replay determinism are pinned by tests; the visual reopen parity needs a live GPU render."
  - truth: "64-04 truth 6 — The thickness field is sampled in document space with a fixed one-texel radius, so zooming or panning never makes the lighting shimmer or crawl."
    test: "With a thick, strongly embossed stroke on screen, zoom in/out and pan across the sheet."
    expected: "The lit/shadow sides stay stable; no shimmer or crawl."
    why_human: "The fixed document-space gradient and texture-unit binding are source-pinned; shimmer is a runtime perceptual property no node test can see."
human_verification:
  - test: "UAT 1 — Set Viscosity to 100 on a fresh stroke and compare with 0."
    expected: "The paint visibly hardens and reads denser; a neutral (0) watercolor stroke is unchanged."
    why_human: "Visual hardening on the live canvas; only the numeric laws and the neutral pixel identity are automated."
  - test: "UAT 2 — Undo and redo a thick embossed stroke and a covering (Body high) stroke."
    expected: "Pigment, thickness and coverage restore together; redo restores the same values."
    why_human: "No WebGL2 surface in vitest; also carries behavior_unverified item 1."
  - test: "UAT 3 — Reopen the project and replay without repainting; then switch paint layers with different document lights."
    expected: "The same relief repaints from script alone; each layer re-shades to its own light."
    why_human: "Reopen/replay parity needs a live GPU render; also carries behavior_unverified item 2."
  - test: "UAT 4 — In the Paper & Light tab, drag Azimuth / Elevation / Intensity without painting."
    expected: "The settled wash re-lights immediately; the tab reads `Paper & Light`; one slider gesture is one undo step and restores the previous light."
    why_human: "The visible re-light and single undo step are live behaviours; the cache term, coalescer and scheduler are automated."
  - test: "UAT 5 — After a light change, Play (reveal) and Apply/stroke-edit bakes."
    expected: "The baked frames match the live sheet's new light. The Play-Script dialog bake is a declared deferral and is not part of this row."
    why_human: "Bake/live parity is visual; the light is threaded into every enumerated bake path."
  - test: "UAT 6 — Zoom/pan over a thick embossed stroke; raise Emboss on a thick stroke."
    expected: "No shimmer or crawl; the paint reads as raised with a lit side and a shadow side."
    why_human: "Shimmer is perceptual; also carries behavior_unverified item 3."
  - test: "UAT 7 — Pick the five mediums and paint five strokes; pick two brushes inside one group after a manual tweak; pick acrylic vs watercolor."
    expected: "Each stroke keeps its own look on replay; a same-group pick keeps the manual tweak; acrylic reads opaque and watercolor a wash."
    why_human: "Medium look and opacity are visual judgements over the canvas."
  - test: "UAT 8 — Body/order and scattering rows: light pigment high Body over a dried dark area; Body 50; dark pigment high Body; water above zero at the border."
    expected: "High Body covers the dried dark area compositely; Body 50 partly covers and lightens without destroying the underlayer; the border blends when water > 0."
    why_human: "The probe bars for Body are now RED (see gaps); the visual read is additionally human."
  - test: "UAT 9 — Dry, replay, undo/redo, and export in every mode (paper, transparent, white, pigment) after scattering; zoom over a scattered area."
    expected: "Identical rasters across dry/replay/undo/redo; export matches the screen on every mode; no shimmer."
    why_human: "Export/screen parity is visual and is currently broken by CR-04 on the committed path."
  - test: "UAT 10 — Open the medium dropdown in the Paint tab and inspect the five brush-library sections."
    expected: "Dropdown shows the selected medium; Watercolor / Gouache / Chalk / Graphite / Acrylic sections are always expanded, with the texture strip above and no filter/search/collapse."
    why_human: "Visual layout judgement."
---

# Phase 64: Medium Engine Verification Report

**Phase Goal:** Paint gains weight — one Viscosity global, five named Mediums, a real paint-thickness field lit as an emboss, an order term (`Body`), a scattering term and medium-grouped brushes let a stroke read denser, heavier and genuinely opaque, while a neutral watercolor stroke renders exactly as it did before.

**Verified:** 2026-11-22T13:46:23Z
**Status:** gaps_found
**Score:** 143/174 must-haves verified; 28 FAILED; 3 present, behavior-unverified
**Re-verification:** Yes — replaces the 2026-11-18T22:28 report (which covered plans 64-01..64-20 at 147/150, human_needed). Plans 64-21..64-24 and the 2026-11-19..22 quicks are now in scope, and the fingerprint was recomputed over the current covered set (219 files, digest `v4:sha256:4d7243df…`).

**Bottom line:** every in-repo unit and integration suite is green (package 39 files / 879 passed / 8 skipped; app 22 files / 420 passed), but the phase's own probe suite is red (12 of 15 gates) and both 2026-11-22 review criticals are confirmed in source. `64-UAT.md` — the artist's record — says **"Phase status: NOT complete"** (4 failed rows, 10 pending). The neutral-identity contract holds; the weight/order contract does not.

## Goal Achievement

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Viscosity row; neutral default bit-identical; maximum visibly hardens without redefining `flow` | ✓ VERIFIED (mechanism + identity); visual UAT 1 pending | Viscosity row present; dissipation/spread laws pinned by `viscosity.test.ts`; `neutral-identity` and `watercolor-50` PASS |
| 2 | Same raster live/bake/replay; lowering Viscosity after settle does not change settled pigment | ✓ VERIFIED | `determinismContract.test.ts`; `viscosity.test.ts` single-read/two-site pins; no settle/display consumer |
| 3 | Fresh session selects watercolor; five mediums apply whole sets in one move; next stroke only; per-stroke replay; manual tweak keeps medium | ✓ VERIFIED (automated); visual UAT 7 pending | `mediums.ts` five records; `mediumSelection.test.ts` one bag write; `brushGroupMedium.test.ts` |
| 4 | Thickness deposit + superpose; lit emboss; light changes the render on live, re-render, Play, Apply, vector edit; never the paint | ✓ VERIFIED (mechanism); undo/replay/shimmer behavior-unverified; UAT 3/4/5/6 pending | `reliefFS`; `displayFS` emboss; light threaded through every enumerated bake; `bakeAquarelleScript` deferral remains |
| 5 | Light pigment covers/lightens dark; Body erodes full core/partial edges and scatters; Body 50 lightens; Body 0 bit-identical | ✗ FAILED | No Body row (MED-19); white-over-blue Body 100 alpha bars red; Body 60 bar red; UAT 12 says Body behaves as transparency |
| 6 | Five library sections; group→medium in one write only when the group changes; 15 classified + 8 new | ✓ VERIFIED; visual UAT 10 pending | `brushGroupOrder/Labels/sections`; 23 presets; `pickAquarelleBrush` |
| 7 | Export matches screen on every `uMode`; no shimmer on zoom; undo restores eroded pigment and thickness | ✗ FAILED | CR-04 wipes the committed base; mode-4 alpha is darkness-only so export/screen parity is not demonstrated; undo structural + behavior-unverified |

### Observable Truths (plan must-haves)

#### 64-01 — Viscosity (MED-02..MED-06) — 9 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Viscosity reaches the engine only through `toEngineParams` (/100, clamp 0..1) | ✓ VERIFIED | `params.ts`; `params.test.ts` |
| 2 | At 0 the dissipation is the pre-milestone literal and spread exactly `0.12` | ✓ VERIFIED | `Engine.ts`; `viscosity.test.ts` |
| 3 | At 100 spread 0.012; at 50 spread 0.066 | ✓ VERIFIED | `0.12*(1-v*0.9)`; test |
| 4 | Viscosity only raises dissipation; never replaces `flow` | ✓ VERIFIED | additive exponent term; test |
| 5 | Read exactly once, applied at exactly two sites | ✓ VERIFIED | count pins |
| 6 | Absent replays 0; non-finite falls back to 0 | ✓ VERIFIED | `toEngineParams`; tests |
| 7 | Backstop: post-settle change re-processes nothing | ✓ VERIFIED | source scan |
| 8 | Pre-milestone stroke byte-identical at default | ✓ VERIFIED | `neutral-identity` PASS |
| 9 | Backstop: live/bake/replay at same viscosity identical | ✓ VERIFIED | `determinismContract.test.ts` |

#### 64-02 — Five Mediums (MED-01, MED-07..MED-13, MED-19) — 11 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Medium is frozen plain serializable data | ✓ VERIFIED | `mediums.ts`; tests |
| 2 | Viscosity row; canonical bag/keys/defaults carry the key | ✓ VERIFIED | row present; `AQUARELLE_GLOBAL_KEYS` 16 keys |
| 3 | Five built-ins over exactly the ten medium keys | ✗ FAILED | records now declare 14 keys (64-22 added feather/pickup/refill/wetSeconds) |
| 4 | `watercolor` equals canonical defaults; new keys 0 | ✓ VERIFIED | derived record; viscosity/body/emboss 0 |
| 5 | A medium never writes `size` or `lift` | ✓ VERIFIED | `MediumParamKey` excludes both |
| 6 | Medium applies in exactly ONE spread write with the id | ✓ VERIFIED | `mediumSelection.test.ts` |
| 7 | Re-pick re-applies; manual tweak keeps selection | ✓ VERIFIED | tests |
| 8 | Backstop: selecting never alters recorded strokes | ✓ VERIFIED | byte-identical stroke test |
| 9 | Backstop: cross-machine replay identical | ✓ VERIFIED | per-stroke snapshot authority |
| 10 | Medium dropdown first Paint-tab row, selected name | ✓ VERIFIED | `AquarelleGlobalsPanel.tsx` dropdown + tests |
| 11 | Unknown/absent medium id is a total no-op | ✓ VERIFIED | `mediumById` null; test |

#### 64-03 — Thickness Field (MED-14, MED-16, MED-18) — 11 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One document-resolution `HALF_FLOAT_R` target, cleared, never persisted | ✓ VERIFIED | `relief` target; `relief.test.ts` |
| 2 | Each dab deposits through its own footprint with paper tooth | ✓ VERIFIED | `reliefFS` + `bindFootprint` |
| 3 | Deposits accumulate additively | ✓ VERIFIED | `FUNC_ADD` + `(ONE, ONE)` |
| 4 | Amount = `P.emboss × amount`; at emboss 0 no draw | ✓ VERIFIED | guard + test |
| 5 | Lift erodes thickness with the same footprint | ✓ VERIFIED | test |
| 6 | Thickness never flows | ✓ VERIFIED | source audit |
| 7 | Undo protection positional; snapshot/travel carry it | ✓ VERIFIED | pool-0 formats/views/maps |
| 8 | Backstop: undo/redo restores the field exactly | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | structural pairing only; no WebGL2 history in vitest |
| 9 | Size change and snapshot restore carry thickness | ✓ VERIFIED | resize + WholeDoc RED upload |
| 10 | Pen and vector strokes deposit no thickness | ✓ VERIFIED | deposit only in the brush callback |
| 11 | Backstop: replay rebuilds thickness from script alone | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | absence + determinism pinned; reopen parity needs GPU |

#### 64-04 — Emboss (MED-15, MED-18) — 8 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Normal from the thickness gradient via one-texel central difference, multiplied into colour | ✓ VERIFIED | `displayFS`; `emboss.test.ts` |
| 2 | Lit term exactly 1.0 at zero gradient, any intensity, every `uMode` | ✓ VERIFIED | algebra; light-0 identity PASS |
| 3 | Light is render state; never in stroke/payload/pigment/thickness | ✓ VERIFIED | absence tests |
| 4 | Shipped defaults reproduce `paperLightFS`'s direction | ✓ VERIFIED | 129.8/38.45 → (-0.5, 0.6, 0.62) |
| 5 | Emboss is the globals row on 0..100 via the one mapping | ✗ FAILED | `EMBOSS_MAX = 15` (2026-11-21 post-UAT cap) |
| 6 | Backstop: fixed document-space sampling prevents shimmer | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | source-pinned; shimmer is perceptual |
| 7 | Export paper/transparent/white carries the shade; mode-4 colour-only | ✓ VERIFIED | shader branch; probe digests |
| 8 | Emboss 0 and light 0 both equal the baseline | ✓ VERIFIED | two identity runs PASS |

#### 64-05 — Document Light (MED-17) — 9 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Backstop: absent light stays absent through parse/re-encode | ✓ VERIFIED | `paintDocumentLight.test.ts` |
| 2 | Malformed light fails closed | ✓ VERIFIED | `normalizeDocumentLight` throws |
| 3 | Absent resolves to package `DEFAULT_LIGHT`; never retyped | ✓ VERIFIED | import; no app literals |
| 4 | One store mutation; one bump/notification/descriptor per call | ✓ VERIFIED | `setDocumentLight`; tests |
| 5 | Same-value write is a revision-stable no-op | ✓ VERIFIED | store compare |
| 6 | Backstop: revision includes light; sync fingerprint inherits | ✓ VERIFIED | `lightTerm`; tests |
| 7 | Per-layer independence | ✓ VERIFIED | sibling-layer test |
| 8 | Launch handoff inside the opaque `document` member | ✓ VERIFIED | launch validator |
| 9 | `MceDocumentLight` dual declaration, field-diff pinned | ✓ VERIFIED | `project.ts`/`project.rs`; `mceFieldContract.test.ts` |

#### 64-06 — Body / Cover Pass (MED-19..MED-25) — 8 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Body row between Viscosity and Emboss; default 0 | ✗ FAILED | quick 261121-mtu removed the row; a test pins its absence |
| 2 | At Body 0 no cover protection or extra draw; pre-milestone bytes | ✓ VERIFIED | guards; `neutral-identity` PASS |
| 3 | A dab above 0 erodes the settled pigment under its tip before depositing | ✓ VERIFIED | non-bristle `coverPass` order; `coverage.test.ts` |
| 4 | Backstop: cover draws only `fixed` and `relief` | ✓ VERIFIED | source + test |
| 5 | One `bodyCurve = clamp01^6`, shared by cover and deposit | ✓ VERIFIED | `scattering.ts`; band pins |
| 6 | Backstop: both pools protected once per stamp | ✓ VERIFIED | caller-wide touch/protect |
| 7 | Body adds no target/texture/program; reuses Lift | ✓ VERIFIED | program binding + audits |
| 8 | Snapshot carries `body`; pre-milestone bag maps to 0 | ✓ VERIFIED | snapshot keys; determinism |

#### 64-07 — Light on Every Render Path (MED-17) — 7 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One `setDocumentLight` mutation and one unified-ledger entry per gesture | ✓ VERIFIED | 64-18 coalescer; `useRotoPhysicalEditHistory.test.ts` |
| 2 | Live sheet applies the document light every frame | ✓ VERIFIED | `applyLiveConfig(engine, getLight)` |
| 3 | Every enumerated bake path resolves the light | ✓ VERIFIED (declared deferral: `bakeAquarelleScript`) | adapter light; Studio passes `light` |
| 4 | Light never stored in a stroke/payload/paint | ✓ VERIFIED | type absence; tests |
| 5 | A light change rotates the content signature so a cached artifact misses | ✓ VERIFIED | `lightCacheTerm` on all three sites |
| 6 | Defaults read from package `DEFAULT_LIGHT`; absent renders the engine default | ✓ VERIFIED | import; absent adapter path |
| 7 | Backstop: two paint layers keep independent lights | ✓ VERIFIED | `documentLight()` by layer id; sibling test |

#### 64-08 — Scattering Transport (MED-32, MED-33, MED-37) — 9 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `S` one broadband scalar on `inkB.a`/`fixedB.a`; no new target/pass | ✓ VERIFIED | source audits |
| 2 | Deposit `S = MAX × bodyCurve(body) × amount` at every pigment site | ✓ VERIFIED | three exact sites |
| 3 | `advectInkFS` transports `S` unchanged | ✓ VERIFIED | shader carries B.a |
| 4 | `settleFS` carries `S` into the settled layer | ✓ VERIFIED | `oB` law |
| 5 | `bodyCurve` is the only sixth-power declaration | ✓ VERIFIED | "no second curve" test |
| 6 | White-gouache retired end to end | ✓ VERIFIED | absence tests |
| 7 | Backstop: `Pigment` never crosses persistence | ✓ VERIFIED | retirement audit |
| 8 | Backstop: at body 0 both `B.a` channels are 0 and bytes identical | ✓ VERIFIED | deposit law + identity |
| 9 | Constants declared once and interpolated | ✓ VERIFIED | `scattering.ts` + spectral |

#### 64-09 — Paper & Light Tab (MED-17) — 5 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Three light rows below grain; label `Paper & Light` | ✓ VERIFIED | `RightPanelPaperTab.tsx` |
| 2 | Controlled by the document light with `DEFAULT_LIGHT` fallback | ✓ VERIFIED | props |
| 3 | One-field patch to `handleDocumentLightChange`; view touches no store | ✓ VERIFIED | each row emits one field |
| 4 | Studio carries `light`/`onLightChange` into `rightPanelProps` | ✓ VERIFIED | Studio source |
| 5 | Same-value: no descriptor/churn; real change: exactly one ledger entry | ✓ VERIFIED | 64-18; tests |

#### 64-10 — Kubelka-Munk Composite (MED-34..MED-36, MED-38) — 8 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each band reconstructs KM layer-over-background; paper multiply untouched | ✓ VERIFIED | `displayBasisGLSL`; `kmBand.test.ts` |
| 2 | Absorption input is HALF the stored exponent | ✓ VERIFIED | `k = 0.5*A` |
| 3 | At/below epsilon today's exact arithmetic runs | ✓ VERIFIED | legacy lines character-for-character |
| 4 | KM branch numerically total | ✓ VERIFIED | totality tests |
| 5 | Granulation/edge scale scattering exactly as absorption | ✓ VERIFIED | `scatter *= k` |
| 6 | High Body erases+scatters; low Body scatters only | ✓ VERIFIED | shared curve; cover/scatter gates (non-bristle) |
| 7 | Backstop: repeats identical; three exports render the scattered scene | ✓ VERIFIED | repeat digests |
| 8 | Backstop: no new allocation/pass; cost bounded | ✓ VERIFIED | source audits |

#### 64-11 — Brush Groups (MED-26, MED-27, MED-29..MED-31) — 7 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Compile-time `group: MediumId`; absent reads watercolor; not persisted | ✓ VERIFIED | `brushes.ts` |
| 2 | Backstop: 15 existing keep ids/order/params/tip bytes; 11/4 split; 8 new | ✓ VERIFIED | `brushes.test.ts` |
| 3 | Eight new unique ids; no rename/removal | ✓ VERIFIED | 23 presets |
| 4 | One section per group in fixed order; no filter/search/collapse | ✓ VERIFIED | `brushSections` |
| 5 | Empty group not rendered | ✓ VERIFIED | filter + test |
| 6 | Texture strip above every section; orthogonal | ✓ VERIFIED | `brushGroupMedium.test.ts` |
| 7 | New tips deterministic, same cost class | ✓ VERIFIED | byte-identical tip test |

#### 64-12 — Group-to-Medium Pick (MED-28) — 7 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Differing group applies the medium; same group writes nothing | ✓ VERIFIED | `pickAquarelleBrush`; tests |
| 2 | Application is `applyAquarelleMedium` (one bag write + id) | ✓ VERIFIED | one spread write test |
| 3 | Committed patch stays `{brushId, toolOverrides}` | ✓ VERIFIED | patch-shape test |
| 4 | Group IS the medium id; non-preset → no write | ✓ VERIFIED | `groupOfPreset` |
| 5 | Outgoing group read before the live pick | ✓ VERIFIED | source order |
| 6 | Backstop: Paint tab agrees; texture changes neither | ✓ VERIFIED | agreement tests |
| 7 | Backstop: every response surface funnels through the one seam | ✓ VERIFIED | source-audit tests |

#### 64-13 — Coverage Composite (8 truths) — no plan number prefix in the source plan

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Source-over inside the pigment layer with one shared per-dab alpha | ✓ VERIFIED | dab law `ink ← ink(1−a)+C·a`; `coverage.test.ts` |
| 2 | Body 0 additive path unchanged, cover zero, no coverage draw; identity | ✓ VERIFIED | guards; identity probes PASS |
| 3 | Rev-4 erase machinery deleted (no `preInk`, no `inkCover`, no full-canvas pass) | ✓ VERIFIED | comment-stripped absence pins |
| 4 | Mode 4 alpha reduces exactly to the legacy formula where cover is 0 | ✓ VERIFIED | `alpha = clamp(1 − tMin)` is legacy everywhere |
| 5 | Coverage amount pigment-independent (`COVER_GAIN`, `COVER_MEDIUM_DENSITY = 8`) | ✓ VERIFIED | constants + derivation tests |
| 6 | Backstop: fixed erosion before compositing; both pools protected once per stamp | ✓ VERIFIED | order/protection pins |
| 7 | `pigment` background is a new export name on the existing mode-4 program; other exports unchanged | ✓ VERIFIED | MODE map; four-digest captures |
| 8 | Invalidated suites updated and gated | ✓ VERIFIED | package suite green |

#### 64-14 — Coverage Lifecycle (7 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Coverage advects with the ink | ✓ VERIFIED | `advectCoverFS`; `coverageLifecycle.test.ts` |
| 2 | Coverage does not decay through settle (keep = 1) | ✓ VERIFIED | advect law + test |
| 3 | Undo/redo restore coverage with pigment and thickness | ✓ VERIFIED (structural; UAT 2) | five-entry pool/view/map pins |
| 4 | Whole-document transport carries coverage both ways incl. resize/apply | ✓ VERIFIED | capture/upload/apply/resize pins |
| 5 | Backstop: Lift reduces coverage with the same program/rect/blend, after fixed and before relief erode | ✓ VERIFIED | source order; tests |
| 6 | Lifecycle gates pinned (`cover-advect` spreads without paper-white; `cover-lift` erodes) | ✗ FAILED | both gates red (0.12 < 0.60 / 0.12 < 0.90; afterLift 0.08) |
| 7 | Invalidated suites updated and gated | ✓ VERIFIED | package suite green |

#### 64-15 — Capture Seam (11 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A covering stroke is an ordinary brush stroke through `captureLivePixels` | ✓ VERIFIED | capture handler; contract |
| 2 | The commit consumes the coverage sheet end to end (`'pigment'` export, eager, `mergeBlend: 'pigment-alpha'`) | ✗ FAILED | replaced by 'coverage-composite' and broken (CR-04) |
| 3 | The coverage sheet is guarded (`isFullyOpaqueRaster` + transparent fallback, null fallback) | ✗ FAILED | no `isFullyOpaqueRaster` at the seam; contract pins its absence; fail-open only |
| 4 | Committed alpha at a coverage pixel is the engine's coverage alpha | ✗ FAILED | `b[i+3] = 255` unconditionally |
| 5 | Cover transaction deleted, not disabled | ✓ VERIFIED | absence pins |
| 6 | Protections removed with it; the ones serving other paths kept | ✓ VERIFIED | contract test |
| 7 | Cover preview plumbing deleted end to end | ✓ VERIFIED | contract test |
| 8 | `onResetSheetReady` collapses to one argument | ✓ VERIFIED | source + tests |
| 9 | Studio suite updated and gated | ✓ VERIFIED | 337 app tests green |
| 10 | No cover punch in the app tree; Lift-only punch | ✓ VERIFIED | contract test |
| 11 | Lift contract unchanged | ✓ VERIFIED | tests |

#### 64-16 — Probe Matrices (6 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A textured tip covers through its crumbly mask (`cover-textured`) | ✗ FAILED | gate red: 4 digests differ, coveredFraction 0 |
| 2 | The three Spike 001 numbers are standing invariants on committed baselines | ✗ FAILED | white-over-blue red; Body 60 red |
| 3 | `--brush <id>` reaches every entry; unknown id fails loudly; report echoes | ✓ VERIFIED | `harness.test.ts` (52) |
| 4 | UAT rows 2/7/8 describe the coverage model and no row is answered | ✗ FAILED | 4 failed + 10 pending; "Phase status: NOT complete" |
| 5 | Body 0 byte-identical (neutral + watercolor-50) after every probe change | ✓ VERIFIED | both PASS |
| 6 | All 76 spec-less rows accounted for | ✓ VERIFIED | reconciliation ledger |

#### 64-17 — Identity Law and Spike Criterion 1 (6 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every report digests `pigment`; `run.mjs` refuses a missing digest; comparator strict | ✓ VERIFIED | harness tests |
| 2 | 1080² Body-0 watercolor reproduces `2b4a86d7 / 7f56e401 / bc74be59` | ✓ VERIFIED | `watercolor-50` PASS |
| 3 | At Body 100 the crossing reads `crossCoverAlpha − crossDarkAlpha ≥ 0.60` | ✗ FAILED | 0 < 0.60 (alpha is darkness-only) |
| 4 | Body 60/30 keep the matrix honest and no body value raises covered paper-white | ✗ FAILED | Body 60 gap 0 < 0.04; Body 30 passes |
| 5 | `cover-over-wet` re-specified for the coverage model | ✗ FAILED | digestPigment differs from committed baseline |
| 6 | Body 0 byte-identical through every probe change | ✓ VERIFIED | identity probes PASS |

#### 64-18 — Light Gesture Ledger (MED-17) — 4 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One light-slider gesture produces exactly ONE unified-ledger entry | ✓ VERIFIED | `documentLightGesture.ts`; 30-write drag test |
| 2 | A same-value gesture produces no descriptor and no panel churn | ✓ VERIFIED | `coalesceLightGesture` |
| 3 | A real light change produces exactly one ledger entry, one undo restores, redo clears once | ✓ VERIFIED | `useRotoPhysicalEditHistory.test.ts` |
| 4 | The live sheet still re-lights during the drag | ✓ VERIFIED (mechanism; UAT 4) | one `setDocumentLight` call site; live read unchanged |

#### 64-19 — Committed-Frame Relight (MED-17) — 4 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every real-frame cache revision carries the canonical `lightSignature` | ✓ VERIFIED | `lightCacheTerm` at all three sites |
| 2 | The visible committed frame is re-baked with the new light exactly once per gesture | ✗ FAILED | WR-04: a refusal during playback/draft/wireframe is permanently dropped; `settle()` has no caller |
| 3 | An undo/redo that changed the light re-lights the visible committed frame the same way | ✓ VERIFIED (mechanism; shares WR-04 refusal caveat) | sync light diff calls the same runner |
| 4 | The re-bake is bounded: one in flight, one queued, refused while playing/Draft/wireframe; per-move never triggers | ✓ VERIFIED | six scheduler rows + guards |

#### 64-20 — Coverage/Film Coherence (MED-19, MED-20, MED-21) — 5 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | At Body 100 the white-over-blue crossing passes every bar | ✗ FAILED | crossCoverAlpha 0.05 < 0.90; gap 0 < 0.60; digestPigment differs |
| 2 | Body 60 keeps partial cover; Body 30 keeps the underlayer; neither raises paper-white | ✗ FAILED | Body 60 gap 0 < 0.04; Body 30 PASS |
| 3 | Coverage transport scaled by the display's own basis reconstruction of the film | ✓ VERIFIED | one `FILM_PRESENCE`; constants; source pins |
| 4 | Body 0 is byte-identical (neutral-identity, neutral-pigment, watercolor-50) | ✓ VERIFIED | all three PASS |
| 5 | Every Body>0 baseline re-captured only after its invariants hold; no bar widened | ✓ VERIFIED | baseline provenance + comparator diff |

#### 64-21 — Acrylic Bristle Foundation (MED-02) — 6 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Paper grain is recorded: `paperSeed` replays that sheet, absent derives from layer id, no `Math.random` patch | ✓ VERIFIED | `paperSeed.test.ts`; `paintDocumentPaperSeed.test.ts`; determinism |
| 2 | The bristle set is a pure function of `traceSeed` (one RNG, 8-float stride, count law) | ✓ VERIFIED | `bristles.test.ts` |
| 3 | Each bristle dab runs the carrier BEFORE it deposits; other responses keep the shipping path | ✓ VERIFIED | `stamp()` order; `bristleCarrier` before `bristleInk` |
| 4 | Three `RGBA16F` 1×256 reservoirs + one shape; no document-sized target, no per-frame pass; three passes with exactly three consumers (ink deposit, coverage write, Body mask) | ✗ FAILED | a document-sized 2×RGBA16F `smearCanvas` now exists; the third gather consumer is `bristleReliefFS`, not a Body mask |
| 5 | Every existing identity gate is byte-identical and no baseline is edited | ✗ FAILED | white-over-blue, red-over-blue-50, cover-* gates red |
| 6 | `paperSeed` declared in both languages, fail-closed, pinned, absent legal | ✓ VERIFIED | `mceFieldContract.test.ts`; `project.rs` |

#### 64-22 — Acrylic Gather & Body (MED-21, MED-24, MED-31) — 6 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Five-nearest bristles' ink-weighted CARRIED COEFFICIENTS, additive `(ONE, ONE)` | ✓ VERIFIED | `BRISTLE_GATHER`; `bristleDepositFS`; bristles tests |
| 2 | Every bristle dab writes coverage exactly ONCE (`ONE, ONE_MINUS_SRC_ALPHA`); the Body pass READS that gather, never writes | ✗ FAILED | single write holds; the Body pass it describes is deleted |
| 3 | The Body cover pass for a bristle response is bristle-modulated, writes fixed (alpha-shaped) and relief (LINEAR) on the gather mask | ✗ FAILED | `coverPass` skipped for bristles; dab law attenuates ink+fixed Body-independently; relief deposited, not eroded |
| 4 | Feather/Pickup/Refill canonical globals, thirteen rows in the stated order; Feather widens softness (0.09+0.25·feather) | ✗ FAILED | no Body row; order differs; pickup/refill hidden per medium; `gatherSoftness` constant 0.09 |
| 5 | Every non-bristle response is byte-identical (lists white-over-blue and red-over-blue-50) | ✗ FAILED | both gates red |
| 6 | Body composes through the coverage composite for bristles; ZERO document-sized targets; allocation count thirteen | ✗ FAILED | document-sized smear pair; allocation count grew |

#### 64-23 — Bristle Traces & Edge Census (MED-14, MED-18) — 6 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Dryness/broken traces (§4.3) | ✓ VERIFIED | helpers + pins |
| 2 | Paper tooth threshold with `BRISTLE_GRAIN` 1.2 (§4.4) | ✓ VERIFIED | `bristleThreshold`; pins |
| 3 | Rim noise/feather/landing/edge bias (§5.1/5.3/5.4/5.5) | ✓ VERIFIED | helpers + pins |
| 4 | Body mixes wide and local (§4.5) | ✓ VERIFIED | `bristleBody`; pins |
| 5 | The `bristle-edge` census requires Feather-100 wider than Feather-0, both variations non-zero, width below half-width | ✗ FAILED | 1.87 not wider than 20.27 |
| 6 | Every non-bristle response byte-identical; four bristle baselines re-authored from verified pairs | ✗ FAILED | identity set red; bristle gates red |

#### 64-24 — Acrylic Last-Touch Field (MED-05, MED-23, MED-32..MED-38) — 6 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Last-touch is a document-sized `R32F` ping-pong pair cleared to −604800 in both halves at allocation and every wipe | ✓ VERIFIED | `clearLastTouch`; `lastTouch.test.ts` |
| 2 | The channel rides the whole-document lifecycle as the sixth pool-0 layer; all lists grow together; exact float read/upload; pins amended in place | ✓ VERIFIED | `allocateHistory`, `snapshotLayers`, `travel`, `docTargets`, `captureWhole`/`uploadWhole`, `resizeDocument` aligned (lastTouch fifth, cover sixth) |
| 3 | Each bristle dab refreshes the field AFTER deposit, weighted by cover and bounded by amount, so a later dab reads the age of the paint it crosses | ✗ FAILED | CR-03 ping-pong revert; `uAmount` unused |
| 4 | The carrier's §3.4 gate is `exp(−age/wetSeconds)·coverage`; multiplies PICKUP only | ✓ VERIFIED | `bristleCarrierFS`; gate multiplies pickup only |
| 5 | `wetSeconds` read per stroke; `dryTau()` untouched | ✓ VERIFIED | `mediums.ts`; params; source |
| 6 | Every non-bristle render byte-identical; four bristle gates re-authored + new `bristle-wet` proof | ✗ FAILED | all five bristle gates red; identity set red |

**Score:** 143/174 truths verified; 28 failed; 3 present, behavior-unverified.

### Deferred Items

None. ROADMAP.md's only later phase (65 — Studio API/MCP) does not cover the acrylic/bristle gaps or the merge defect. The one declared deferral (`bakeAquarelleScript` default light) is documented below.

## Declared Deferrals

| Item | Status | Evidence |
| --- | --- | --- |
| `bakeAquarelleScript` (Roto Play-Script consume/Apply branch) still renders with the engine default light | **Open — declared deferral; explicitly scoped out of UAT row 5** | `physicsPaintRotoPlayScriptController.ts` creates its adapter with no light; logged in `deferred-items.md` and `.planning/WINDOWS.md` row 125. Every enumerated 64-07 path is wired; this Play-Script bake is the sole documented exception. |

## Review Findings Assessed

`64-REVIEW.md` (fresh this run) records two criticals. Both were verified independently in source and both break must-haves:

| Finding | Severity | Bearing after this verification |
| --- | --- | --- |
| CR-03 — last-touch ping-pong corrupts the field outside the current dab | critical | **CONFIRMED.** `gl.ts double()` creates two independent targets; `swap()` swaps references only; `bristleTouch` scissored-draws into `write` reading `read` with no read→write carry. Falsifies 64-24 truth 3 and its own docstring. |
| CR-04 — coverage-composite white-fill inverts the merge law and wipes the committed base | critical | **CONFIRMED.** `exportCoverageCanvas` writes cover into RGB **and alpha**; `scratchOf` white-fills, so source-over yields red = 255(1−c+c²); at cover 0 the merge exponent is 0 and the base is replaced by the sheet. The unit test's no-op `drawImage` cannot see it. Falsifies 64-15 truths 2/4 and roadmap SC7. |
| WR-01 — fixed draw extents clip relief/coverage for wide tips | warning | Unchanged: relief extent 1.5 / coverage extent 2 vs tip aspect up to 2.0. Light-tip clipping. |
| WR-02 — a fully opaque coverage export is misread as transmittance | warning | Superseded in form: the seam no longer uses `transmittanceSourceToPigmentAlpha`; the coverage raster's alpha-over-white is now the CR-04 defect. |
| WR-03 — last-touch raw stamps carried across a time-base reset | warning | Present: `clearLastTouch()` nulls `timeBaseMs`, but `resizeDocument`'s copy and `captureWhole`/`uploadWhole` carry raw stamps; the wetness gate clamps negative ages to 0 (fully fresh). UAT-invisible today, latent. |
| WR-04 — a refused committed-frame relight is permanently dropped | warning | **CONFIRMED (becomes a gap here).** The runner refuses during playback/draft/wireframe; one follow-up is consumed while the state persists; nothing re-requests on idle (`settle()` has no caller). Falsifies 64-19 truth 2. |
| IN-01..IN-07 | info | Present as reviewed: dead `coeffsOpacity`; `fillStep` without Body cover; Azimuth 360 wrap; dead `uAmount`; under-specified `seedSignature`; dead seed path; pickup probe cannot detect a collapsed dynamic range. |

## Required Artifacts

`verify.artifacts` returns no parsed entries for these plans (artifacts are bare path strings), so each was checked manually at four levels. All declared paths exist and are substantive; the table states the wiring/data state where it changed.

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/efx-watercolor/src/playground/params.ts` | canonical→engine mapping | ✓ VERIFIED | /100 + clamp01 incl. feather/pickup/refill; wetSeconds seconds |
| `packages/efx-watercolor/src/playground/mediums.ts` | five frozen records | ✓ VERIFIED | 14 medium keys; gouache emboss 15, Chalk body 0, acrylic body 100/wet 12 |
| `packages/efx-watercolor/src/playground/scattering.ts` | one Body curve + deposit law + constants | ✓ VERIFIED | exponent 6, MAX 8, epsilon 1e-3 |
| `packages/efx-watercolor/src/playground/Engine.ts` | viscosity, relief, cover/coverage, light, advectCover, bristles, last-touch | ✓ VERIFIED with CR-03 | last-touch fifth pool layer; no read→write carry in `bristleTouch` |
| `packages/efx-watercolor/src/playground/shaders.ts` | reliefFS, emboss display, KM, advectCover, gather, touch | ✓ VERIFIED with amendment | mode-4 alpha darkness-only; gather's third consumer is `bristleReliefFS`; `bristleTouchFS` weight = cover |
| `packages/efx-watercolor/src/playground/spectral.ts` | KM generator | ✓ VERIFIED | `Pigment = { coeffs }` |
| `packages/efx-watercolor/src/playground/brushes.ts` | group tag + 23 presets | ✓ VERIFIED | 15 legacy tagged, 0 legacy changes |
| `packages/efx-watercolor/src/playground/bristles.ts` | pure bristle set + trace helpers | ✓ VERIFIED | one RNG, 8-float stride; `gatherSoftness` constant |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | light/paperSeed options applied once | ✓ VERIFIED | adapter tests |
| `packages/efx-watercolor/probe/medium-engine/*` | harness, comparator, 17 baselines | ⚠️ STALE CONTRACT | baselines for cover-*/red/white predate the 2026-11-21 alpha law; bristle baselines predate 2026-11-21/22 |
| `app/src/components/physic-paint/engine/documentLightGesture.ts` | first-descriptor parking + coalescer | ✓ VERIFIED | pure; wired |
| `app/src/components/physic-paint/engine/committedFrameRelight.ts` | bounded single-flight scheduler | ⚠️ PARTIAL | refusal consumes the budget; no idle re-request |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | the Paint panel row law | ⚠️ AMENDED | no Body row; Emboss max 15; pickup/refill hidden per medium |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | bag keys/defaults, medium selection | ✓ VERIFIED | 16 keys; one-write handler |
| `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` | three light rows + onChange/onCommit | ✓ VERIFIED | one-field patches |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | light seams, relight run, capture merge | ⚠️ PARTIAL | merge uses coverage-composite + coverageCanvas (CR-04) |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | per-frame light + underlay | ✓ VERIFIED | `setUnderlay` opaque-only |
| `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts` | committed merge law | ✗ STUB-LEVEL | white-fill misreads coverage (CR-04) |
| `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` | cache revision with light term | ✓ VERIFIED | three real-frame sites |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | unified ledger | ✓ VERIFIED | one entry per gesture |
| `app/src/efx-paint/document/efxPaintDocument*.ts` | optional light + paperSeed, fail-closed | ✓ VERIFIED | parsers; tests |
| `app/src/types/project.ts` + `app/src-tauri/src/models/project.rs` | dual declarations | ✓ VERIFIED | field-contract test |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | five sections | ✓ VERIFIED | order |
| `app/src/components/physic-paint/view/aquarellePaintControls.ts` | `pickAquarelleBrush` seam | ✓ VERIFIED | outgoing group first |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | `efxPaintStore.ts` | onChange/onCommit → setDocumentLight | WIRED | one store writer; one ledger entry |
| `PhysicsPaintStudio.tsx` | `useRotoFramePersistenceCoordinator.ts` | `getDocumentLight` input | WIRED | light term at three sites |
| `PhysicsPaintStudio.tsx` | `physicsPaintRotoAlphaMerge.ts` | `mergeBlend: 'coverage-composite'` + `coverageCanvas` | ⚠️ BROKEN | CR-04 inverts the exponent and wipes the base |
| `PhysicsPaintStudio.tsx` | `engineAdapter.ts` | document light → `setLight` | WIRED | adapter light |
| `AquarelleCanvasLayer.tsx` | `Engine.ts` | `getLight()` → `applyLiveConfig` → `setLight`; `setUnderlay` | WIRED | live sheet |
| `AquarelleCanvasLayer.tsx` | `Engine.ts` | `captureSheet`/`restoreSheet` adopt the last-touch field | ⚠️ CORRUPTING | CR-03 persists the corrupted field into the live engine |
| `Engine.ts` relief | `displayFS` | texture unit 7 `uRelief` | WIRED | emboss shade |
| `Engine.ts` coverage | `displayFS` mode 4 | cover → live underlay branch only | PARTIAL | export alpha no longer coverage-derived |
| `Engine.ts` scattering | `spectral.ts` | `inkB.a`/`fixedB.a` → settle → display scatter | WIRED | one scalar |
| `bristles.ts` | `Engine.ts` | reservoir uploads at `beginBristles` | WIRED | 3 reservoirs + shape |
| `Engine.ts` `bristleTouch` | `lastTouch` pair | scissored draw + swap | ✗ NOT_WIRED | no read→write carry (CR-03) |
| `WatercolorBrushLibrary.tsx` | `aquarellePaintControls.ts` | card pick → medium on group change | WIRED | source-audited |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `AquarelleGlobalsPanel.tsx` | row values | canonical bag | Yes | ✓ FLOWING |
| `AquarelleGlobalsPanel.tsx` | `selectedMedium` | `aquarelleSelectedMediumId` → `mediumById` | Yes | ✓ FLOWING |
| `RightPanelPaperTab.tsx` | `light` | layer document + `DEFAULT_LIGHT` | Yes | ✓ FLOWING |
| `AquarelleCanvasLayer.tsx` | `getLight()` | document per frame → uniforms | Yes | ✓ FLOWING |
| `displayFS` | `uRelief` | engine relief target written by dab deposit | Yes | ✓ FLOWING |
| `displayFS` | `scatter` | `inkB.a`/`fixedB.a` written by deposition/settle | Yes | ✓ FLOWING |
| `displayFS` mode 4 | `cover` | live underlay branch only | Partial | ⚠️ STATIC (export ignores cover) |
| `physicsPaintRotoAlphaMerge.ts` | `cov` | coverage raster red channel after white fill | Wrong | ✗ HOLLOW_PROP (CR-04) |
| `Engine.bristleTouch` | `lastTouch` ages | scissored write + swap, no carry | Wrong outside the dab | ✗ DISCONNECTED (CR-03) |
| `WatercolorBrushLibrary.tsx` | `brushSections` | 23 grouped presets | Yes | ✓ FLOWING |
| `pickAquarelleBrush` | group | preset table at read time | Yes | ✓ FLOWING |
| `lastTouch` carrier | age | raw stamps on the virtual clock | Wrong after a non-overlapping dab | ✗ DISCONNECTED (CR-03) |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| efx-watercolor suite (39 files) | `pnpm exec vitest run` (cwd `packages/efx-watercolor`) | 879 passed, 8 skipped | ✓ PASS |
| Probe harness suite | included above (`probe/medium-engine/harness.test.ts`) | 52 passed | ✓ PASS |
| Phase-relevant app files (17) | `pnpm exec vitest run` on light/ledger/seam/panel suites | 337 passed | ✓ PASS |
| Panel/record-state app files (5) | `pnpm exec vitest run` on AquarelleGlobalsPanel, aquarelleRecordState, aquarellePaintControls, BrushMenu, BrushPicker | 83 passed | ✓ PASS |
| Typecheck/build | not run this round (code unchanged since the last green build) | — | ? SKIP |
| Probe gates (15) | see Probe Execution | 3 PASS / 12 FAIL | ✗ FAIL |

Note: `physicsPaintRotoAlphaMerge.test.ts` passes because its `PixelContext.drawImage()` is a no-op and it seeds scratch pixels directly — the green suite is not evidence for CR-04.

## Probe Execution

Run in headless WebGL2 Chrome from `packages/efx-watercolor/probe/medium-engine` (full log: `/tmp/verify64-gates.log`).

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| neutral-identity | `node run.mjs --gate neutral-identity` && `node compare.mjs neutral-identity` | d2bd637a / 291d4a11 / 6ba88334 / 13b8af1d; equal | PASS |
| neutral-pigment | `node run.mjs --gate neutral-pigment --size 256` && compare | equal to neutral-identity | PASS |
| watercolor-50 | `node run.mjs --gate watercolor-50 --scenario watercolor-50 --size 1080` && compare | 2b4a86d7 / 7f56e401 / bc74be59 / 432f3a3f; equal | PASS |
| white-over-blue | `node run.mjs --gate white-over-blue --scenario white-over-blue --size 1080 --body 100` && compare | digestPigment differs (a6df8b31 vs 786fcb32); crossCoverAlpha 0.05 < 0.90; gap 0 < 0.60 | FAILED |
| white-over-blue-60 (extra) | same with `--body 60`, `compare --differs-from white-over-blue` | gap 0 < 0.04 (no coverage contribution) | FAILED |
| white-over-blue-30 (extra) | same with `--body 30` | all 3 digests differ; bars hold | PASS |
| cover-advect | `node run.mjs --gate cover-advect --scenario cover-advect --size 256 --body 100` && compare | digestPigment differs; coverAlphaAfterAdvect 0.12 < 0.60 | FAILED |
| cover-lift | `node run.mjs --gate cover-lift --scenario cover-lift --size 256 --body 100` && compare | coverAlphaBeforeLift 0.12 < 0.90; afterLift 0.08 > 60% of before | FAILED |
| cover-textured | `node run.mjs --gate cover-textured --scenario cover-textured --size 512 --body 100 --brush chalk` && compare | 4 digests differ; coveredFraction 0 outside [0.02, 0.80] | FAILED |
| cover-over-wet | `node run.mjs --gate cover-over-wet --scenario cover-over-wet --size 256 --body 100` && compare | digestPigment differs | FAILED |
| red-over-blue-50 | `node run.mjs --gate red-over-blue-50 --scenario red-over-blue-50 --size 1080 --body 100` && compare | digestPigment differs (b3e68efe vs 8ade2e17) | FAILED |
| bristle-edge-1080 | `node run.mjs --gate bristle-edge-1080 --scenario bristle-edge --size 1080` && compare | edgeSoftnessPxFeather100 1.87 not wider than Feather0 20.27 | FAILED |
| bristle-wet-1080 | `node run.mjs --gate bristle-wet-1080 --scenario bristle-wet --size 1080` && compare | 4 digests differ; 0 invariant failures | FAILED |
| bristle-body0-1080 | `node run.mjs --gate bristle-body0-1080 --scenario bristle-body --size 1080 --body 0` && compare | 4 digests differ; coveredFraction 0 | FAILED |
| bristle-body100-1080 | same with `--body 100` | 4 digests differ; coveredFraction 0 | FAILED |
| bristle-round-body0-1080 | `--brush bristle-round --body 0` | 4 digests differ; coveredFraction 0 | FAILED |
| bristle-body100-2048 | `--size 2048 --body 100` | 4 digests differ; coveredFraction 0 | FAILED |

Root cause of the coverage-alpha failures: the 2026-11-21 amendment made the pigment export's alpha darkness-only (`alpha = clamp(1.0 - tMin)`), while `compare.mjs`'s invariants still read `crossCoverAlpha`/`coverAlpha*` as the coverage claim (`crossCoverAlpha = alphaMean(pigment, cross)`). The instrument no longer measures what the invariant asserts; the baselines were captured before the change and never re-authored. The bristle-edge direction failure and the bristle digest drift are independent of that instrument issue.

## Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `documentLightGesture.test.ts` | MED-17 | 5 | 0 | no | Behavioral | PASS |
| `committedFrameRelight.test.ts` | MED-17 | 6 | 0 | no | Behavioral (scheduler interleavings) | PASS (misses the refusal-then-idle case → WR-04) |
| `useRotoFramePersistenceCoordinator.test.ts` | MED-17 | all | 0 | no | Value (revisions) | PASS |
| `useRotoPhysicalEditHistory.test.ts` | MED-17 | all | 0 | no | Behavioral | PASS |
| `physicsPaintRotoAlphaMerge.test.ts` | MED-22/23 | all | 0 | **harness models no alpha-over** | Value arithmetic only | **INSUFFICIENT** — `drawImage()` no-op hides CR-04 |
| `lastTouch.test.ts` | MED-32..38 | all | 0 | no | Source-scan only (no WebGL) | INSUFFICIENT for CR-03 |
| `probe/medium-engine/harness.test.ts` | MED-19..21 | 52 | 0 | partial (self-captured baselines by design) | Status/Value | PASS with note |
| package engine suites (viscosity, mediums, scattering, kmBand, emboss, relief, coverage, determinism, bristles) | MED-01..38 | all | 0 | no | Value/Behavioral | PASS |
| app panel/record suites (22 files) | MED-01/02/19/22/26..31 | all | 0 | no | Value/Behavioral | PASS |

**Disabled tests on requirements:** 0.
**Circular patterns:** 0 in test logic; the probe baselines are self-captured by design, guarded by absolute invariants — except that those invariants' instrument went stale after the alpha amendment.
**Insufficient assertions:** 2 blockers — `physicsPaintRotoAlphaMerge.test.ts` (CR-04 invisible) and `lastTouch.test.ts` (CR-03 invisible; source-scan only).

### Decision Coverage

`check decision-coverage-verify` returns `skipped: true` (non-blocking): the verb looks for `CONTEXT.md`, while this phase stores `64-CONTEXT.md`. Not evaluable programmatically; no blocking finding.

## Requirements Coverage

All 38 MED IDs appear in at least one plan's `requirements` field (no orphans). 32 SATISFIED, 6 BLOCKED.

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MED-01 | 64-02 | Viscosity global row 0..100 → 0..1 | ✓ SATISFIED | row present; bag/keys |
| MED-02 | 64-01/21 | Neutral default bit-identical | ✓ SATISFIED | `neutral-identity` + `watercolor-50` PASS; paperSeed pinned |
| MED-03 | 64-01 | Dissipation only raises; two sites | ✓ SATISFIED | additive exponent; count pins |
| MED-04 | 64-01 | Spread `0.12*(1-v*0.9)` | ✓ SATISFIED | source + tests |
| MED-05 | 64-01/24 | Per-stroke snapshot; live=bake=replay | ✓ SATISFIED | snapshot + determinism; wetSeconds per stroke |
| MED-06 | 64-01 | Post-settle change does not reprocess | ✓ SATISFIED | source scan |
| MED-07 | 64-02 | Medium plain record | ✓ SATISFIED | `mediums.ts` |
| MED-08 | 64-02 | `watercolor` = today's defaults; fresh session | ✓ SATISFIED | derived record |
| MED-09 | 64-02 | Five built-ins with recorded numbers | ✓ SATISFIED | records pinned (canonical set now 16 keys) |
| MED-10 | 64-02 | One store write per switch | ✓ SATISFIED | `applyAquarelleMedium` |
| MED-11 | 64-02 | Never alters recorded strokes | ✓ SATISFIED | byte-identical test |
| MED-12 | 64-02 | Cross-machine replay via snapshot authority | ✓ SATISFIED | snapshot + determinism |
| MED-13 | 64-02 | Existing Studio UI; manual tweak keeps medium | ✓ SATISFIED | dropdown + tests |
| MED-14 | 64-03/23 | Half-float thickness via each dab's footprint; superposes | ✓ SATISFIED | target + blend law + traces |
| MED-15 | 64-04 | Lit emboss; emboss 0 / intensity 0 byte-identical | ✓ SATISFIED | algebra + identity probes |
| MED-16 | 64-03 | Emboss canonical param; no transport asset | ✓ SATISFIED | params bag |
| MED-17 | 64-05/07/09/18/19 | Document light; every render path; persisted; cache fingerprint; one gesture one entry | ✓ SATISFIED (declared deferral: `bakeAquarelleScript`; WR-04 warning) | persistence/parser/revision/live/reveal/Apply; 64-18/19 |
| MED-18 | 64-03/04 | Snapshot + undo protection; export on every `uMode`; no zoom shimmer | ✗ BLOCKED | CR-04 breaks export/screen parity on the committed path; undo remains behavior-unverified |
| MED-19 | 64-02/06/20 | Body global, canonical set, **row**, default 0; coverage coherence | ✗ BLOCKED | no Body row (quick 261121-mtu); Body 100/60 probe bars red |
| MED-20 | 64-06/20 | Body 0 no cover; baseline identity | ✓ SATISFIED | guards + three identity probes |
| MED-21 | 64-06/20/22 | Erode settled pigment under own tip before deposit; partial at edges; scaled by Body | ✗ BLOCKED | non-bristle path holds; bristle path has no Body-scaled cover (dab law, Body-independent); UAT 12 reports Body as transparency |
| MED-22 | 64-06/15 | Cover touches settled+thickness only; destructive to settled; undo consistent | ✓ SATISFIED (structural; UAT 2) | `coverPass` fixed+relief; bristle dab law also settled-only |
| MED-23 | 64-06/24 | Body snapshot; live/bake/replay same raster; medium values | ✓ SATISFIED (values amended: Chalk body 0) | snapshot tests; mediums |
| MED-24 | 64-06/22 | Undo/redo restore both eroded pools, protected before first draw | ✓ SATISFIED (structural; UAT 2) | dual protection + pairing |
| MED-25 | 64-06 | No new target/texture/program; export on both `uMode` paths | ✗ BLOCKED | export parity broken by CR-04 + darkness-only alpha |
| MED-26 | 64-11 | Compile-time group; absent=watercolor; no persistence | ✓ SATISFIED | `brushes.ts` |
| MED-27 | 64-11 | Five sections fixed order; no filter/search | ✓ SATISFIED | `brushSections` |
| MED-28 | 64-12 | Group→medium one write only on change | ✓ SATISFIED | `pickAquarelleBrush` |
| MED-29 | 64-11 | 15 classified (11/4) | ✓ SATISFIED | table + git diff |
| MED-30 | 64-11 | Eight new responses; no rename/remove | ✓ SATISFIED | 23 ids pinned |
| MED-31 | 64-11/22 | Texture axis unchanged and orthogonal | ✓ SATISFIED | strip + tests |
| MED-32 | 64-08/24 | S on `inkB.a`/`fixedB.a`; no new target/pass | ✗ BLOCKED | S rides B.a (holds), but two document-sized targets now exist (last-touch pair, and the 261119-pod 2×RGBA16F smear pair beyond D-29) |
| MED-33 | 64-08 | Body derives S; advection transports; settle carries | ✓ SATISFIED | deposit sites + settleFS |
| MED-34 | 64-10 | KM layer-over-background; broadband scalar | ✓ SATISFIED | generator + kmBand |
| MED-35 | 64-10 | S=0 bit-identical; stable small-arg branch | ✓ SATISFIED | legacy branch + identity |
| MED-36 | 64-10 | Scattering and order compose | ✓ SATISFIED (automated watercolor law; acrylic Body complaint tracked at UAT 12) | shared curve + coverage tests |
| MED-37 | 64-08 | White-gouache retired | ✓ SATISFIED | retirement audits |
| MED-38 | 64-10/24 | Replay determinism for S; export on every `uMode` | ✗ BLOCKED | export parity broken (CR-04/darkness-only alpha); scatter determinism holds |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `Engine.ts` | 3553-3560 | Docstring "Texels outside the dab rect keep their age untouched" | 🛑 Blocker | False; CR-03. Completion not auditable without a fix or a corrected docstring |
| `physicsPaintRotoAlphaMerge.ts` | 112-115 | Comment "The sheet and the coverage are opaque rasters" | 🛑 Blocker | False for coverage (alpha = cover); CR-04 |
| `shaders.ts` | 1461-1469 | `uAmount` declared/uploaded, never read | ⚠️ Warning | IN-04; the documented amount bound does not exist |
| `compare.mjs` | 212-290 | Invariants read coverage through a darkness-only alpha | 🛑 Blocker | The acceptance contract no longer measures its claim |
| `aquarelleParamVisibility.ts` | 29, 90 | Body row removed; Emboss max 15 | ⚠️ Warning (requirement conflict) | MED-19 / 64-04 truth 5 |
| `Engine.ts` | 764, 810 | Document-sized 2×RGBA16F `smearCanvas` | ⚠️ Warning (delivery-law amendment) | Contradicts 64-21/22/24 prohibitions as written |
| Phase source tree (425 changed files) | — | `TBD` / `FIXME` / `XXX` debt markers | None | 0 hits across all changed `.ts/.tsx/.rs/.mjs` files |
| Phase surfaces | — | Empty implementations / hardcoded empty rendered data | None | All dynamic values trace to store/document/engine |

## Human Verification Required

The human sink is `64-UAT.md` (`status: testing`, updated 2026-11-18T19:08:56Z): **10 pending rows + 4 FAILED rows**. The 4 failed rows are evidence, not awaiting input:

| UAT row | Result | Defect |
| --- | --- | --- |
| 11 — Acrylic Bristle Round/Flat, Feather 100 and Pickup 100 | **failed** | No perceptible change between low and 100%; strokes read as flat soft bars (GAP-2) |
| 12 — Body as a mixer with the background | **failed** | Body behaves as transparency; hard rim; pale halo (GAP-1) |
| 13 — Edge anti-aliasing and acrylic water | **failed** | Uniform soft/hard edges with aliasing; no water; no wet-gated edge mixing (GAP-3) |
| 14 — Texture tip vs default bristle tip | **failed** | Texture tip bypasses the bristle engine (`isBristleResponse()` excludes any `textureId`); result reads closer to the reference than the new path (GAP-4) |

The 10 pending rows (1-10) remain the live visual checks for viscosity, undo/redo, reopen/replay, Paper & Light, bakes, shimmer, mediums, Body/scattering, export parity and library layout — listed in the frontmatter of this report. The three behavior-unverified backstop truths (thickness undo/redo, reopen-and-replay relief, zoom/pan shimmer) are part of rows 2, 3 and 6.

## Gaps Summary

The phase's automated spine is intact — viscosity, mediums, thickness, emboss, document light, scattering, brush groups, paper seed and the whole-document lifecycle all pass their unit and integration suites, and the neutral watercolor identity holds byte-for-byte. The goal is still not achieved, for four independent reasons:

1. **The committed result loses paint (CR-04).** The coverage-composite merge introduced on 2026-11-21 white-fills a coverage raster whose alpha encodes cover, so cover 0 reads as 255; the merge exponent becomes 0 and the cached base is replaced by the sheet wherever the new stroke did not paint. This breaks 64-15 truths 2/4, MED-18/MED-25/MED-38 and roadmap SC7, and the only test for the law cannot see it.
2. **The wetness field flickers (CR-03).** The last-touch ping-pong never carries the field outside the current dab, so every dab reverts the previous dab's stamps; carrier and gather read a field that rolls back each dab, and `captureSheet`/`adoptSheet` persists it. This breaks 64-24 truth 3 and the documented law; no gate stamps two non-overlapping dabs.
3. **The acceptance contract is red.** 12 of 15 committed probe gates fail: the coverage-alpha invariants measure an alpha that is now darkness-only, the Body-100/60 crossing bars fail, and the bristle gates plus the edge census fail on their own digests and their own relation invariant. The baselines were never re-authored after the 2026-11-21/22 amendments. 64-14/16/17/20/21/22/23/24 truths that require green gates are failed as written.
4. **The visible contract is unmet.** The artist's UAT says the phase is NOT complete: Body was demoted to a bag-only value (no row, MED-19), the acrylic Body/Feather/Pickup/water/edge behaviors read as a transparency term with a hard rim and no water, and the texture-tip path bypasses the bristle engine. The Body-100 white-over-blue capture corroborates the same story numerically (crossCoverAlpha 0.05, gap 0).

Secondary, still-real gaps: WR-04 (a light commit made during playback/draft/wireframe is permanently dropped — 64-19 truth 2), the Emboss slider capped at 15 against a 0..100 truth, and the delivery-law targets added beyond the 64-21/22/24 prohibitions (the 2×RGBA16F smear pair).

The four prior gaps recorded by the 2026-11-18 report (CR-01, CR-02, the white-over-blue matrix) remain fixed in code; they are not reopened here. What changed after that report is the 2026-11-19..22 acrylic work and the 2026-11-21 live/committed law amendment, which arrived with new critical defects and without a matching gate/baseline update.

---

_Verified: 2026-11-22T13:46:23Z_
_Verifier: Claude (gsd-verifier)_
