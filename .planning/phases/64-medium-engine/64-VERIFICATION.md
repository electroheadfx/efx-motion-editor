---
phase: 64-medium-engine
verified: 2026-11-18T22:28:25Z
status: human_needed
score: 147/150 must-haves verified
covered_files: [".planning/phases/64-medium-engine/64-01-PLAN.md", ".planning/phases/64-medium-engine/64-01-SUMMARY.md", ".planning/phases/64-medium-engine/64-02-PLAN.md", ".planning/phases/64-medium-engine/64-02-SUMMARY.md", ".planning/phases/64-medium-engine/64-03-PLAN.md", ".planning/phases/64-medium-engine/64-03-SUMMARY.md", ".planning/phases/64-medium-engine/64-04-PLAN.md", ".planning/phases/64-medium-engine/64-04-SUMMARY.md", ".planning/phases/64-medium-engine/64-05-PLAN.md", ".planning/phases/64-medium-engine/64-05-SUMMARY.md", ".planning/phases/64-medium-engine/64-06-PLAN.md", ".planning/phases/64-medium-engine/64-06-SUMMARY.md", ".planning/phases/64-medium-engine/64-07-PLAN.md", ".planning/phases/64-medium-engine/64-07-SUMMARY.md", ".planning/phases/64-medium-engine/64-08-PLAN.md", ".planning/phases/64-medium-engine/64-08-SUMMARY.md", ".planning/phases/64-medium-engine/64-09-PLAN.md", ".planning/phases/64-medium-engine/64-09-SUMMARY.md", ".planning/phases/64-medium-engine/64-10-PLAN.md", ".planning/phases/64-medium-engine/64-10-SUMMARY.md", ".planning/phases/64-medium-engine/64-11-PLAN.md", ".planning/phases/64-medium-engine/64-11-SUMMARY.md", ".planning/phases/64-medium-engine/64-12-PLAN.md", ".planning/phases/64-medium-engine/64-12-SUMMARY.md", ".planning/phases/64-medium-engine/64-13-PLAN.md", ".planning/phases/64-medium-engine/64-13-SUMMARY.md", ".planning/phases/64-medium-engine/64-14-PLAN.md", ".planning/phases/64-medium-engine/64-14-SUMMARY.md", ".planning/phases/64-medium-engine/64-15-PLAN.md", ".planning/phases/64-medium-engine/64-15-SUMMARY.md", ".planning/phases/64-medium-engine/64-16-PLAN.md", ".planning/phases/64-medium-engine/64-16-SUMMARY.md", ".planning/phases/64-medium-engine/64-17-PLAN.md", ".planning/phases/64-medium-engine/64-17-SUMMARY.md", ".planning/phases/64-medium-engine/64-18-PLAN.md", ".planning/phases/64-medium-engine/64-18-SUMMARY.md", ".planning/phases/64-medium-engine/64-19-PLAN.md", ".planning/phases/64-medium-engine/64-19-SUMMARY.md", ".planning/phases/64-medium-engine/64-20-PLAN.md", ".planning/phases/64-medium-engine/64-20-SUMMARY.md", "app/src-tauri/src/models/project.rs", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx", "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx", "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx", "app/src/components/physic-paint/engine/aquarelleEnginePort.ts", "app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts", "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts", "app/src/components/physic-paint/engine/committedFrameRelight.test.ts", "app/src/components/physic-paint/engine/committedFrameRelight.ts", "app/src/components/physic-paint/engine/documentLightGesture.test.ts", "app/src/components/physic-paint/engine/documentLightGesture.ts", "app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts", "app/src/components/physic-paint/hooks/rotoReferenceOnlyTolerance.test.ts", "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts", "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts", "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts", "app/src/components/physic-paint/roto/aquarelleFrameBytes.test.ts", "app/src/components/physic-paint/roto/aquarelleFrameBytes.ts", "app/src/components/physic-paint/roto/aquarelleLiftErase.ts", "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts", "app/src/components/physic-paint/roto/aquarelleLiftPreview.test.ts", "app/src/components/physic-paint/roto/aquarelleLiftPreview.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts", "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts", "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts", "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts", "app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx", "app/src/components/physic-paint/view/RightPanelPaperTab.tsx", "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts", "app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx", "app/src/components/physic-paint/view/aquarellePaintControls.ts", "app/src/components/physic-paint/view/aquarellePresetSelection.test.ts", "app/src/components/physic-paint/view/aquarelleRecordState.test.ts", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/brushGroupMedium.test.ts", "app/src/components/physic-paint/view/brushGroups.test.ts", "app/src/components/physic-paint/view/mediumSelection.test.ts", "app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts", "app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts", "app/src/efx-paint/document/efxPaintDocument.ts", "app/src/efx-paint/document/efxPaintDocumentParsers.ts", "app/src/efx-paint/document/efxPaintDocumentRevision.ts", "app/src/efx-paint/document/paintDocumentLight.test.ts", "app/src/lib/mceFieldContract.test.ts", "app/src/lib/physicPaintBridge.launchPackBytes.test.ts", "app/src/stores/efxPaintStore.ts", "app/src/stores/physicPaintStore.ts", "app/src/types/project.ts", "app/src/viteBuild.test.ts", "packages/efx-watercolor/probe/medium-engine/.gitignore", "packages/efx-watercolor/probe/medium-engine/baselines/cover-advect.json", "packages/efx-watercolor/probe/medium-engine/baselines/cover-lift.json", "packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-prefix.json", "packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-subtract.json", "packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json", "packages/efx-watercolor/probe/medium-engine/baselines/cover-textured.json", "packages/efx-watercolor/probe/medium-engine/baselines/neutral-identity.json", "packages/efx-watercolor/probe/medium-engine/baselines/neutral-pigment.json", "packages/efx-watercolor/probe/medium-engine/baselines/red-over-blue-50.json", "packages/efx-watercolor/probe/medium-engine/baselines/watercolor-50.json", "packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json", "packages/efx-watercolor/probe/medium-engine/compare.mjs", "packages/efx-watercolor/probe/medium-engine/harness.test.ts", "packages/efx-watercolor/probe/medium-engine/index.html", "packages/efx-watercolor/probe/medium-engine/probe.ts", "packages/efx-watercolor/probe/medium-engine/run.mjs", "packages/efx-watercolor/src/adapter/engineAdapter.test.ts", "packages/efx-watercolor/src/adapter/engineAdapter.ts", "packages/efx-watercolor/src/determinismContract.test.ts", "packages/efx-watercolor/src/playground/Engine.ts", "packages/efx-watercolor/src/playground/brushes.test.ts", "packages/efx-watercolor/src/playground/brushes.ts", "packages/efx-watercolor/src/playground/coverage.test.ts", "packages/efx-watercolor/src/playground/coverageLifecycle.test.ts", "packages/efx-watercolor/src/playground/dryMedia.test.ts", "packages/efx-watercolor/src/playground/emboss.test.ts", "packages/efx-watercolor/src/playground/index.ts", "packages/efx-watercolor/src/playground/kmBand.test.ts", "packages/efx-watercolor/src/playground/mediums.test.ts", "packages/efx-watercolor/src/playground/mediums.ts", "packages/efx-watercolor/src/playground/params.test.ts", "packages/efx-watercolor/src/playground/params.ts", "packages/efx-watercolor/src/playground/relief.test.ts", "packages/efx-watercolor/src/playground/scattering.test.ts", "packages/efx-watercolor/src/playground/scattering.ts", "packages/efx-watercolor/src/playground/shaders.test.ts", "packages/efx-watercolor/src/playground/shaders.ts", "packages/efx-watercolor/src/playground/spectral.ts", "packages/efx-watercolor/src/playground/viscosity.test.ts"]
covered_digest: "v4:sha256:157591d985a5d9875c8930e585dab25fc39a22d02cfde3e9f21f8abbd48b9cc3"
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 130/137
  gaps_closed:
    - "64-07 truth 1 — one light gesture produces exactly ONE unified-ledger entry (CR-02; closed by 64-18)"
    - "64-07 truth 5 — a light change rotates the committed-frame cache revision and the visible frame re-bakes under the new light (CR-01; closed by 64-19)"
    - "64-09 truth 5 — a real light change produces exactly one ledger entry, one undo restores the previous light, the redo stack is cleared exactly once (closed by 64-18)"
    - "64-17 truth 4 — Body 100 white-over-blue passes every bar (coveredPaperWhitePct 0, cover alpha 0.95, gain 0.90, blue excess 0.71; closed by 64-20)"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Undo and redo of a stroke that changed thickness restore the field exactly, and a later redo restores the same deposited or eroded value (64-03 backstop)."
    test: "Paint a thick embossed brush stroke on the live sheet, undo it, then redo it."
    expected: "Both the pigment and the half-float thickness field restore exactly; redo restores the same deposited value."
    why_human: "vitest has no real WebGL2 surface. The positional undo pairing (pool-0 formats, snapshotLayers(), WholeDoc capture/upload) is pinned structurally, but the field restore is only observable on a live sheet."
  - truth: "Replay rebuilds thickness from the stroke script alone — a reopened document repaints the same relief without any persisted thickness field (64-03 backstop)."
    test: "Save a project with thick embossed strokes, reopen it, and replay the strokes."
    expected: "The same relief repaints from the stroke script; no thickness field exists in the saved document."
    why_human: "The absence of a persisted thickness field and replay determinism are pinned by tests; the visual reopen parity needs a live GPU render."
  - truth: "The thickness field is sampled in document space with a fixed one-texel radius, so zooming or panning never makes the lighting shimmer or crawl (64-04 backstop)."
    test: "With a thick, strongly embossed stroke on screen, zoom in/out and pan across the sheet."
    expected: "The lit/shadow sides stay stable; no shimmer or crawl."
    why_human: "The fixed document-space gradient and texture-unit-7 binding are source-pinned; shimmer is a runtime perceptual property no node test can see."
human_verification:
  - test: "Set Viscosity to 100 on a fresh stroke and compare with 0."
    expected: "The paint visibly hardens and reads denser; a neutral (0) watercolor stroke is unchanged."
    why_human: "Viscosity's visual hardening is a live-canvas judgement; only the numeric laws and the neutral pixel identity are automated."
  - test: "Undo and redo a thick embossed stroke and a covering (Body high) stroke."
    expected: "Pigment, thickness and coverage restore together; redo restores the same values."
    why_human: "No WebGL2 surface in vitest; also carries behavior_unverified_items 1."
  - test: "Reopen the project and replay without repainting; then switch paint layers with different document lights."
    expected: "The same relief repaints from script alone; each layer re-shades to its own light."
    why_human: "Reopen/replay parity needs a live GPU render; also carries behavior_unverified_items 2."
  - test: "In the Paper & Light tab, drag Azimuth / Elevation / Intensity without painting."
    expected: "The settled wash re-lights immediately; the tab reads `Paper & Light`; one slider gesture is one undo step that restores the previous light."
    why_human: "The visible re-light after 64-19 and the one-gesture undo are live behaviours; the cache term, the coalescer and the single-flight scheduler are automated."
  - test: "After a light change, Play (reveal) and Apply/stroke-edit bakes."
    expected: "The baked frames match the live sheet's new light. The Play-Script dialog bake is a separate declared deferral and is not part of this row."
    why_human: "Bake/live parity is visual; the light is threaded into every enumerated bake path."
  - test: "Zoom/pan over a thick embossed stroke; raise Emboss on a thick stroke."
    expected: "No shimmer or crawl; the paint reads as raised with a lit side and a shadow side."
    why_human: "Shimmer is perceptual; also carries behavior_unverified_items 3."
  - test: "Pick the five mediums and paint five strokes; pick two brushes inside one group after a manual tweak; pick acrylic vs watercolor."
    expected: "Each stroke keeps its own look on replay; a same-group pick keeps the manual tweak; acrylic reads opaque and watercolor a wash."
    why_human: "Medium look and opacity are visual judgements over the canvas."
  - test: "Body/order and scattering rows: light pigment high Body over a dried dark area; Body 50; dark pigment high Body; water above zero at the border."
    expected: "High Body covers the dried dark area compositely; Body 50 partly covers and lightens without destroying the underlayer; the border blends when water > 0."
    why_human: "The probe bars are green, but the visual read of order/scattering is a live-canvas judgement."
  - test: "Dry, replay, undo/redo, and export in every mode (paper, transparent, white, pigment) after scattering; zoom over a scattered area."
    expected: "Identical rasters across dry/replay/undo/redo; export matches the screen on every mode; no shimmer."
    why_human: "Export/screen parity is visual; the four export digests are automated."
  - test: "Open the medium dropdown in the Paint tab and inspect the five brush-library sections."
    expected: "Dropdown shows the selected medium; Watercolor / Gouache / Chalk / Graphite / Acrylic sections are always expanded, with the texture strip above and no filter/search/collapse."
    why_human: "Layout inspection is visual."
---

# Phase 64: Medium Engine Verification Report

**Phase Goal:** Paint gains weight — one Viscosity global, five named Mediums, a real paint-thickness field lit as an emboss, an order term (`Body`), a scattering term and medium-grouped brushes let a stroke read denser, heavier and genuinely opaque, while a neutral watercolor stroke renders exactly as it did before.
**Verified:** 2026-11-18T22:28:25Z
**Status:** human_needed
**Re-verification:** Yes — after the 64-18 / 64-19 / 64-20 gap-closure round (all automated checks green; the live UAT sheet is the only remaining gate)

## Goal Achievement

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Viscosity row; neutral default bit-identical; maximum visibly hardens without redefining `flow` | ✓ VERIFIED (mechanism + identity); visual row UAT 1 | `GLOBAL_ROWS` has `viscosity` 'Viscosity'; `toEngineParams` maps /100+clamp; dissipation `exp(-dt*(3.0-flow*2.4+viscosity*12.0))*(fixing?exp(-dt*7):1)` and spread `0.12*(1-viscosity*0.9)`; `neutral-identity` probe PASS 6/6 fields |
| 2 | Same raster live/bake/replay; lowering Viscosity after settle does not change settled pigment | ✓ VERIFIED (automated arms); visual UAT 1/9 pending | `determinismContract.test.ts` viscosity arms; `viscosity.test.ts` pins the single read and the two sites and forbids viscosity in settle/advect-ink/display |
| 3 | Fresh session selects watercolor; five mediums apply whole sets in one move; next stroke only; replay per stroke; manual tweak keeps medium | ✓ VERIFIED; visual UAT 7 pending | `mediums.ts` five frozen records; `mediumSelection.test.ts` one bag write, id once, re-pick restores, unknown no-op, recorded strokes byte-identical; `brushGroupMedium.test.ts` |
| 4 | Thickness deposit + superpose; lit emboss; light changes the render on live, re-render, Play, Apply, vector edit; never the paint | ✓ VERIFIED (mechanism); visual UAT rows 4/5 pending | `reliefFS` + additive blend; `displayFS` emboss algebra; `applyLiveConfig → engine.setLight`; adapter light; `RotoRevealRenderInput.light`; every real-frame cache revision carries `lightCacheTerm` (64-19); the visible committed frame re-bakes once per light change through the Apply seam (64-19); the Play-Script `bakeAquarelleScript` bake remains the declared deferral |
| 5 | Light pigment covers/lightens dark; Body erodes full at core/partial at edges and scatters; Body 50 lightens; Body 0 bit-identical | ✓ VERIFIED; visual UAT 8 pending | `coverPass`/`coverageDeposit`; `bodyCurve=clamp01^6`; `neutral-identity --body 0` PASS; `cover-on` differs from `cover-off`; `scatter-low/high` differ; `white-over-blue` Body 100 now PASS (pct 0, alpha 0.95, gain 0.90, excess 0.71); Body 60/30 honest |
| 6 | Five library sections; group→medium in one write only when the group changes; 15 classified + 8 new | ✓ VERIFIED; visual UAT 10 pending | `brushGroupOrder/Labels/sections`; `BRUSH_PRESETS` = 23 (11 watercolor + 6 pastel + 2 gouache + 2 graphite + 2 acrylic); `pickAquarelleBrush` compares groups before one `applyAquarelleMedium` |
| 7 | Export matches screen on every `uMode`; no shimmer on zoom; undo restores eroded pigment and thickness | ✓ VERIFIED (automated half); UAT 2/6/9 pending | probe paper/transparent/white/pigment digests; mode-4 alpha unshaded; fixed one-texel document-space gradient; dual-pool protection once per stamp; the CR-02 redo-stack destruction is fixed (64-18) so a light drag no longer evicts the ledger |

### Observable Truths (plan must-haves)

#### 64-01 — Viscosity (MED-02..MED-06) — 9 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Viscosity reaches the engine only through `toEngineParams` (/100, clamp 0..1) | ✓ VERIFIED | `params.ts`; `params.test.ts` |
| 2 | At 0 the dissipation is the pre-milestone literal and spread exactly `0.12` | ✓ VERIFIED | `Engine.ts`; `viscosity.test.ts` exact-literal pins |
| 3 | At 100 spread 0.012; at 50 spread 0.066 | ✓ VERIFIED | `0.12*(1-v*0.9)`; test |
| 4 | Viscosity only raises dissipation; never replaces `flow` | ✓ VERIFIED | additive exponent term; test |
| 5 | Read exactly once, applied at exactly two sites | ✓ VERIFIED | count pins in `viscosity.test.ts` |
| 6 | Absent replays 0; non-finite falls back to 0 | ✓ VERIFIED | `toEngineParams`; determinism/params tests |
| 7 | Backstop: post-settle change re-processes nothing | ✓ VERIFIED | source scan forbids settle/display consumers |
| 8 | Pre-milestone stroke byte-identical at default | ✓ VERIFIED | `neutral-identity` probe PASS |
| 9 | Backstop: live/bake/replay at same viscosity identical | ✓ VERIFIED | `determinismContract.test.ts` arms |

#### 64-02 — Five Mediums (MED-01, MED-07..MED-13, MED-19) — 11 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Medium is frozen plain serializable data | ✓ VERIFIED | `mediums.ts`; tests |
| 2 | Viscosity row; canonical bag/keys/defaults carry the key | ✓ VERIFIED | `GLOBAL_ROWS`; `aquarelleRecordState.ts` |
| 3 | Five built-ins over exactly the ten medium keys | ✓ VERIFIED | records pinned by `mediums.test.ts` |
| 4 | `watercolor` equals canonical defaults, new keys 0 | ✓ VERIFIED | derived record; test |
| 5 | A medium never writes `size` or `lift` | ✓ VERIFIED | `MediumParamKey` excludes both |
| 6 | Medium applies in exactly ONE spread write with the id | ✓ VERIFIED | `applyAquarelleMedium`; `mediumSelection.test.ts` |
| 7 | Re-pick re-applies; manual tweak keeps selection | ✓ VERIFIED | independent bag/id compare; tests |
| 8 | Backstop: selecting never alters recorded strokes | ✓ VERIFIED | byte-identical stroke test |
| 9 | Backstop: cross-machine replay identical | ✓ VERIFIED | per-stroke snapshot authority |
| 10 | Medium dropdown first Paint-tab row, selected name | ✓ VERIFIED | panel source + tests |
| 11 | Unknown/absent medium id is a total no-op | ✓ VERIFIED | `mediumById` null; test |

#### 64-03 — Thickness Field (MED-14, MED-16, MED-18) — 11 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One document-resolution `HALF_FLOAT_R` target, cleared, never persisted | ✓ VERIFIED | `relief` target; wipe/reset; `relief.test.ts` |
| 2 | Each dab deposits through its own footprint with paper tooth | ✓ VERIFIED | `reliefFS` + shared `bindFootprint` |
| 3 | Deposits accumulate additively | ✓ VERIFIED | `FUNC_ADD` + `(ONE, ONE)` |
| 4 | Amount = `P.emboss × amount`; at emboss 0 no draw | ✓ VERIFIED | guard + test |
| 5 | Lift erodes thickness with the same footprint | ✓ VERIFIED | `drawRelief` under Lift rect; test |
| 6 | Thickness never flows | ✓ VERIFIED | source audit test |
| 7 | Undo protection positional; snapshot/travel carry it | ✓ VERIFIED | pool-0 formats/views/maps; test |
| 8 | Backstop: undo/redo restores the field exactly | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | structural pairing pinned; no WebGL2 history in vitest |
| 9 | Size change and snapshot restore carry thickness | ✓ VERIFIED | resize forward + WholeDoc RED upload; test |
| 10 | Pen and vector strokes deposit no thickness | ✓ VERIFIED | deposit only in the brush callback |
| 11 | Backstop: replay rebuilds thickness from script alone | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | absence + determinism pinned; reopen visual parity needs GPU |

#### 64-04 — Emboss (MED-15, MED-18) — 8 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Normal from the thickness gradient via one-texel central difference, multiplied into colour | ✓ VERIFIED | `displayFS` block; `emboss.test.ts` |
| 2 | Lit term exactly 1.0 at zero gradient, any intensity, every `uMode` | ✓ VERIFIED | algebra; light-0 identity probe PASS |
| 3 | Light is render state; never in stroke/payload/pigment/thickness | ✓ VERIFIED | `setLight` only; absence tests |
| 4 | Shipped defaults reproduce `paperLightFS`'s direction | ✓ VERIFIED | 129.8/38.45 → (-0.5, 0.6, 0.62); intensity 1 |
| 5 | Emboss is the globals row on 0..100 via the one mapping | ✓ VERIFIED | `GLOBAL_ROWS`; `/100` + clamp |
| 6 | Backstop: fixed document-space sampling prevents shimmer | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | source-pinned; shimmer is perceptual |
| 7 | Export paper/transparent/white carries the shade; mode-4 colour-only | ✓ VERIFIED | shader branch; probe digests |
| 8 | Emboss 0 and light 0 both equal the baseline | ✓ VERIFIED | two probe identity runs PASS |

#### 64-05 — Document Light (MED-17) — 9 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Backstop: absent light stays absent through parse/re-encode | ✓ VERIFIED | `paintDocumentLight.test.ts` |
| 2 | Malformed light fails closed | ✓ VERIFIED | `normalizeDocumentLight` throws; tests |
| 3 | Absent resolves to package `DEFAULT_LIGHT`; never retyped | ✓ VERIFIED | import; no app literals |
| 4 | One store mutation; one bump/notification/descriptor per call | ✓ VERIFIED | `setDocumentLight`; tests |
| 5 | Same-value write is a revision-stable no-op | ✓ VERIFIED | store compare; tests |
| 6 | Backstop: revision includes light; sync fingerprint inherits | ✓ VERIFIED | `lightTerm`; tests |
| 7 | Per-layer independence | ✓ VERIFIED | sibling-layer test |
| 8 | Launch handoff inside the opaque `document` member | ✓ VERIFIED | launch validator delegates to the parser |
| 9 | `MceDocumentLight` dual declaration, field-diff pinned | ✓ VERIFIED | `project.ts` / `project.rs`; `mceFieldContract.test.ts` |

#### 64-06 — Body / Cover Pass (MED-19..MED-25) — 8 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Body row between Viscosity and Emboss; default 0 | ✓ VERIFIED | `GLOBAL_ROWS`; bag/keys/defaults |
| 2 | At Body 0 no cover protection or extra draw; pre-milestone bytes | ✓ VERIFIED | guards; `neutral-identity --body 0` PASS |
| 3 | A dab above 0 erodes settled pigment under its tip before depositing | ✓ VERIFIED | per-dab order; `coverage.test.ts` |
| 4 | Backstop: cover draws only `fixed` and `relief` | ✓ VERIFIED | source + test |
| 5 | One `bodyCurve = clamp01^6`, shared by cover and deposit | ✓ VERIFIED | `scattering.ts`; band pins |
| 6 | Backstop: both pools protected once per stamp | ✓ VERIFIED | caller-wide touch + protect; tests |
| 7 | Body adds no target/texture/program; reuses Lift | ✓ VERIFIED | program binding + audit tests |
| 8 | Snapshot carries `body`; pre-milestone bag maps to 0 | ✓ VERIFIED | snapshot keys; determinism arm |

#### 64-07 — Light on Every Render Path (MED-17) — 7 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One `setDocumentLight` mutation and one unified-ledger entry per gesture | ✓ VERIFIED | closed by 64-18: `coalesceLightGesture` parks the first descriptor; `handleDocumentLightCommit` clears the ref, records ONE span; `useRotoPhysicalEditHistory.test.ts` proves a 30-write drag is one entry, one undo restores the previous light, the same-value gesture records nothing, the redo stack clears once |
| 2 | Live sheet applies the document light every frame | ✓ VERIFIED | `applyLiveConfig(engine, getLight)` at both call sites; idempotent `setLight` |
| 3 | Every enumerated bake path resolves the light (reveal Play + Apply/stroke-edit) | ✓ VERIFIED (enumerated paths; declared deferral for `bakeAquarelleScript`) | adapter light; Studio passes `light: documentLight()` |
| 4 | Light never stored in a stroke/payload/paint | ✓ VERIFIED | type absence; tests |
| 5 | A light change rotates the content signature so a cached artifact keyed on it misses and the next render uses the new light | ✓ VERIFIED | closed by 64-19: `lightCacheTerm` (via `lightSignature`) on all three real-frame revisions; the publish projection and accepted-live-frame revision read `getDocumentLight` at call time; the single-flight relight re-bakes the visible committed frame through the light-resolving Apply lane |
| 6 | Defaults read from package `DEFAULT_LIGHT`; absent renders the engine default | ✓ VERIFIED | import; absent adapter path |
| 7 | Backstop: two paint layers keep independent lights | ✓ VERIFIED | `documentLight()` resolves by layer id; sibling test |

#### 64-08 — Scattering Transport (MED-32, MED-33, MED-37) — 9 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `S` one broadband scalar on `inkB.a`/`fixedB.a`; no new target/pass | ✓ VERIFIED | source audits |
| 2 | Deposit `S = MAX × bodyCurve(body) × amount` at every pigment site | ✓ VERIFIED | three exact sites pinned |
| 3 | `advectInkFS` transports `S` unchanged | ✓ VERIFIED | shader carries B.a; test |
| 4 | `settleFS` carries `S` into the settled layer | ✓ VERIFIED | `oB` law; test |
| 5 | `bodyCurve` is the only sixth-power declaration | ✓ VERIFIED | "no second curve" test |
| 6 | White-gouache retired end to end | ✓ VERIFIED | absence tests |
| 7 | Backstop: `Pigment` never crosses persistence; built only via `pigmentFromHex` | ✓ VERIFIED | retirement audit |
| 8 | Backstop: at body 0 both `B.a` channels are 0 and bytes identical | ✓ VERIFIED | deposit law + probe identity |
| 9 | Constants declared once and interpolated | ✓ VERIFIED | `scattering.ts` + spectral import; kmBand pins |

#### 64-09 — Paper & Light Tab (MED-17) — 5 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Three light rows below grain; label `Paper & Light` | ✓ VERIFIED | `RightPanelPaperTab.tsx`; label map |
| 2 | Controlled by the document light with `DEFAULT_LIGHT` fallback | ✓ VERIFIED | `props.light ?? DEFAULT_LIGHT`; `rightPanelProps.light` |
| 3 | One-field patch to `handleDocumentLightChange`; view touches no store | ✓ VERIFIED | each row emits one field; no store import |
| 4 | Studio carries `light`/`onLightChange` into `rightPanelProps` | ✓ VERIFIED | Studio source; panel threading |
| 5 | Same-value: no descriptor/churn; real change: exactly one ledger entry | ✓ VERIFIED | closed by 64-18: each row also emits `onCommit` (RightPanelPaperTab 67-96) → `handleDocumentLightCommit`; the coalescer decides span-or-nothing; the store no-op still covers same-value writes |

#### 64-10 — Kubelka-Munk Composite (MED-34..MED-36, MED-38) — 8 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each band reconstructs KM layer-over-background; paper multiply untouched | ✓ VERIFIED | `displayBasisGLSL`; `kmBand.test.ts` |
| 2 | Absorption input is HALF the stored exponent (T² = exp(-K) at S→0) | ✓ VERIFIED | `k = 0.5*A`; test |
| 3 | At/below epsilon today's exact arithmetic runs | ✓ VERIFIED | legacy lines character-for-character; identity probe |
| 4 | KM branch numerically total | ✓ VERIFIED | totality tests |
| 5 | Granulation/edge scale scattering exactly as absorption | ✓ VERIFIED | `scatter *= k`; test |
| 6 | High Body erases+scatters; low Body scatters only | ✓ VERIFIED | shared curve; cover/scatter gates |
| 7 | Backstop: repeats identical; three exports render the scattered scene | ✓ VERIFIED | repeat digests equal; all differ from scatter-off |
| 8 | Backstop: no new allocation/pass; cost bounded | ✓ VERIFIED | source audits; HD bake/render times recorded |

#### 64-11 — Brush Groups (MED-26, MED-27, MED-29..MED-31) — 7 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Compile-time `group: MediumId`; absent reads watercolor; not persisted | ✓ VERIFIED | `brushes.ts`; no serialized field |
| 2 | Backstop: 15 existing keep ids/order/params/tip bytes; 11/4 split; 8 new | ✓ VERIFIED | git diff only adds `group:` tags; `brushes.test.ts` |
| 3 | Eight new unique ids; no rename/removal | ✓ VERIFIED | 23 presets; id pins |
| 4 | One section per group in fixed order; no filter/search/collapse | ✓ VERIFIED | `WatercolorBrushLibrary.tsx`; `brushSections` |
| 5 | Empty group not rendered | ✓ VERIFIED | filter + test |
| 6 | Texture strip above every section; orthogonal | ✓ VERIFIED | `brushGroupMedium.test.ts` |
| 7 | New tips deterministic, same cost class | ✓ VERIFIED | byte-identical tip test |

#### 64-12 — Group-to-Medium Pick (MED-28) — 7 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Differing group applies the medium; same group writes nothing | ✓ VERIFIED | `pickAquarelleBrush`; tests |
| 2 | Application is `applyAquarelleMedium` (one bag write + id) | ✓ VERIFIED | one spread write test |
| 3 | Committed patch stays `{brushId, toolOverrides}` | ✓ VERIFIED | patch-shape test |
| 4 | Group IS the medium id; non-preset → no write | ✓ VERIFIED | `groupOfPreset`; test |
| 5 | Outgoing group read before the live pick | ✓ VERIFIED | source order |
| 6 | Backstop: Paint tab agrees; texture changes neither | ✓ VERIFIED | agreement tests |
| 7 | Backstop: every response surface funnels through the one seam | ✓ VERIFIED | source-audit tests |

#### 64-13 — Coverage Composite (8 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Source-over inside the pigment layer with one shared per-dab alpha; near-white pigment hides what is beneath | ✓ VERIFIED | `Engine.ts` brush case; `coverage.test.ts`; `red-over-blue-50` and `white-over-blue` crossing reads 241.04/241.21/241.75 vs the rev-4 210/226/246 |
| 2 | Body 0 takes the additive path unchanged, cover stays zero, no coverage draw; 256² neutral byte-identical; 1080² identity re-proven | ✓ VERIFIED | guard path; `neutral-identity` and `watercolor-50` probes PASS |
| 3 | Rev-4 erase machinery deleted (no `preInk`, no `inkCover` ping-pong, no `onCoverDab`, no full-canvas pass) | ✓ VERIFIED | comment-stripped absence pins; `grep preInk` = 0 across probe files |
| 4 | Mode 4 alpha reduces exactly to the legacy formula where cover is 0 | ✓ VERIFIED | mode-4 branch; `neutral-pigment` equals `neutral-identity` |
| 5 | Coverage amount pigment-independent (`COVER_GAIN`, `COVER_MEDIUM_DENSITY = 8`) | ✓ VERIFIED | constants + derivation tests |
| 6 | Backstop: fixed erosion runs before compositing; both pools protected once per stamp | ✓ VERIFIED | order/protection pins in `coverage.test.ts` |
| 7 | `pigment` background is a new export name on the existing mode-4 program; other exports unchanged | ✓ VERIFIED | MODE map; four-digest captures; `neutral-pigment` PASS |
| 8 | Invalidated suites updated and gated in the plan | ✓ VERIFIED | package suite green (33 files / 606 passed / 8 skipped) |

#### 64-14 — Coverage Lifecycle (7 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Coverage advects with the ink (mobility gate, back-trace, face fluxes, diffusion, clamp) | ✓ VERIFIED | `advectCoverFS`; `coverageLifecycle.test.ts`; `cover-advect` PASS |
| 2 | Coverage does not decay through settle (keep = 1) | ✓ VERIFIED | advect law + test |
| 3 | Undo/redo restore coverage with pigment and thickness (fifth pool layer/view/travel entry) | ✓ VERIFIED (structural; live undo is UAT 2) | five-entry pool/view/map pins |
| 4 | Whole-document transport carries coverage both ways incl. resize/apply | ✓ VERIFIED | capture/upload/apply/resize pins |
| 5 | Backstop: Lift reduces coverage with the same program/rect/blend, after fixed and before relief erode | ✓ VERIFIED | `cover-lift` PASS; source order |
| 6 | Lifecycle gates pinned (`cover-advect` spreads without paper-white; `cover-lift` erodes) | ✓ VERIFIED | both gates PASS with committed baselines |
| 7 | Invalidated suites updated and gated | ✓ VERIFIED | package suite green |

#### 64-15 — Capture Seam (11 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A covering stroke is an ordinary brush stroke through `captureLivePixels` | ✓ VERIFIED | capture handler; seam contract |
| 2 | The commit consumes the coverage sheet end to end (`'pigment'` export, eager, `mergeBlend: 'pigment-alpha'`) | ✓ VERIFIED (see WR-02 warning for the fully-opaque case) | `exportCanvas('pigment')`; merge blend |
| 3 | The coverage sheet is guarded (`isFullyOpaqueRaster` + transparent fallback, null fallback) | ✓ VERIFIED as specified | seam-contract pins — but see WR-02: the fallback itself misreads a saturated coverage sheet |
| 4 | Committed alpha at a coverage pixel is the engine's coverage alpha | ✓ VERIFIED | `crossCoverAlpha` 0.95 vs `crossDarkAlpha` 0.05 (gate ≥ 0.60) |
| 5 | Cover transaction deleted, not disabled | ✓ VERIFIED | absence pins |
| 6 | Protections removed with it; the ones serving other paths kept | ✓ VERIFIED | contract test |
| 7 | Cover preview plumbing deleted end to end | ✓ VERIFIED | contract test |
| 8 | `onResetSheetReady` collapses to one argument | ✓ VERIFIED | source + tests |
| 9 | Studio suite updated and gated | ✓ VERIFIED | `PhysicsPaintStudio.test.ts` green (445 rows) |
| 10 | No cover punch in the app tree; Lift-only punch | ✓ VERIFIED | contract test |
| 11 | Lift contract unchanged | ✓ VERIFIED | tests |

#### 64-16 — Probe Matrices (6 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A textured tip covers through its crumbly mask (`cover-textured`) | ✓ VERIFIED | `cover-textured` PASS (91b28a74 / 65e86e96 / b38156ce / a8bb33d1) |
| 2 | The three Spike 001 numbers are standing invariants on committed baselines | ✓ VERIFIED (installed and now green) | `SCENARIO_INVARIANTS`; comparator hard-fails on `coveredPaperWhitePct !== 0`; white-over-blue passes after 64-20 |
| 3 | `--brush <id>` reaches every entry; unknown id fails loudly; report echoes | ✓ VERIFIED | `harness.test.ts` pins |
| 4 | UAT rows 2/7/8 describe the coverage model and no row is answered | ✓ VERIFIED | `64-UAT.md`: `status: testing`, 10 × `result: [pending]`, `number: 1`, `awaiting: user response` |
| 5 | Body 0 byte-identical (neutral + watercolor-50) after every probe change | ✓ VERIFIED | both probes PASS |
| 6 | All 76 spec-less rows accounted for | ✓ VERIFIED | reconciliation ledger in the SUMMARY; 56 classified + 20 named |

#### 64-17 — Identity Law and Spike Criterion 1 (6 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every report digests `pigment`; `run.mjs` refuses a missing digest; comparator compares it strictly | ✓ VERIFIED | capture-side enforcement; `harness.test.ts` |
| 2 | 1080² Body-0 watercolor reproduces `2b4a86d7 / 7f56e401 / bc74be59` | ✓ VERIFIED | `watercolor-50` PASS with those exact digests |
| 3 | At Body 100 the crossing reads `crossCoverAlpha − crossDarkAlpha ≥ 0.60` | ✓ VERIFIED | 0.95 − 0.05 = 0.90 |
| 4 | Body 60/30 keep the matrix honest and **no body value raises covered paper-white** | ✓ VERIFIED | closed by 64-20: Body 100 `white-over-blue` PASS — `coveredPaperWhitePct` 0, all four digests equal the committed baseline 905823e6 / a5c4ebd6 / 2bf6f14b / 786fcb32, census null; Body 60 (0.23 / 0.08 / 31.46) and Body 30 (0.17 / 0.00 / 41.08) keep pct 0 |
| 5 | `cover-over-wet` re-specified for the coverage model | ✓ VERIFIED | gate PASS; retired directional claim recorded |
| 6 | Body 0 byte-identical through every probe change | ✓ VERIFIED | neutral + watercolor-50 PASS |

#### 64-18 — Light Gesture Ledger (MED-17) — 4 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One light-slider gesture produces exactly ONE unified-ledger entry: per-move `onChange` stays for the live sheet, the Studio records nothing until `onCommit`, then records a single descriptor spanning the pre-gesture document and the document at release | ✓ VERIFIED | `documentLightGesture.ts`; `handleDocumentLightChange` parks the first descriptor (2931-2936); `handleDocumentLightCommit` clears the ref, coalesces against the live document and records once (2941-2953); `useRotoPhysicalEditHistory.test.ts` 30-write drag = one entry |
| 2 | A same-value gesture produces no descriptor and no panel churn | ✓ VERIFIED | `coalesceLightGesture` returns null when `lightSignature(before.light) === lightSignature(after.light)`; commit with no parked descriptor records nothing; tests |
| 3 | A real light change produces exactly one ledger entry, so one undo restores the previous light, and the redo stack is cleared exactly once | ✓ VERIFIED | `useRotoPhysicalEditHistory.test.ts` undo restores absent light; same-value leaves redo intact; a real gesture clears redo once |
| 4 | The live sheet still re-lights during the drag: the per-move document writes stay the only light state, so the engine's document read keeps driving the live preview | ✓ VERIFIED (mechanism; visible outcome UAT 4) | exactly one `setDocumentLight` call site (`writeDocumentLight`, 2888-2893); the per-move path records nothing; the live layer's per-frame document read is unchanged (`aquarelleLightRenderPaths.test.ts`) |

#### 64-19 — Committed-Frame Relight (MED-17) — 4 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A light change rotates the committed frame's cache revision: every real-frame cache revision carries the canonical `lightSignature`; same value identical; absent == explicit DEFAULT_LIGHT | ✓ VERIFIED | `lightCacheTerm` (299-301) delegates to `lightSignature`; all three `buildRotoRealCacheRevision` sites (318, 371, 593-597) carry it; `getDocumentLight` input read at the publish projection (474) and accepted-live-frame revision (596); `useRotoFramePersistenceCoordinator.test.ts` four 64-19 rows incl. a three-call source scan |
| 2 | The visible committed frame is re-baked with the new light exactly once per gesture, through the Apply seam, not a draw-time tint and not `handleRebakeScript` | ✓ VERIFIED (mechanism; visible outcome UAT 4) | `createSingleFlightRelight`; the Studio run is created once (2906-2929) over `rotoScriptRef` and calls `applyAquarelleTimeline(getAquarelleEventsForFrame(launch.startFrame))`; the gesture commit requests once after the ONE ledger record (2953); Studio pins forbid `handleRebakeScript`; `AquarelleCachedBaseLayer` keeps its url-only contract |
| 3 | An undo or redo that changed the document light re-lights the visible committed frame the same way | ✓ VERIFIED (mechanism; visible outcome UAT 4) | the sync light diff sits above the fallback early return with a first-call baseline and no bake (6461-6483); undo/redo call `syncBackgroundSettingsFromDocument` on change (6527, 6546); source pins in `PhysicsPaintStudio.test.ts` |
| 4 | The re-bake is bounded: one in flight, at most one queued, refused while playing / Draft / wireframe; per-move writes never trigger a bake | ✓ VERIFIED | `committedFrameRelight.test.ts` six rows (coalescing, one busy-false follow-up, rejection safety, gated settle); Studio guards read live state (`isPlayingRef`, `draftMode.peek()`, `wireframeMode.peek()`); the per-move handler has no request |

#### 64-20 — Coverage/Film Coherence (MED-19, MED-20, MED-21) — 5 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | At Body 100 the white-over-blue crossing passes every bar on a fresh capture: `coveredPaperWhitePct` exactly 0, `crossCoverAlpha` ≥ 0.90, gain ≥ 0.60, `crossBlueExcess` ≤ 5; the invariant is untouched | ✓ VERIFIED | fresh 1080² re-run: pct 0, alpha 0.95 vs dark 0.05 (gain 0.90), excess 0.71; all four digests equal the committed baseline; `compare.mjs` `SCENARIO_INVARIANTS` unchanged |
| 2 | Body 60 keeps the partial cover (alpha < 0.50, gain ≥ 0.04, excess in [15, 38]); Body 30 keeps the underlayer (excess ≥ 38, gain ≤ 0.03); neither raises covered paper-white | ✓ VERIFIED | 60: 0.23 / 0.08 / 31.46 / pct 0; 30: 0.17 / 0.00 / 41.08 / pct 0; both `--differs-from white-over-blue` |
| 3 | Coverage transport is scaled by the display's own basis reconstruction of the film; a paper-white film transports zero; one reconstruction, one granulation literal, two constants from the scan's 250/255 line | ✓ VERIFIED | one `FILM_PRESENCE` snippet (shaders.ts 320) inlined by `advectCoverFS`; `PAPER_WHITE = 250.0/255.0`, `PAPER_WHITE_RAMP = 5.0/255.0`; `displayBasisGLSL()` reused; quantize before luma mean; source pins in `shaders.test.ts` / `coverageLifecycle.test.ts` |
| 4 | Body 0 is byte-identical: `neutral-identity`, `neutral-pigment`, `watercolor-50` keep their committed digests with no baseline edit | ✓ VERIFIED | all three probes PASS against unchanged baselines; gap-cycle diff touches only the six Body>0 baselines |
| 5 | Every Body>0 baseline is re-captured only after its own invariants hold; no bar widened, no invariant edited, no failing capture written | ✓ VERIFIED | six Body>0 baselines re-captured (cover-advect, cover-lift, cover-over-wet, cover-textured, red-over-blue-50, white-over-blue) from captures that already passed; comparator diff empty; white-over-blue baseline note records the bars and forbids regeneration |

**Score:** 147/150 truths verified; 0 failed; 3 present, behavior-unverified (see `behavior_unverified_items`).

## Declared Deferrals

| Item | Status | Evidence |
| --- | --- | --- |
| `bakeAquarelleScript` (Roto Play-Script consume/Apply branch) still renders with the engine default light | **Open — declared deferral; explicitly scoped out of UAT row 5** | `physicsPaintRotoPlayScriptController.ts` (`bakeAquarelleScript` creates its adapter via `ports.createAquarelleAdapter(size, paper)` / `createDefaultAquarelleAdapter(size, paper)` with no light; call sites 3154, 3530, 3815). Logged in `deferred-items.md` and `.planning/WINDOWS.md` row 125 (`unmet-truth`, open). Threading it needs a port-signature change plus a staged-cache key term. Phase 65 (Studio API/MCP) does not cover it. Every enumerated 64-07 path is wired; this Play-Script bake is the sole documented exception. |

## Review Findings Assessed

`64-REVIEW.md` (written 20:44) reviewed plans 64-01..64-17 only. The user deliberately skipped a re-review of the 64-18..64-20 gap commits after the fixes; this verification covers those commits by code and test evidence. `64-REVIEW-DISPOSITION.md` still lists all seven findings as `open` — that bookkeeping is stale for CR-01/CR-02, which are fixed here:

| Finding | Severity | Bearing after the gap closure |
| --- | --- | --- |
| CR-01 — a light change never re-lights a committed or cached frame | critical | **FIXED by 64-19.** The cache revision carries `lightCacheTerm` at all three real-frame sites and the visible frame re-bakes once through the light-resolving Apply seam. Verified in code and tests; disposition file not yet updated (review process, not a phase gap). |
| CR-02 — one light-slider drag appends one write and one ledger entry per pointermove | critical | **FIXED by 64-18.** Rows pass `onCommit`; the Studio parks the first descriptor and records one coalesced span at release. A 30-write drag is one ledger entry in the test. Disposition file not yet updated. |
| WR-01 — fixed draw extents clip relief/coverage for wide tips | warning | Unchanged: relief extent 1.5 vs tip aspects up to 2.0, coverage extent 2 vs user aspect up to 2.0. Light-tip clipping, not a must-have falsification. |
| WR-02 — a fully opaque coverage export is misread as transmittance | warning | Unchanged and phase-relevant: for a saturated coverage sheet the guard's fallback loses the pigment alpha on committed frames. 64-15 truth 3 is verified as *specified*; impacts UAT row 9. |
| IN-01 — dead `coeffsOpacity` with a false docstring | info | Present; dead code in the shipped package. |
| IN-02 — `fillStep` applies scattering but no Body cover | info | Present; bucket fill has no cover term. |
| IN-03 — Azimuth 360 wraps to 0 | info | Present; the knob snaps left on release at 360. |

## Required Artifacts

`verify.artifacts` returns `{ all_passed: false, passed: 0, total: 0 }` for 64-18/19/20 because those plans declare artifacts as bare path strings (the verb parses object entries only); the same limitation applied to plans 01-17. Artifacts were therefore checked at all four levels manually. All declared artifact paths exist, are substantive, are wired, and carry real data.

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/efx-watercolor/src/playground/params.ts` | canonical→engine viscosity/body/emboss mapping | ✓ VERIFIED | /100 + clamp01 at the one seam |
| `packages/efx-watercolor/src/playground/mediums.ts` | five frozen records over ten keys | ✓ VERIFIED | gouache/pastel(Chalk)/graphite/acrylic + derived watercolor |
| `packages/efx-watercolor/src/playground/scattering.ts` | one Body curve + deposit law + constants | ✓ VERIFIED | exponent 6, MAX 8, epsilon 1e-3 |
| `packages/efx-watercolor/src/playground/Engine.ts` | viscosity sites, relief target, cover/coverage passes, light state, advectCover, capture-time clearance | ✓ VERIFIED | 4-level; coverage fifth pool layer; `clearPaperWhiteCoverage` bound in the pigment readback |
| `packages/efx-watercolor/src/playground/shaders.ts` | reliefFS, settle carry, emboss display, legacy/KM branches, advectCoverFS with FILM_PRESENCE, cover deposit/mask, coverClearFS | ✓ VERIFIED | mode-4 alpha unshaded; one FILM_PRESENCE snippet; deposit deliberately ungated |
| `packages/efx-watercolor/src/playground/spectral.ts` | KM generator with epsilon legacy branch | ✓ VERIFIED | `Pigment = { coeffs }` only |
| `packages/efx-watercolor/src/playground/brushes.ts` | group tag/helpers + 23 presets | ✓ VERIFIED | 15 legacy tagged, 0 legacy changes |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | light option applied once before first stroke | ✓ VERIFIED | adapter tests |
| `packages/efx-watercolor/probe/medium-engine/*` | harness, comparator, nine committed baselines, offender census | ✓ VERIFIED | four-digest enforcement; invariants; census shares the pct scan (probe.ts 496/550, white-over-blue report only) |
| `app/src/components/physic-paint/engine/documentLightGesture.ts` | first-descriptor parking + canonical-signature coalescer | ✓ VERIFIED | pure; `lightSignature` compared, never retyped; wired into the commit handler |
| `app/src/components/physic-paint/engine/committedFrameRelight.ts` | pure change test + bounded single-flight scheduler | ✓ VERIFIED | one in flight, one queued follow-up, swallowed rejection, gated settle; wired into the Studio |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` | ten rows + medium dropdown | ✓ VERIFIED | viscosity/body/emboss last |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | bag keys/defaults, selected medium, one-write handler | ✓ VERIFIED | snapshot + tests |
| `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` | three light rows below grain, `onChange` + `onCommit` | ✓ VERIFIED | rows 67-96 emit one-field patches for both handlers |
| `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` | `Paper & Light`, light props threading | ✓ VERIFIED | both `onLightChange` and `onLightCommit` declared and forwarded |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | documentLight, gesture seam, relight run, cache input, undo/redo sync | ✓ VERIFIED | one store writer; one ledger record per gesture; one bounded Apply-lane re-bake per change |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | per-frame `setLight` via getLight | ✓ VERIFIED | live sheet only |
| `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` | committed sheet display | ✓ VERIFIED (url-only contract retained BY DESIGN) | 64-19 rejected draw-time re-lighting for cause (the emboss is baked from a non-persisted thickness field); the cache term plus the re-bake make the light reach the pixels |
| `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` | frame cache revision with the light term | ✓ VERIFIED | `lightCacheTerm` at exactly three real-frame sites; input read at call time |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | unified ledger with background-edit descriptors | ✓ VERIFIED | one coalesced entry per gesture; 10-entry trim and redo clear run once |
| `app/src/stores/efxPaintStore.ts` | setDocumentLight + operation kind | ✓ VERIFIED | one bump/descriptor per call |
| `app/src/efx-paint/document/efxPaintDocument*.ts` | optional light, fail-closed parser, revision term | ✓ VERIFIED | absent stays absent |
| `app/src/types/project.ts` + `app/src-tauri/src/models/project.rs` | `MceDocumentLight` dual declaration | ✓ VERIFIED | field-contract test |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | five always-expanded sections | ✓ VERIFIED | `brushSections` order |
| `app/src/components/physic-paint/view/aquarellePaintControls.ts` | `pickAquarelleBrush` seam | ✓ VERIFIED | outgoing group read first |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | light on every enumerated bake path | ✓ VERIFIED (declared deferral for `bakeAquarelleScript`) | `applyAquarelleEventsToKey` forwards `light`; the deferred Play-Script bake documented above |

## Key Link Verification

`verify.key-links` also returns no parsed links for these plans (key links are prose, not object entries), so each link was traced in source.

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | `efxPaintStore.ts` | row `onChange`/`onCommit` → `handleDocumentLightChange`/`handleDocumentLightCommit` → `setDocumentLight` | WIRED | one store writer; one ledger entry per gesture |
| `documentLightGesture.ts` | `physicsPaintStudioSettings.ts` | `coalesceLightGesture` compares `lightSignature` | WIRED | canonical normalizer, never retyped |
| `PhysicsPaintStudio.tsx` | `useRotoFramePersistenceCoordinator.ts` | `getDocumentLight` input + `documentLight()` at the three projections | WIRED | every real-frame cache revision carries one identical light term |
| `useRotoFramePersistenceCoordinator.ts` | `AquarelleCachedBaseLayer.tsx` | new cache revision → cache miss → fresh bake → `url` | WIRED | the light now reaches the committed pixels through the bakes |
| `PhysicsPaintStudio.tsx` | `physicsPaintRotoScriptClipboard.ts` (`applyAquarelleTimeline`) | the relight run calls the Apply lane | WIRED | light resolved at bake time; no seed reroll; no ledger entry |
| `committedFrameRelight.ts` | `physicsPaintStudioSettings.ts` | change test via `lightSignature` | WIRED | same normalizer as the content signature |
| `PhysicsPaintStudio.tsx` | `engineAdapter.ts` | `documentLight()` → `light` option → `setLight` before first stroke | WIRED | reveal/Apply/stroke-edit paths |
| `AquarelleCanvasLayer.tsx` | `Engine.ts` | `getLight()` → `applyLiveConfig` → `engine.setLight` | WIRED | live sheet every frame |
| `PhysicsPaintStudio.tsx` | `physicsPaintRotoPlayScriptRenderer.ts` | `renderRotoRevealFrames({ light })` → adapter | WIRED | reveal Play bake |
| `physicsPaintRotoPlayScriptController.ts` | `engineAdapter.ts` | `bakeAquarelleScript` adapter creation | PARTIAL | no light parameter (declared deferral) |
| `AquarelleGlobalsPanel.tsx` | `aquarelleRecordState.ts` | dropdown → `applyAquarelleMedium` | WIRED | one bag write + id |
| `WatercolorBrushLibrary.tsx` | `aquarellePaintControls.ts` | card pick → `pickAquarelleBrush` → medium only on group change | WIRED | source-audited |
| `Engine.ts` relief target | `displayFS` | texture unit 7 `uRelief` | WIRED | emboss shade |
| `Engine.ts` coverage | `displayFS` mode 4 | cover channel → alpha/pigment reconstruction | WIRED | `pigment` export + capture merge |
| `Engine.ts` scattering | `spectral.ts` KM | `inkB.a`/`fixedB.a` → `settleFS` → `displayFS` scatter | WIRED | one scalar, no new pass |
| `Engine.ts` `coverClear` | pigment readback | clearance where final film reads paper-white | WIRED | runs only in `MODE.pigment`; `cov > 0` scoped |
| `shaders.ts` `FILM_PRESENCE` | `advectCoverFS` | coverage transport scaled by the display reconstruction | WIRED | one snippet, one granulation literal |
| `PhysicsPaintStudio.tsx` capture handler | merge | `exportCanvas('pigment')` → `mergeBlend: 'pigment-alpha'` | WIRED (unsound guard) | WR-02 fully-opaque fallback |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | `light` | `documentLight()` reads the active layer document; `DEFAULT_LIGHT` fallback | Yes | ✓ FLOWING |
| `AquarelleCanvasLayer.tsx` | `getLight()` | document getter per frame → `engine.setLight` → display uniforms | Yes | ✓ FLOWING |
| `AquarelleCachedBaseLayer.tsx` | baked pixels | frame cache bytes keyed on (paper, light) → decode → draw; a light change misses and re-bakes | Yes | ✓ FLOWING |
| `committedFrameRelight.ts` | `run()` result | the Studio run reads the live document light and bakes through the Apply lane | Yes | ✓ FLOWING |
| `AquarelleGlobalsPanel.tsx` | `GLOBAL_ROWS` values | live canonical bag | Yes | ✓ FLOWING |
| `AquarelleGlobalsPanel.tsx` | `selectedMedium` | `aquarelleSelectedMediumId` → `mediumById` | Yes | ✓ FLOWING |
| `engineAdapter.ts` | `options.light` | Studio document read | Yes | ✓ FLOWING |
| `displayFS` | `uRelief` | the engine `relief` target written by the dab deposit | Yes | ✓ FLOWING |
| `displayFS` | `scatter` | `inkB.a`/`fixedB.a` written by `scatteringDeposit`, carried by settle | Yes | ✓ FLOWING |
| `displayFS` mode 4 | `cover` | the double-buffered HALF_FLOAT_R coverage pair, advected and Lift-eroded | Yes | ✓ FLOWING |
| `advectCoverFS` | film presence | the display's own reconstruction of the combined ink+fixed film | Yes | ✓ FLOWING |
| `WatercolorBrushLibrary.tsx` | `brushSections` | `BRUSH_PRESETS` (23 grouped records) | Yes | ✓ FLOWING |
| `pickAquarelleBrush` | group | preset table at read time | Yes | ✓ FLOWING |

No disconnected flow remains: the previously hollow light→committed-frame path is closed by 64-19. No `return []`/`return {}`/hardcoded-empty flows were found in rendered values; the `return null` guards are legitimate (unknown medium id, non-preset id, no launch context).

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full efx-watercolor suite | `pnpm exec vitest run` (cwd `packages/efx-watercolor`) | 33 files, 606 passed, 8 skipped | ✓ PASS |
| Probe harness suite | `npx vitest run harness.test.ts` (cwd `packages/efx-watercolor/probe/medium-engine`) | 28 passed | ✓ PASS |
| Gap-cycle app test files (8) | `pnpm exec vitest run` on documentLightGesture, committedFrameRelight, useRotoFramePersistenceCoordinator, useRotoPhysicalEditHistory, rotoReferenceOnlyTolerance, aquarelleLightRenderPaths, physicsPaintRightPanelPaperSingleHome, physicPaintBridge.launchPackBytes | 8 files, 162 passed | ✓ PASS |
| Studio + right-panel suites | `pnpm exec vitest run PhysicsPaintStudio.test.ts PhysicsPaintRightPanel.test.ts` | 2 files, 487 passed (445 + 42) | ✓ PASS |
| Typecheck | `tsc --noEmit` (app) | exit 0 | ✓ PASS |
| Neutral identity | `run.mjs --gate neutral-identity` + `compare.mjs` | committed digests equal (d2bd637a / 291d4a11 / 6ba88334 / 13b8af1d) | ✓ PASS |
| Watercolor-50 identity | `run.mjs --gate watercolor-50 --size 1080` + compare | 2b4a86d7 / 7f56e401 / bc74be59 / 432f3a3f — equal | ✓ PASS |
| White-over-blue Body 100 | `run.mjs --gate white-over-blue --scenario white-over-blue --size 1080 --body 100` + compare | 905823e6 / a5c4ebd6 / 2bf6f14b / 786fcb32 — equal; pct 0; alpha 0.95 / gain 0.90 / excess 0.71; census null | ✓ PASS |
| White-over-blue Body 60/30 | same gate with `--body 60` / `--body 30`, `--differs-from white-over-blue` | 60: alpha 0.23, gain 0.08, excess 31.46, pct 0; 30: alpha 0.17, gain 0.00, excess 41.08, pct 0; both differ from the Body-100 baseline | ✓ PASS |
| Known flake excluded | `app/src/lib/physicPaintBridge.test.ts` "63-05 brush-tip realm channels" | not run as part of this verification; documented full-suite flake (bd efx-motion-editor-4ro.53), file untouched by phase 64, 5/5 isolated runs pass per the known-flake note | not a phase-64 signal |

## Probe Execution

All nine gates were run from the repository root in a headless WebGL2 Chrome. Every gate is PASS.

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| neutral-identity | `run.mjs --gate neutral-identity` && `compare.mjs neutral-identity` | d2bd637a / 291d4a11 / 6ba88334 / 13b8af1d; equal | PASS |
| neutral-pigment | `run.mjs --gate neutral-pigment --size 256` && compare | equals neutral-identity (4/4) | PASS |
| watercolor-50 | `run.mjs --gate watercolor-50 --scenario watercolor-50 --size 1080` && compare | 2b4a86d7 / 7f56e401 / bc74be59 / 432f3a3f; equal | PASS |
| cover-advect | `run.mjs --gate cover-advect --scenario cover-advect --size 256 --body 100` && compare | equal; coveredPaperWhitePct 0 | PASS |
| cover-lift | `run.mjs --gate cover-lift --scenario cover-lift --size 256 --body 100` && compare | equal; coveredPaperWhitePct 0 | PASS |
| cover-textured | `run.mjs --gate cover-textured --scenario cover-textured --size 512 --body 100 --brush chalk` && compare | 91b28a74 / 65e86e96 / b38156ce / a8bb33d1; equal; pct 0 | PASS |
| red-over-blue-50 | `run.mjs --gate red-over-blue-50 --scenario red-over-blue-50 --size 1080 --body 100` && compare | equal; coveredPaperWhitePct 0 | PASS |
| cover-over-wet | `run.mjs --gate cover-over-wet --scenario cover-over-wet --size 256 --body 100` && compare | equal | PASS |
| white-over-blue | `run.mjs --gate white-over-blue --scenario white-over-blue --size 1080 --body 100` && `compare.mjs white-over-blue` | 905823e6 / a5c4ebd6 / 2bf6f14b / 786fcb32; equal; pct 0; census null; exit 0 | PASS (was FAILED pre-64-20) |

The comparator (`compare.mjs`), the invariant list, and every bar are byte-identical to the pre-gap version; only the six Body>0 baseline records were re-captured.

## Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `documentLightGesture.test.ts` | MED-17 | 5 | 0 | no | Behavioral (30 expect calls; multi-step coalescing) | PASS |
| `committedFrameRelight.test.ts` | MED-17 | 6 | 0 | no | Behavioral (18 expect calls; scheduler interleavings, settle ordering) | PASS |
| `useRotoFramePersistenceCoordinator.test.ts` | MED-17 | all active | 0 | no | Value (revision equality/inequality, exact three-call scan) | PASS |
| `useRotoPhysicalEditHistory.test.ts` | MED-17 | all active | 0 | no | Behavioral (30-write drag, undo/redo stack states) | PASS |
| `PhysicsPaintStudio.test.ts` | MED-17/19/20 | 445 | 0 | no | Status (source pins for wiring) + behavioral elsewhere | PASS |
| `shaders.test.ts`, `coverageLifecycle.test.ts` | MED-19/20/21 | all active | 0 | no | Value (snippet/const presence, transport law) | PASS |
| `probe/medium-engine/harness.test.ts` | MED-19..21 | 28 | 0 | partial (see note) | Status/Value (report shape, digest enforcement) | PASS with note |
| package engine suites (viscosity, mediums, scattering, kmBand, emboss, relief, coverage, determinism) | MED-01..38 | all active | 0 | no | Value/Behavioral | PASS |

**Disabled tests on requirements:** 0 (two grep hits were `.pending` substrings in identifiers, not skipped tests).
**Circular patterns detected:** 0 in test files. Note: the probe capture harness writes baseline JSON from the engine under test by design; the Body>0 baselines are therefore self-captured oracles, but they are gated by absolute bars (`coveredPaperWhitePct === 0`, crossing thresholds) and the identity baselines (`neutral-identity`, `neutral-pigment`, `watercolor-50`) predate the milestone and are external oracles. This is the phase's explicitly specified baseline policy, not a hidden circularity.
**Insufficient assertions:** 0 blockers. The 64-18/64-19 behaviour lives in behavioural unit tests, not only source pins; the source pins cover the Studio wiring the node environment cannot mount.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts. (20/20 honored; 0 not honored.)

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MED-01 | 64-02 | Viscosity global row, 0..100 → 0..1 | ✓ SATISFIED | `GLOBAL_ROWS`; bag keys/defaults |
| MED-02 | 64-01 | Neutral default bit-identical | ✓ SATISFIED | `neutral-identity` PASS |
| MED-03 | 64-01 | Dissipation only raises; two sites only | ✓ SATISFIED | additive exponent; count pins |
| MED-04 | 64-01 | Spread `0.12*(1-v*0.9)` | ✓ SATISFIED | source + tests |
| MED-05 | 64-01 | Per-stroke viscosity snapshot; live=bake=replay | ✓ SATISFIED | snapshot + determinism arms |
| MED-06 | 64-01 | Post-settle change does not reprocess | ✓ SATISFIED | source scan |
| MED-07 | 64-02 | Medium plain record | ✓ SATISFIED | `mediums.ts` |
| MED-08 | 64-02 | `watercolor` = today's defaults; fresh session | ✓ SATISFIED | derived record |
| MED-09 | 64-02 | Five built-ins with recorded numbers | ✓ SATISFIED | records pinned |
| MED-10 | 64-02 | One store write per switch | ✓ SATISFIED | `applyAquarelleMedium` |
| MED-11 | 64-02 | Never alters recorded strokes | ✓ SATISFIED | byte-identical test |
| MED-12 | 64-02 | Cross-machine replay via snapshot authority | ✓ SATISFIED | snapshot + determinism |
| MED-13 | 64-02 | Existing Studio UI; manual tweak keeps medium | ✓ SATISFIED | dropdown + tests |
| MED-14 | 64-03 | Half-float thickness via each dab's footprint, superposes | ✓ SATISFIED | target + blend law |
| MED-15 | 64-04 | Lit emboss; emboss 0 / intensity 0 byte-identical | ✓ SATISFIED | algebra + probe gates |
| MED-16 | 64-03 | Emboss canonical param; no transport asset | ✓ SATISFIED | params bag; tests |
| MED-17 | 64-05/07/09/18/19 | Document light; every render path; persisted; cache fingerprint; one gesture one history entry | ✓ SATISFIED (declared deferral: `bakeAquarelleScript`) | persistence/parser/revision/dual declaration/live sheet/reveal+Apply bakes verified; 64-18 closes the gesture ledger; 64-19 closes the cache fingerprint and the visible re-bake; the sole documented exception is the Play-Script consume/Apply bake, explicitly scoped out of UAT row 5 and logged in `deferred-items.md` / `WINDOWS.md` |
| MED-18 | 64-03/04 | Snapshot + undo protection; export on every `uMode`; no zoom shimmer | ✓ SATISFIED (automated half); UAT 2/6 | WholeDoc + pool pairing; export digests; fixed texel gradient |
| MED-19 | 64-02/06/20 | Body global, canonical set, row, default 0; coverage/film coherence | ✓ SATISFIED | `GLOBAL_ROWS`; bag; white-over-blue gate green; Body 0 identity |
| MED-20 | 64-06/20 | Body 0 no cover; baseline identity | ✓ SATISFIED | guard + three identity probes at committed digests |
| MED-21 | 64-06/20 | Erode settled pigment under own tip before deposit | ✓ SATISFIED | ordering pins; coverage clears only where the final film leaves paper-white |
| MED-22 | 64-06 | Cover touches settled+thickness only; undo consistent | ✓ SATISFIED (structural); UAT 2 | fixed+relief only; dual protection |
| MED-23 | 64-06 | Body snapshot; medium carries value | ✓ SATISFIED | snapshot tests |
| MED-24 | 64-06 | Undo/redo restore both pools | ✓ SATISFIED (structural); UAT 2 | dual protection + pool pairing |
| MED-25 | 64-06 | No new target/texture/program; export on both `uMode` paths | ✓ SATISFIED | reuse Lift; probe exports |
| MED-26 | 64-11 | Compile-time group; absent=watercolor; no persistence | ✓ SATISFIED | `brushes.ts` |
| MED-27 | 64-11 | Five sections fixed order; no filter/search; empty omitted | ✓ SATISFIED | `brushSections` |
| MED-28 | 64-12 | Group→medium one write only on change | ✓ SATISFIED | `pickAquarelleBrush` |
| MED-29 | 64-11 | 15 classified (11/4); other groups new-only | ✓ SATISFIED | table + git diff |
| MED-30 | 64-11 | Eight new responses; no rename/remove | ✓ SATISFIED | 23 ids pinned |
| MED-31 | 64-11 | Texture axis unchanged and orthogonal | ✓ SATISFIED | strip + tests |
| MED-32 | 64-08 | S on `inkB.a`/`fixedB.a`; no new target/pass | ✓ SATISFIED | source audits |
| MED-33 | 64-08 | Body derives S; advection transports; settle carries | ✓ SATISFIED | deposit sites + settleFS |
| MED-34 | 64-10 | KM layer-over-background; broadband scalar | ✓ SATISFIED | generator + kmBand tests |
| MED-35 | 64-10 | S=0 bit-identical; stable small-arg branch | ✓ SATISFIED | legacy branch + identity |
| MED-36 | 64-10 | Scattering and order compose | ✓ SATISFIED | shared curve + probe gates (white-over-blue green) |
| MED-37 | 64-08 | White-gouache retired | ✓ SATISFIED | retirement audits |
| MED-38 | 64-10 | Replay determinism for S; export on every `uMode` | ✓ SATISFIED (automated half); UAT 9 | scatter repeats identical; four exports |

No orphaned requirement: every MED-01..MED-38 appears in at least one plan's `requirements` field. All 38 are satisfied at the automated level; MED-17 carries the one declared deferral documented above.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | 67-96 | Light rows emit per-move `onChange` with `onCommit` now wired | ✓ Resolved (was Blocker) | 64-18 closes CR-02; the per-move write remains intentional for the live sheet and records nothing |
| `PhysicsPaintStudio.tsx` | 2931-2953 | Gesture seam parks the first descriptor and records ONE coalesced span | ✓ Resolved (was Blocker) | one ledger entry per gesture; redo clears once |
| `useRotoFramePersistenceCoordinator.ts` | 299-301, 318, 371, 593-597 | Cache revision carries `lightCacheTerm` at every real-frame site | ✓ Resolved (was Blocker) | 64-19 closes CR-01's fingerprint half |
| `AquarelleCachedBaseLayer.tsx` | 39 | Cached layer accepts only `url` | ✓ Accepted by design | draw-time re-lighting rejected for cause: the emboss is baked from a non-persisted thickness field; the re-bake supplies the new light |
| `Engine.ts` coverage advect | — | Coverage transport unscaled by the film | ✓ Resolved (was Warning) | 64-20: `FILM_PRESENCE` scales transport; paper-white film transports zero; white-over-blue pct 0 |
| `PhysicsPaintStudio.tsx` | 9990-9991 | `isFullyOpaqueRaster` guard falls back to the transmittance sheet | ⚠️ Warning | WR-02: saturated coverage loses pigment alpha on committed frames (UAT row 9) |
| `Engine.ts` | byte offsets (WR-01) | Relief extent 1.5 / coverage extent 2 vs tip aspect up to 2.0 | ⚠️ Warning | wide-tip clipping |
| `64-REVIEW-DISPOSITION.md` | — | CR-01/CR-02 still listed `open` after the fixes | ℹ️ Info | stale review bookkeeping; the user deliberately skipped re-review of 18-20; no code impact |
| `64-20-SUMMARY.md` | coverage D1 | Cites `harness.test.ts#covered-paper-white census pins`; no such test exists (harness stays 28 tests) | ℹ️ Info | documentation citation inaccuracy; the census artifact exists in `probe.ts` and the plan required no new harness row |
| `spectral.ts` | IN-01 | Dead `coeffsOpacity` with a false docstring | ℹ️ Info | dead code |
| `Engine.ts` `fillStep` | IN-02 | Scattering without Body cover | ℹ️ Info | bucket fill has no order term |
| `RightPanelPaperTab.tsx` | IN-03 | Azimuth 360 wraps to 0 | ℹ️ Info | knob snaps left at the top of the range |
| — | — | `TBD` / `FIXME` / `XXX` debt markers in the gap-cycle files | None | No unreferenced debt markers; all 11 gap commits are ancestors of HEAD |
| — | — | Empty implementations or hardcoded empty data in phase surfaces | None | All dynamic values trace to the store/document/engine |

## Human Verification Required

`64-UAT.md` remains the human sink: `status: testing`, 10 rows all `result: [pending]`, `number: 1`, `awaiting: user response`. Rows 1-10 are listed in the frontmatter. The live rows that exercise this round's fixes:

- **UAT row 4 (Paper & Light)** — the settled wash must re-light immediately after 64-19's cache term and bounded Apply-lane re-bake, and one slider gesture must be one undo step after 64-18's coalescer. Both mechanisms are automated; the visible re-light and the single undo step are the human confirmation.
- **UAT row 5 (Play reveal + Apply/stroke-edit bakes)** — must match the live sheet's new light; the Play-Script dialog bake is explicitly excluded as the declared deferral.
- **UAT row 8 (Body/order and scattering)** — Body 100 must cover a dried dark area light with no paper-white; the probe bars are green, the visual read is human.
- **UAT row 9 (export parity)** — should be watched for the WR-02 saturation case: a fully covering stroke's coverage sheet is fully opaque and the capture falls back to the transmittance sheet.

The three behavior-unverified backstop truths (thickness undo/redo, reopen-and-replay relief, zoom/pan shimmer) are detailed in `behavior_unverified_items` and remain part of live UAT rows 2, 3 and 6.

## Gaps Summary

No gaps. Every automated gate is green and every must-have truth resolves VERIFIED except the three carried behavior-unverified backstops, which are evidence gaps routed to human verification.

The four prior gaps are closed in code and re-proved by this round's runs:

1. **CR-02 (64-07 truth 1, 64-09 truth 5)** — closed by 64-18. The light rows now emit an `onCommit`; the Studio parks the first descriptor, clears the ref at release, coalesces against the live document and records exactly one unified-ledger span. A 30-write drag is one entry; one undo restores the previous light; the redo stack clears once.
2. **CR-01 (64-07 truth 5)** — closed by 64-19. Every real-frame cache revision carries the canonical `lightCacheTerm` (exactly three sites, required parameter), the coordinator input reads `getDocumentLight` at call time, and a bounded single-flight relight re-bakes the visible committed frame once per gesture and per light-changing undo/redo through the light-resolving Apply lane. Draw-time re-lighting is recorded as rejected for cause; the cached layer keeps its url-only contract.
3. **White-over-blue (64-17 truth 4)** — closed by 64-20. Coverage transport is scaled by the display's own film reconstruction and the pigment capture clears coverage where the final film reads paper-white. Body 100 now passes every bar (pct 0, alpha 0.95, gain 0.90, excess 0.71) with all four digests equal to the committed baseline; Body 60/30 stay honest; Body 0 stays byte-identical. The deposit-side gate was implemented and reverted after a measured Body-60 regression — that is a user-authorized deviation, and the verified outcome (no body value raises covered paper-white, all bars hold) is what this report gates on. The comparator, invariants and bars are untouched; only the six Body>0 baselines were re-captured, each after its invariants passed.

Not blocking: WR-01 (wide-tip draw extents), WR-02 (fully-opaque coverage capture fallback), IN-01..03, the stale review disposition for CR-01/CR-02 (the user deliberately skipped re-review of plans 18-20), and the one 64-20 SUMMARY citation inaccuracy. The `bakeAquarelleScript` default-light bake remains an open, declared deferral logged in `deferred-items.md` and `.planning/WINDOWS.md` (row 125), explicitly scoped out of UAT row 5. The known `physicPaintBridge.test.ts` flake (bd efx-motion-editor-4ro.53) was not run as part of this verification and is not a phase-64 signal.

---

_Verified: 2026-11-18T22:28:25Z_
_Verifier: Claude (gsd-verifier)_
