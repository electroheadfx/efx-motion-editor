---
phase: 64-medium-engine
verified: 2026-11-18T19:53:31Z
status: gaps_found
score: 130/137 must-haves verified
covered_files: [".planning/phases/64-medium-engine/64-01-PLAN.md", ".planning/phases/64-medium-engine/64-01-SUMMARY.md", ".planning/phases/64-medium-engine/64-02-PLAN.md", ".planning/phases/64-medium-engine/64-02-SUMMARY.md", ".planning/phases/64-medium-engine/64-03-PLAN.md", ".planning/phases/64-medium-engine/64-03-SUMMARY.md", ".planning/phases/64-medium-engine/64-04-PLAN.md", ".planning/phases/64-medium-engine/64-04-SUMMARY.md", ".planning/phases/64-medium-engine/64-05-PLAN.md", ".planning/phases/64-medium-engine/64-05-SUMMARY.md", ".planning/phases/64-medium-engine/64-06-PLAN.md", ".planning/phases/64-medium-engine/64-06-SUMMARY.md", ".planning/phases/64-medium-engine/64-07-PLAN.md", ".planning/phases/64-medium-engine/64-07-SUMMARY.md", ".planning/phases/64-medium-engine/64-08-PLAN.md", ".planning/phases/64-medium-engine/64-08-SUMMARY.md", ".planning/phases/64-medium-engine/64-09-PLAN.md", ".planning/phases/64-medium-engine/64-09-SUMMARY.md", ".planning/phases/64-medium-engine/64-10-PLAN.md", ".planning/phases/64-medium-engine/64-10-SUMMARY.md", ".planning/phases/64-medium-engine/64-11-PLAN.md", ".planning/phases/64-medium-engine/64-11-SUMMARY.md", ".planning/phases/64-medium-engine/64-12-PLAN.md", ".planning/phases/64-medium-engine/64-12-SUMMARY.md", ".planning/phases/64-medium-engine/64-13-PLAN.md", ".planning/phases/64-medium-engine/64-13-SUMMARY.md", ".planning/phases/64-medium-engine/64-14-PLAN.md", ".planning/phases/64-medium-engine/64-14-SUMMARY.md", ".planning/phases/64-medium-engine/64-15-PLAN.md", ".planning/phases/64-medium-engine/64-15-SUMMARY.md", ".planning/phases/64-medium-engine/64-16-PLAN.md", ".planning/phases/64-medium-engine/64-16-SUMMARY.md", ".planning/phases/64-medium-engine/64-17-PLAN.md", ".planning/phases/64-medium-engine/64-17-SUMMARY.md", "app/src-tauri/src/models/project.rs", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx", "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx", "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx", "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts", "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts", "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts", "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts", "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts", "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts", "app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx", "app/src/components/physic-paint/view/RightPanelPaperTab.tsx", "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts", "app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx", "app/src/components/physic-paint/view/aquarelleRecordState.test.ts", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/brushGroupMedium.test.ts", "app/src/components/physic-paint/view/brushGroups.test.ts", "app/src/components/physic-paint/view/mediumSelection.test.ts", "app/src/components/shared/SliderStepper.tsx", "app/src/efx-paint/document/efxPaintDocument.ts", "app/src/efx-paint/document/efxPaintDocumentParsers.ts", "app/src/efx-paint/document/efxPaintDocumentRevision.ts", "app/src/efx-paint/document/paintDocumentLight.test.ts", "app/src/lib/mceFieldContract.test.ts", "app/src/stores/efxPaintStore.ts", "app/src/stores/physicPaintStore.test.ts", "app/src/stores/physicPaintStore.ts", "app/src/types/project.ts", "packages/efx-watercolor/probe/medium-engine/baselines/cover-advect.json", "packages/efx-watercolor/probe/medium-engine/baselines/cover-lift.json", "packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json", "packages/efx-watercolor/probe/medium-engine/baselines/cover-textured.json", "packages/efx-watercolor/probe/medium-engine/baselines/neutral-identity.json", "packages/efx-watercolor/probe/medium-engine/baselines/neutral-pigment.json", "packages/efx-watercolor/probe/medium-engine/baselines/red-over-blue-50.json", "packages/efx-watercolor/probe/medium-engine/baselines/watercolor-50.json", "packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json", "packages/efx-watercolor/probe/medium-engine/compare.mjs", "packages/efx-watercolor/probe/medium-engine/harness.test.ts", "packages/efx-watercolor/probe/medium-engine/probe.ts", "packages/efx-watercolor/probe/medium-engine/run.mjs", "packages/efx-watercolor/src/adapter/engineAdapter.test.ts", "packages/efx-watercolor/src/adapter/engineAdapter.ts", "packages/efx-watercolor/src/determinismContract.test.ts", "packages/efx-watercolor/src/playground/Engine.ts", "packages/efx-watercolor/src/playground/brushes.test.ts", "packages/efx-watercolor/src/playground/brushes.ts", "packages/efx-watercolor/src/playground/coverage.test.ts", "packages/efx-watercolor/src/playground/coverageLifecycle.test.ts", "packages/efx-watercolor/src/playground/emboss.test.ts", "packages/efx-watercolor/src/playground/engineTipIdentity.test.ts", "packages/efx-watercolor/src/playground/index.ts", "packages/efx-watercolor/src/playground/kmBand.test.ts", "packages/efx-watercolor/src/playground/mediums.test.ts", "packages/efx-watercolor/src/playground/mediums.ts", "packages/efx-watercolor/src/playground/params.test.ts", "packages/efx-watercolor/src/playground/params.ts", "packages/efx-watercolor/src/playground/relief.test.ts", "packages/efx-watercolor/src/playground/scattering.test.ts", "packages/efx-watercolor/src/playground/scattering.ts", "packages/efx-watercolor/src/playground/shaders.test.ts", "packages/efx-watercolor/src/playground/shaders.ts", "packages/efx-watercolor/src/playground/spectral.ts", "packages/efx-watercolor/src/playground/viscosity.test.ts"]
covered_digest: "v4:sha256:82448da68cae8b4a8e53ed5642e74768dc3aa24dc9892ea57ed55dfeece8160d"
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 96/99
  gaps_closed: []
  gaps_remaining: []
  regressions:
    - "64-07 truth 1 — one unified-ledger entry per light gesture (previously marked VERIFIED; code-confirmed FAILED — CR-02)"
    - "64-07 truth 5 — a cached artifact keyed on the content signature is a miss and the next render uses the new light (previously marked VERIFIED; code-confirmed FAILED — CR-01)"
    - "64-09 truth 5 — a real light change produces exactly one ledger entry (previously marked VERIFIED; code-confirmed FAILED — CR-02)"
gaps:
  - truth: "A light patch reaches the paint-layer document through exactly one `setDocumentLight` mutation and one unified-ledger entry per gesture, from the Studio handler, never from a view and never from a second light state. (64-07 truth 1)"
    status: failed
    reason: "CR-02: the three light rows pass only `onChange` and never `onCommit`; `SliderStepper` emits `onChange` on every pointermove and `handleDocumentLightChange` performs one `setDocumentLight` write plus one `rotoMoveHistory.recordBackgroundEdit` per emitted value. One slider drag therefore appends one document revision and one ledger entry per pointermove. The unified ledger splices its applied stack to 10 entries and clears redo on every record, so a single light drag can evict the paint undo stack and destroy redo."
    artifacts:
      - path: "app/src/components/physic-paint/view/RightPanelPaperTab.tsx"
        issue: "Azimuth/Elevation/Intensity rows (lines 61-94) pass `onChange` only; no `onCommit` is wired, so per-move values reach the store."
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "`handleDocumentLightChange` (2876-2883) records one ledger entry per call; nothing coalesces a gesture."
      - path: "app/src/components/shared/SliderStepper.tsx"
        issue: "`emitTrackValue` fires on every pointermove; `onCommit` exists on pointer-up but the light rows never pass it."
      - path: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts"
        issue: "`trimAppliedHistory` keeps 10 entries and `discardRedoHistory` clears redo (744-755); `recordBackgroundEdit` (977-982) applies both per entry."
    missing:
      - "Wire the light rows to a per-gesture commit (pass `onCommit` and apply the final value once, or coalesce the gesture) so one drag is one document write and one ledger entry."
      - "A regression test proving one drag emits exactly one ledger entry and leaves redo intact until a new edit."
  - truth: "A light change changes the Studio content signature, so a cached artifact keyed on it is a miss and the next render uses the new light; a same-value write leaves the signature unchanged. (64-07 truth 5)"
    status: failed
    reason: "CR-01: the frame cache revision is paper-only and built from the roto physical `contentRevision`; it carries no light term. The committed base layer takes only a URL and draws the baked raster unchanged, and the live engine applies light only to the live sheet. The `lightSignature` term in `getContentSignature` gates script-save snapshots only, so a committed/cached frame is never re-lit when the document light changes — the settled wash keeps its old shading."
    artifacts:
      - path: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts"
        issue: "`paperCacheTerm` (280-283) and `buildRotoRealCacheRevision(document.revision, keyId, paper)` (566-570) contain no light input."
      - path: "app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx"
        issue: "`export function AquarelleCachedBaseLayer(props: { url: string })` — no light prop; draws the baked raster unchanged."
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "`getContentSignature` (1382) includes `lightSignature`, but `handleDocumentLightChange` (2876-2883) triggers no re-bake; `AquarelleCanvasLayer` re-applies light only to the live sheet."
    missing:
      - "Include the document light (canonical `lightSignature`) in the frame cache revision/invalidation, or re-light the cached display layer at draw time."
      - "A test proving a light change misses the committed-frame cache and the next rendered frame uses the new light, in both directions."
  - truth: "A same-value gesture produces no descriptor and no panel churn; a real change produces exactly one ledger entry, through 64-07's handler and 64-05's mutation. (64-09 truth 5)"
    status: failed
    reason: "CR-02: the same-value half holds (`setDocumentLight` returns a null descriptor when the canonical revision is unchanged), but a real change is recorded once per pointermove, not once per gesture — one drag produces many ledger entries (same root cause as 64-07 truth 1)."
    artifacts:
      - path: "app/src/components/physic-paint/view/RightPanelPaperTab.tsx"
        issue: "Per-move `onChange` emission; no gesture commit."
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "One ledger entry per emitted value."
      - path: "app/src/stores/efxPaintStore.ts"
        issue: "`setDocumentLight` correctly returns one descriptor per distinct value — the count is multiplied by the caller's per-move emission."
    missing:
      - "Same fix as 64-07 truth 1: one ledger entry per gesture."
  - truth: "The Body 60 and Body 30 captures keep the matrix honest: 60 partly covers, 30 shows no coverage contribution, and no body value raises covered paper-white. (64-17 truth 4)"
    status: failed
    reason: "Deterministic gate failure: `white-over-blue` at Body 100 (1080²) measures `coveredPaperWhitePct` 0.88 against the absolute invariant 0. The committed baseline (commit 4a54aa411) records 0 and all four export digests differ from it. Re-running the same capture is byte-identical (0 differing fields), so this is a stable model state, not noise. The Body 60/30 captures keep `coveredPaperWhitePct` 0 and their `--differs-from` checks pass. Logged in `deferred-items.md` as pre-existing since 64-14's coverage advection (f396bcba5, 12f9c1e1b, 2720ab282) and never re-gated."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json"
        issue: "Committed baseline (0) vs current capture (0.88); its note forbids regenerating the baseline to make the gate pass."
      - path: "packages/efx-watercolor/src/playground/Engine.ts"
        issue: "Coverage advected with the ink (64-14) can claim coverage where the transmittance sheet still reads bare paper."
      - path: "packages/efx-watercolor/probe/medium-engine/compare.mjs"
        issue: "`coveredPaperWhitePct !== 0` is a hard scenario invariant; comparator exits 1."
    missing:
      - "Reconcile the coverage channel with the paint film so no covered texel reads bare paper at Body 100 (tighten the advection or the coverage/film coherence), then re-run `white-over-blue` green."
      - "Do not regenerate the baseline to pass; the baseline note requires the medium to change first."
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
---

# Phase 64: Medium Engine Verification Report

**Phase Goal:** Paint gains weight — one Viscosity global, five named Mediums, a real paint-thickness field lit as an emboss, an order term (`Body`), a scattering term and medium-grouped brushes let a stroke read denser, heavier and genuinely opaque, while a neutral watercolor stroke renders exactly as it did before.
**Verified:** 2026-11-18T19:53:31Z
**Status:** gaps_found
**Re-verification:** Yes — previous report covered plans 01–12 and recorded no `gaps:` section (initial-mode procedure re-run across all 17 plans).

**Method note:** `verify.artifacts` / `verify.key-links` return `invalid` for this phase (bare-string artifacts, prose key_links), so every artifact was checked manually at the four levels. All nine declared probe gates were re-run in this process with headless Chrome WebGL2; the package suite, the probe harness suite and the phase app test files were re-run. SUMMARY claims were not used as evidence. The review findings in `64-REVIEW.md` (all seven `open` in `64-REVIEW-DISPOSITION.md`) were checked against the code; the two critical ones are reproduced by this verification.

## Goal Achievement

### Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Viscosity row; neutral default bit-identical; maximum visibly hardens without redefining `flow` | ✓ VERIFIED (mechanism + identity); visual row UAT 1 | `GLOBAL_ROWS` has `viscosity` 'Viscosity'; `toEngineParams` maps /100+clamp; dissipation `exp(-dt*(3.0-flow*2.4+viscosity*12.0))*(fixing?exp(-dt*7):1)` and spread `0.12*(1-viscosity*0.9)`; `neutral-identity` probe PASS 6/6 fields |
| 2 | Same raster live/bake/replay; lowering Viscosity after settle does not change settled pigment | ✓ VERIFIED (automated arms); visual UAT 1/9 pending | `determinismContract.test.ts` viscosity arms; `viscosity.test.ts` pins the single read and the two sites and forbids viscosity in settle/advect-ink/display |
| 3 | Fresh session selects watercolor; five mediums apply whole sets in one move; next stroke only; replay per stroke; manual tweak keeps medium | ✓ VERIFIED; visual UAT 7 pending | `mediums.ts` five frozen records; `mediumSelection.test.ts` one bag write, id once, re-pick restores, unknown no-op, recorded strokes byte-identical; `brushGroupMedium.test.ts` |
| 4 | Thickness deposit + superpose; lit emboss; light changes the render on live, re-render, Play, Apply, vector edit; never the paint | ✗ **FAILED** — live and enumerated bakes wired, but a committed/cached frame never re-lights (CR-01; 64-07 truth 5), and the Play-Script bake uses `DEFAULT_LIGHT` (declared deferral) | `reliefFS` + additive blend; `displayFS` emboss algebra; `applyLiveConfig → engine.setLight`; adapter light; `RotoRevealRenderInput.light`; frame cache key is paper-only; `AquarelleCachedBaseLayer({ url })` has no light input |
| 5 | Light pigment covers/lightens dark; Body erodes full at core/partial at edges and scatters; Body 50 lightens; Body 0 bit-identical | ✗ **FAILED** in part — Body 0 identity holds and Body 60/30 are honest, but Body 100 raises covered paper-white 0.88 (white-over-blue gate red; 64-17 truth 4) | `coverPass`/`coverageDeposit`; `bodyCurve=clamp01^6`; `neutral-identity --body 0` PASS; `cover-on` differs from `cover-off`; `scatter-low/high` differ; `white-over-blue` FAIL |
| 6 | Five library sections; group→medium in one write only when the group changes; 15 classified + 8 new | ✓ VERIFIED; visual UAT 10 pending | `brushGroupOrder/Labels/sections`; `BRUSH_PRESETS` = 23 (11 watercolor + 6 pastel + 2 gouache + 2 graphite + 2 acrylic); `pickAquarelleBrush` compares groups before one `applyAquarelleMedium` |
| 7 | Export matches screen on every `uMode`; no shimmer on zoom; undo restores eroded pigment and thickness | ✓ VERIFIED (automated half); UAT 2/6/9 pending; note the light-drag ledger failure (CR-02) can clear the redo stack | probe paper/transparent/white/pigment digests; mode-4 alpha unshaded; fixed one-texel document-space gradient; dual-pool protection once per stamp |

### Observable Truths (plan must-haves)

130 of 137 plan truths are VERIFIED. Four must-haves FAILED (two root causes: the light gesture ledger and the light-cache omission, plus the Body-100 covered-paper-white gate). Three backstop truths (thickness undo/redo, reopen-and-replay relief, zoom shimmer) remain ⚠️ PRESENT_BEHAVIOR_UNVERIFIED and route to human verification.

#### 64-01 — Viscosity (MED-02..MED-06)

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

#### 64-02 — Five Mediums (MED-01, MED-07..MED-13, MED-19)

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

#### 64-03 — Thickness Field (MED-14, MED-16, MED-18)

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

#### 64-04 — Emboss (MED-15, MED-18)

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

#### 64-05 — Document Light (MED-17)

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

#### 64-06 — Body / Cover Pass (MED-19..MED-25)

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

#### 64-07 — Light on Every Render Path (MED-17)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One `setDocumentLight` mutation and one unified-ledger entry per gesture | ✗ **FAILED** | CR-02 — light rows emit per pointermove; the handler records one entry per emitted value; the ledger trims at 10 and clears redo |
| 2 | Live sheet applies the document light every frame | ✓ VERIFIED | `applyLiveConfig(engine, getLight)` at both call sites; idempotent `setLight` |
| 3 | Every enumerated bake path resolves the light (reveal Play + Apply/stroke-edit) | ✓ VERIFIED (enumerated paths; declared deferral for `bakeAquarelleScript`) | adapter light; Studio passes `light: documentLight()` |
| 4 | Light never stored in a stroke/payload/paint | ✓ VERIFIED | type absence; tests |
| 5 | A light change rotates the content signature so a cached artifact keyed on it misses and the next render uses the new light | ✗ **FAILED** | CR-01 — the frame cache key is paper-only; the cached base layer takes no light; `lightSignature` gates only script snapshots |
| 6 | Defaults read from package `DEFAULT_LIGHT`; absent renders the engine default | ✓ VERIFIED | import; absent adapter path |
| 7 | Backstop: two paint layers keep independent lights | ✓ VERIFIED | `documentLight()` resolves by layer id; sibling test |

#### 64-08 — Scattering Transport (MED-32, MED-33, MED-37)

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

#### 64-09 — Paper & Light Tab (MED-17)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Three light rows below grain; label `Paper & Light` | ✓ VERIFIED | `RightPanelPaperTab.tsx`; label map |
| 2 | Controlled by the document light with `DEFAULT_LIGHT` fallback | ✓ VERIFIED | `props.light ?? DEFAULT_LIGHT`; `rightPanelProps.light` |
| 3 | One-field patch to `handleDocumentLightChange`; view touches no store | ✓ VERIFIED | each row emits one field; no store import |
| 4 | Studio carries `light`/`onLightChange` into `rightPanelProps` | ✓ VERIFIED | Studio source; panel threading |
| 5 | Same-value: no descriptor/churn; real change: exactly one ledger entry | ✗ **FAILED** | same-value half holds (store no-op test); real change records one entry per pointermove (CR-02) |

#### 64-10 — Kubelka-Munk Composite (MED-34..MED-36, MED-38)

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

#### 64-11 — Brush Groups (MED-26, MED-27, MED-29..MED-31)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Compile-time `group: MediumId`; absent reads watercolor; not persisted | ✓ VERIFIED | `brushes.ts`; no serialized field |
| 2 | Backstop: 15 existing keep ids/order/params/tip bytes; 11/4 split; 8 new | ✓ VERIFIED | git diff only adds `group:` tags; `brushes.test.ts` |
| 3 | Eight new unique ids; no rename/removal | ✓ VERIFIED | 23 presets; id pins |
| 4 | One section per group in fixed order; no filter/search/collapse | ✓ VERIFIED | `WatercolorBrushLibrary.tsx`; `brushSections` |
| 5 | Empty group not rendered | ✓ VERIFIED | filter + test |
| 6 | Texture strip above every section; orthogonal | ✓ VERIFIED | `brushGroupMedium.test.ts` |
| 7 | New tips deterministic, same cost class | ✓ VERIFIED | byte-identical tip test |

#### 64-12 — Group-to-Medium Pick (MED-28)

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
| 8 | Invalidated suites updated and gated in the plan | ✓ VERIFIED | package suite green (33 files / 597 passed / 8 skipped) |

#### 64-14 — Coverage Lifecycle (7 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Coverage advects with the ink (mobility gate, back-trace, face fluxes, diffusion, clamp) | ✓ VERIFIED | `advectCoverFS`; `coverageLifecycle.test.ts`; `cover-advect` PASS |
| 2 | Coverage does not decay through settle (keep = 1) | ✓ VERIFIED | advect law + test |
| 3 | Undo/redo restore coverage with pigment and thickness (fifth pool layer/view/travel entry) | ✓ VERIFIED (structural; live undo is UAT 2) | five-entry pool/view/map pins |
| 4 | Whole-document transport carries coverage both ways incl. resize/apply | ✓ VERIFIED | capture/upload/apply/resize pins |
| 5 | Backstop: Lift reduces coverage with the same program/rect/blend, after fixed and before relief erode | ✓ VERIFIED | `cover-lift` PASS; source order |
| 6 | Lifecycle gates pinned (`cover-advect` spreads without paper-white; `cover-lift` erodes) | ✓ VERIFIED | both gates PASS with committed baselines |
| 7 | Invalidated suites updated and gated | ✓ VERIFIED | suite green |

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
| 9 | Studio suite updated and gated | ✓ VERIFIED | `PhysicsPaintStudio.test.ts` green |
| 10 | No cover punch in the app tree; Lift-only punch | ✓ VERIFIED | contract test |
| 11 | Lift contract unchanged | ✓ VERIFIED | tests |

#### 64-16 — Probe Matrices (6 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A textured tip covers through its crumbly mask (`cover-textured`) | ✓ VERIFIED | `cover-textured` PASS (91b28a74 / 65e86e96 / b38156ce / a8bb33d1) |
| 2 | The three Spike 001 numbers are standing invariants on committed baselines | ✓ VERIFIED (installed); the Body-100 covered-paper-white invariant is currently RED — see 64-17 truth 4 | `SCENARIO_INVARIANTS`; comparator hard-fails on `coveredPaperWhitePct !== 0` |
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
| 4 | Body 60/30 keep the matrix honest and **no body value raises covered paper-white** | ✗ **FAILED** | `white-over-blue` Body 100: `coveredPaperWhitePct` 0.88 vs invariant 0; four digests differ from the committed baseline; repeat is byte-identical. Body 60/30 keep 0 |
| 5 | `cover-over-wet` re-specified for the coverage model | ✓ VERIFIED | gate PASS; retired directional claim recorded |
| 6 | Body 0 byte-identical through every probe change | ✓ VERIFIED | neutral + watercolor-50 PASS |

**Score:** 130/137 truths verified; 4 failed; 3 present, behavior-unverified (see `behavior_unverified_items`).

## Declared Deferrals

| Item | Status | Evidence |
| --- | --- | --- |
| `bakeAquarelleScript` (Roto Play-Script consume/Apply branch) still renders with the engine default light | **Open — declared deferral; keeps MED-17 partial** | `physicsPaintRotoPlayScriptController.ts:2677`; adapter via `ports.createAquarelleAdapter(size, paper)` (`:557`, `:2700-2701`) whose signature carries no light; call sites `:3154`, `:3530`, `:3815`. Logged in `deferred-items.md` and `WINDOWS.md`. Threading it needs a port-signature change plus a staged-cache key term. Phase 65 (Studio API/MCP) does not cover it. |

## Review Findings Assessed

All seven `64-REVIEW.md` findings remain `open` in `64-REVIEW-DISPOSITION.md`. Their bearing on the must-haves:

| Finding | Severity | Bearing |
| --- | --- | --- |
| CR-01 — a light change never re-lights a committed or cached frame | critical | **Confirmed from code.** Falsifies 64-07 truth 5 and the roadmap criterion-4 "re-render" clause; will fail UAT row 4's re-light expectation. Gap 2. |
| CR-02 — one light-slider drag appends one write and one ledger entry per pointermove | critical | **Confirmed from code.** Falsifies 64-07 truth 1 and 64-09 truth 5; one drag can evict the 10-entry undo stack and clear redo. Gaps 1 and 3. |
| WR-01 — fixed draw extents clip relief/coverage for wide tips | warning | Real: relief extent 1.5 vs tip aspects up to 2.0, coverage extent 2 vs user aspect up to 2.0. Light-tip clipping, not a must-have falsification. |
| WR-02 — a fully opaque coverage export is misread as transmittance | warning | Real and phase-relevant: for a saturated coverage sheet the guard's fallback loses the pigment alpha on committed frames. 64-15 truth 3 is verified as *specified*, but its specified behavior is unsound; impacts UAT row 9. |
| IN-01 — dead `coeffsOpacity` with a false docstring | info | Present; dead code in the shipped package. |
| IN-02 — `fillStep` applies scattering but no Body cover | info | Present; bucket fill has no cover term. |
| IN-03 — Azimuth 360 wraps to 0 | info | Present; the knob snaps left on release at 360. |

## Required Artifacts

All 31 declared artifact paths exist; the 15 markdown-listed test files all run and pass. Key artifacts:

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/efx-watercolor/src/playground/params.ts` | canonical→engine viscosity/body/emboss mapping | ✓ VERIFIED | /100 + clamp01 at the one seam |
| `packages/efx-watercolor/src/playground/mediums.ts` | five frozen records over ten keys | ✓ VERIFIED | gouache/pastel(Chalk)/graphite/acrylic + derived watercolor |
| `packages/efx-watercolor/src/playground/scattering.ts` | one Body curve + deposit law + constants | ✓ VERIFIED | exponent 6, MAX 8, epsilon 1e-3 |
| `packages/efx-watercolor/src/playground/Engine.ts` | viscosity sites, relief target, cover/coverage passes, light state, advectCover | ✓ VERIFIED | 4-level; coverage fifth pool layer |
| `packages/efx-watercolor/src/playground/shaders.ts` | reliefFS, settle carry, emboss display, legacy/KM branches, advectCoverFS, cover deposit/mask | ✓ VERIFIED | mode-4 alpha unshaded |
| `packages/efx-watercolor/src/playground/spectral.ts` | KM generator with epsilon legacy branch | ✓ VERIFIED | `Pigment = { coeffs }` only |
| `packages/efx-watercolor/src/playground/brushes.ts` | group tag/helpers + 23 presets | ✓ VERIFIED | 15 legacy tagged, 0 legacy changes |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | light option applied once before first stroke | ✓ VERIFIED | adapter tests |
| `packages/efx-watercolor/probe/medium-engine/*` | harness, comparator, nine committed baselines | ✓ VERIFIED | four-digest enforcement; invariants |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` | ten rows + medium dropdown | ✓ VERIFIED | viscosity/body/emboss last |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | bag keys/defaults, selected medium, one-write handler | ✓ VERIFIED | snapshot + tests |
| `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` | three light rows below grain | ✓ VERIFIED (existence/wiring) / ✗ per-gesture semantics | rows emit per move; no `onCommit` |
| `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` | `Paper & Light`, light props threading | ✓ VERIFIED | id/order/aria unchanged |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | documentLight, handler, rightPanelProps, lightSignature, coverage capture | ✓ VERIFIED (wiring) / ✗ re-light and gesture ledger | CR-01/CR-02 |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | per-frame `setLight` via getLight | ✓ VERIFIED | live sheet only |
| `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` | committed sheet display | ✗ HOLLOW for light | `{ url }` only; no light input |
| `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` | frame cache revision | ✗ paper-only key | no light term |
| `app/src/stores/efxPaintStore.ts` | setDocumentLight + operation kind | ✓ VERIFIED | one bump/descriptor per call |
| `app/src/efx-paint/document/efxPaintDocument*.ts` | optional light, fail-closed parser, revision term | ✓ VERIFIED | absent stays absent |
| `app/src/types/project.ts` + `app/src-tauri/src/models/project.rs` | `MceDocumentLight` dual declaration | ✓ VERIFIED | field-contract test |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | five always-expanded sections | ✓ VERIFIED | `brushSections` order |
| `app/src/components/physic-paint/view/aquarellePaintControls.ts` | `pickAquarelleBrush` seam | ✓ VERIFIED | outgoing group read first |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | light on every bake path | ✗ partial (declared deferral) | `bakeAquarelleScript` uses the default light |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | `efxPaintStore.ts` | row `onLightChange` → Studio handler → `setDocumentLight` | WIRED (per move) | ✗ gesture semantics — one entry per pointermove |
| `PhysicsPaintStudio.tsx` | `engineAdapter.ts` | `documentLight()` → `light` option → `setLight` before first stroke | WIRED | reveal/Apply/stroke-edit paths |
| `AquarelleCanvasLayer.tsx` | `Engine.ts` | `getLight()` → `applyLiveConfig` → `engine.setLight` | WIRED | live sheet every frame |
| `useRotoFramePersistenceCoordinator.ts` | `AquarelleCachedBaseLayer.tsx` | baked frame → `url` → decode → draw | **NOT_WIRED for light** | cache key paper-only; no light input on the cached path (CR-01) |
| `PhysicsPaintStudio.tsx` | `physicsPaintRotoPlayScriptRenderer.ts` | `renderRotoRevealFrames({ light })` → adapter | WIRED | reveal Play bake |
| `physicsPaintRotoPlayScriptController.ts` | `engineAdapter.ts` | `bakeAquarelleScript` adapter creation | PARTIAL | no light parameter (declared deferral) |
| `AquarelleGlobalsPanel.tsx` | `aquarelleRecordState.ts` | dropdown → `applyAquarelleMedium` | WIRED | one bag write + id |
| `WatercolorBrushLibrary.tsx` | `aquarellePaintControls.ts` | card pick → `pickAquarelleBrush` → medium only on group change | WIRED | source-audited |
| `Engine.ts` relief target | `displayFS` | texture unit 7 `uRelief` | WIRED | emboss shade |
| `Engine.ts` coverage | `displayFS` mode 4 | cover channel → alpha/pigment reconstruction | WIRED | `pigment` export + capture merge |
| `Engine.ts` scattering | `spectral.ts` KM | `inkB.a`/`fixedB.a` → `settleFS` → `displayFS` scatter | WIRED | one scalar, no new pass |
| `PhysicsPaintStudio.tsx` capture handler | merge | `exportCanvas('pigment')` → `mergeBlend: 'pigment-alpha'` | WIRED (unsound guard) | WR-02 fully-opaque fallback |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | `light` | `documentLight()` reads the active layer document; `DEFAULT_LIGHT` fallback | Yes | ✓ FLOWING |
| `AquarelleCanvasLayer.tsx` | `getLight()` | document getter per frame → `engine.setLight` → display uniforms | Yes | ✓ FLOWING |
| `AquarelleCachedBaseLayer.tsx` | baked pixels | frame cache bytes → decode → draw | Yes (pigment), **no light** | ⚠️ HOLLOW (light disconnected) |
| `AquarelleGlobalsPanel.tsx` | `GLOBAL_ROWS` values | live canonical bag | Yes | ✓ FLOWING |
| `AquarelleGlobalsPanel.tsx` | `selectedMedium` | `aquarelleSelectedMediumId` → `mediumById` | Yes | ✓ FLOWING |
| `engineAdapter.ts` | `options.light` | Studio document read | Yes | ✓ FLOWING |
| `displayFS` | `uRelief` | the engine `relief` target written by the dab deposit | Yes | ✓ FLOWING |
| `displayFS` | `scatter` | `inkB.a`/`fixedB.a` written by `scatteringDeposit`, carried by settle | Yes | ✓ FLOWING |
| `displayFS` mode 4 | `cover` | the double-buffered HALF_FLOAT_R coverage pair, advected and Lift-eroded | Yes | ✓ FLOWING |
| `WatercolorBrushLibrary.tsx` | `brushSections` | `BRUSH_PRESETS` (23 grouped records) | Yes | ✓ FLOWING |
| `pickAquarelleBrush` | group | preset table at read time | Yes | ✓ FLOWING |

The only disconnected flow is the document light into the committed/cached frame display (the CR-01 gap). No `return []`/`return {}`/hardcoded-empty flows were found in rendered values; the `return null` guards are legitimate (unknown medium id, non-preset id).

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full efx-watercolor suite | `pnpm exec vitest run` (cwd `packages/efx-watercolor`) | 33 files, 597 passed, 8 skipped | ✓ PASS |
| Probe harness suite | `npx vitest run harness.test.ts` (cwd `packages/efx-watercolor/probe/medium-engine`) | 28 passed | ✓ PASS |
| Phase app test files | `pnpm exec vitest run` (cwd `app`) on the 17 phase files | 786 passed | ✓ PASS |
| Neutral identity | `run.mjs --gate neutral-identity` + `compare.mjs` | d2bd637a / 291d4a11 / 6ba88334 / 13b8af1d — equal | ✓ PASS |
| Watercolor-50 identity | `run.mjs --gate watercolor-50 --size 1080` + compare | 2b4a86d7 / 7f56e401 / bc74be59 / 432f3a3f — equal | ✓ PASS |
| White-over-blue deterministic failure | repeat run at Body 100 | 0 differing fields vs the first capture | ✓ deterministic, gate RED |

## Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| neutral-identity | `run.mjs --gate neutral-identity` && `compare.mjs neutral-identity` | d2bd637a / 291d4a11 / 6ba88334 / 13b8af1d; equal | PASS |
| neutral-pigment | `run.mjs --gate neutral-pigment --size 256` && compare | equals neutral-identity (4/4) | PASS |
| watercolor-50 | `run.mjs --gate watercolor-50 --scenario watercolor-50 --size 1080` && compare | 2b4a86d7 / 7f56e401 / bc74be59 / 432f3a3f; equal | PASS |
| cover-advect | `run.mjs --gate cover-advect --scenario cover-advect --size 256 --body 100` && compare | 3ad079b9 / 9962f2f0 / 3aed2b94 / 74fa8089; equal; coveredPaperWhitePct 0 | PASS |
| cover-lift | `run.mjs --gate cover-lift --scenario cover-lift --size 256 --body 100` && compare | 02bfe6f4 / 36591282 / 4f82ad3e / c2c712e8; equal; coveredPaperWhitePct 0 | PASS |
| cover-textured | `run.mjs --gate cover-textured --scenario cover-textured --size 512 --body 100 --brush chalk` && compare | 91b28a74 / 65e86e96 / b38156ce / a8bb33d1; equal; coveredPaperWhitePct 0 | PASS |
| red-over-blue-50 | `run.mjs --gate red-over-blue-50 --scenario red-over-blue-50 --size 1080 --body 100` && compare | 3a4eef04 / b006c2c6 / b4fe94e3 / d414957e; equal; coveredPaperWhitePct 0 | PASS |
| cover-over-wet | `run.mjs --gate cover-over-wet --scenario cover-over-wet --size 256 --body 100` && compare | 04782f85 / 077bfd7e / 8e987504 / 5d01d1e2; equal | PASS |
| white-over-blue | `run.mjs --gate white-over-blue --scenario white-over-blue --size 1080 --body 100` && `compare.mjs white-over-blue` | capture 905823e6 / a5c4ebd6 / 2bf6f14b / af9aa716 vs baseline 4c0d8124 / 766316bb / 2742fec1 / 51099491 — 4 differing fields; `coveredPaperWhitePct 0.88 is not 0`; exit 1 | **FAILED** |
| white-over-blue repeat | second identical run, `compare.mjs white-over-blue --other white-over-blue-repeat` | 0 differing fields (deterministic), same invariant failure | deterministic |
| white-over-blue 60/30 | `--body 60` / `--body 30` captures, `--differs-from white-over-blue` | 60: blue excess 31.23, alpha 0.23, cw 0; 30: blue excess 41.07, alpha 0.17, cw 0; both differ | PASS |

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
| MED-17 | 64-05/07/09 | Document light; every render path; persisted; cache fingerprint | ✗ **BLOCKED (partial)** | persistence/parser/revision/dual declaration/live sheet/reveal+Apply bakes verified; the frame-cache key has no light term and the cached layer takes no light (CR-01); `bakeAquarelleScript` uses the default light (declared deferral) |
| MED-18 | 64-03/04 | Snapshot + undo protection; export on every `uMode`; no zoom shimmer | ✓ SATISFIED (automated half); UAT 2/6 | WholeDoc + pool pairing; export digests; fixed texel gradient |
| MED-19 | 64-02/06 | Body global, canonical set, row, default 0 | ✓ SATISFIED | `GLOBAL_ROWS`; bag |
| MED-20 | 64-06 | Body 0 no cover; baseline identity | ✓ SATISFIED | guard + identity probes |
| MED-21 | 64-06 | Erode settled pigment under own tip before deposit | ✓ SATISFIED | ordering pins |
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
| MED-36 | 64-10 | Scattering and order compose | ✓ SATISFIED | shared curve + probe gates (Body 100 covered-paper-white is gated under MED-20/64-17) |
| MED-37 | 64-08 | White-gouache retired | ✓ SATISFIED | retirement audits |
| MED-38 | 64-10 | Replay determinism for S; export on every `uMode` | ✓ SATISFIED (automated half); UAT 9 | scatter repeats identical; four exports |

No orphaned requirement: every MED-01..MED-38 appears in at least one plan's `requirements` field. MED-17 is the one requirement whose whole claim is not met (partially blocked).

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | 61-94 | Light rows emit per pointermove with no commit seam | 🛑 Blocker | CR-02: one drag = many ledger entries; evicts the 10-entry undo stack, clears redo |
| `PhysicsPaintStudio.tsx` | 2876-2883 | `handleDocumentLightChange` records one entry per call, no gesture coalescing | 🛑 Blocker | same |
| `useRotoFramePersistenceCoordinator.ts` | 280-283, 566-570 | Cache revision is paper-only; no light term | 🛑 Blocker | CR-01: a light change never re-bakes a committed/cached frame |
| `AquarelleCachedBaseLayer.tsx` | 39 | Cached layer accepts only `url`; no light input | 🛑 Blocker | CR-01 |
| `Engine.ts` coverage advect | — | Coverage can claim a texel whose film reads bare paper at Body 100 | ⚠️ Warning | white-over-blue 0.88 vs 0 (64-17 truth 4 failed) |
| `PhysicsPaintStudio.tsx` | 9990-9991 | `isFullyOpaqueRaster` guard falls back to the transmittance sheet | ⚠️ Warning | WR-02: saturated coverage loses pigment alpha on committed frames |
| `Engine.ts` | byte offsets (WR-01) | Relief extent 1.5 / coverage extent 2 vs tip aspect up to 2.0 | ⚠️ Warning | wide-tip clipping |
| `spectral.ts` | IN-01 | Dead `coeffsOpacity` with a false docstring | ℹ️ Info | dead code |
| `Engine.ts` `fillStep` | IN-02 | Scattering without Body cover | ℹ️ Info | bucket fill has no order term |
| `RightPanelPaperTab.tsx` | IN-03 | Azimuth 360 wraps to 0 | ℹ️ Info | knob snaps left at the top of the range |
| — | — | `TBD` / `FIXME` / `XXX` debt markers in phase files | None | No unreferenced debt markers found |
| — | — | Empty implementations or hardcoded empty data in phase surfaces | None | All dynamic values trace to the store/document/engine |

## Human Verification Required

`64-UAT.md` remains the human sink: `status: testing`, 10 rows all `result: [pending]`, `number: 1`, `awaiting: user response`. The four gaps above mean at least two rows will not pass as written until they are fixed:

- **UAT row 4 (Paper & Light)** expects "the settled wash re-lights immediately; one slider gesture is one undo step". Both halves fail against the code today (CR-01, CR-02).
- **UAT row 9 (export parity)** should be watched for the WR-02 saturation case: a fully covering stroke's coverage sheet is fully opaque and the capture falls back to the transmittance sheet.

The three behavior-unverified backstop truths (thickness undo/redo, reopen-and-replay relief, zoom/pan shimmer) are detailed in `behavior_unverified_items` and remain part of the live UAT rows 2, 3 and 6.

## Gaps Summary

The automated core of the phase is in place and largely green: all nine engine/probe mechanisms compile and pass their suites, the neutral watercolor stroke is byte-identical to the committed pre-milestone baseline at 256² and 1080² (including Body 0, emboss 0 and light 0), the coverage composite/lifecycle/advection gates pass, and every MED-01..MED-38 requirement is claimed and implemented except MED-17's cache clause.

Three root causes block the goal:

1. **CR-02 — the light slider writes and records per pointermove.** `RightPanelPaperTab` never passes `onCommit`, so every distinct value during a drag becomes a `setDocumentLight` write and a unified-ledger entry; the ledger keeps 10 entries and clears redo. This falsifies 64-07 truth 1 and 64-09 truth 5 and can destroy the paint undo stack from a single gesture. Fix: one commit per gesture (wire `onCommit`/coalesce), with a regression test.
2. **CR-01 — the light never reaches a committed/cached frame.** The frame cache key is paper-only and the cached base layer draws baked pixels with no light input; `lightSignature` only gates script snapshots. A settled wash keeps its old shading after a light change. This falsifies 64-07 truth 5, blocks MED-17's cache clause, and will fail UAT row 4's re-light expectation. Fix: a light term in the frame cache revision or a live re-light of the cached display layer, with both-direction tests.
3. **White-over-blue at Body 100 is red.** `coveredPaperWhitePct` 0.88 against the absolute 0 invariant; all four digests differ from the committed baseline; the repeat is byte-identical. Body 60/30 stay clean. This falsifies 64-17 truth 4 and keeps Spike 001 criterion 1 red. Fix: reconcile coverage with the paint film (or justify a calibrated bar — the baseline note forbids regenerating it to pass) and re-run the gate green.

Warnings not blocking the must-haves: WR-01 (wide-tip draw extents), WR-02 (fully-opaque coverage capture fallback), IN-01..03, and the documented `bakeAquarelleScript` light deferral. The pending UAT surface (10 rows) is unchanged.

---

_Verified: 2026-11-18T19:53:31Z_
_Verifier: Claude (gsd-verifier)_
