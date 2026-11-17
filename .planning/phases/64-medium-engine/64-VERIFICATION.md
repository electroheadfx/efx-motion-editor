---
phase: 64-medium-engine
verified: 2026-11-17T17:31:31Z
status: human_needed
score: 96/99 must-haves verified
covered_files: [".planning/phases/64-medium-engine/64-01-PLAN.md", ".planning/phases/64-medium-engine/64-01-SUMMARY.md", ".planning/phases/64-medium-engine/64-02-PLAN.md", ".planning/phases/64-medium-engine/64-02-SUMMARY.md", ".planning/phases/64-medium-engine/64-03-PLAN.md", ".planning/phases/64-medium-engine/64-03-SUMMARY.md", ".planning/phases/64-medium-engine/64-04-PLAN.md", ".planning/phases/64-medium-engine/64-04-SUMMARY.md", ".planning/phases/64-medium-engine/64-05-PLAN.md", ".planning/phases/64-medium-engine/64-05-SUMMARY.md", ".planning/phases/64-medium-engine/64-06-PLAN.md", ".planning/phases/64-medium-engine/64-06-SUMMARY.md", ".planning/phases/64-medium-engine/64-07-PLAN.md", ".planning/phases/64-medium-engine/64-07-SUMMARY.md", ".planning/phases/64-medium-engine/64-08-PLAN.md", ".planning/phases/64-medium-engine/64-08-SUMMARY.md", ".planning/phases/64-medium-engine/64-09-PLAN.md", ".planning/phases/64-medium-engine/64-09-SUMMARY.md", ".planning/phases/64-medium-engine/64-10-PLAN.md", ".planning/phases/64-medium-engine/64-10-SUMMARY.md", ".planning/phases/64-medium-engine/64-11-PLAN.md", ".planning/phases/64-medium-engine/64-11-SUMMARY.md", ".planning/phases/64-medium-engine/64-12-PLAN.md", ".planning/phases/64-medium-engine/64-12-SUMMARY.md", "app/src-tauri/src/models/project.rs", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx", "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx", "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts", "app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts", "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts", "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts", "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts", "app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx", "app/src/components/physic-paint/view/RightPanelPaperTab.tsx", "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts", "app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx", "app/src/components/physic-paint/view/aquarellePaintControls.ts", "app/src/components/physic-paint/view/aquarellePresetSelection.test.ts", "app/src/components/physic-paint/view/aquarelleRecordState.test.ts", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/brushGroupMedium.test.ts", "app/src/components/physic-paint/view/brushGroups.test.ts", "app/src/components/physic-paint/view/mediumSelection.test.ts", "app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts", "app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts", "app/src/efx-paint/document/efxPaintDocument.ts", "app/src/efx-paint/document/efxPaintDocumentParsers.ts", "app/src/efx-paint/document/efxPaintDocumentRevision.ts", "app/src/efx-paint/document/paintDocumentLight.test.ts", "app/src/lib/mceFieldContract.test.ts", "app/src/stores/efxPaintStore.ts", "app/src/stores/physicPaintStore.ts", "app/src/types/project.ts", "packages/efx-watercolor/probe/medium-engine/baselines/neutral-identity.json", "packages/efx-watercolor/probe/medium-engine/compare.mjs", "packages/efx-watercolor/probe/medium-engine/index.html", "packages/efx-watercolor/probe/medium-engine/probe.ts", "packages/efx-watercolor/probe/medium-engine/run.mjs", "packages/efx-watercolor/src/adapter/engineAdapter.test.ts", "packages/efx-watercolor/src/adapter/engineAdapter.ts", "packages/efx-watercolor/src/determinismContract.test.ts", "packages/efx-watercolor/src/playground/Engine.ts", "packages/efx-watercolor/src/playground/brushes.test.ts", "packages/efx-watercolor/src/playground/brushes.ts", "packages/efx-watercolor/src/playground/coverage.test.ts", "packages/efx-watercolor/src/playground/dryMedia.test.ts", "packages/efx-watercolor/src/playground/emboss.test.ts", "packages/efx-watercolor/src/playground/index.ts", "packages/efx-watercolor/src/playground/kmBand.test.ts", "packages/efx-watercolor/src/playground/mediums.test.ts", "packages/efx-watercolor/src/playground/mediums.ts", "packages/efx-watercolor/src/playground/params.test.ts", "packages/efx-watercolor/src/playground/params.ts", "packages/efx-watercolor/src/playground/relief.test.ts", "packages/efx-watercolor/src/playground/scattering.test.ts", "packages/efx-watercolor/src/playground/scattering.ts", "packages/efx-watercolor/src/playground/shaders.ts", "packages/efx-watercolor/src/playground/spectral.ts", "packages/efx-watercolor/src/playground/viscosity.test.ts"]
covered_digest: "v4:sha256:52638eaeb111333520ac1067e18f7f1a88681896e773a552c612f096a732bcf1"
behavior_unverified: 3
overrides_applied: 0
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
    expected: "Paint visibly hardens — it stops moving almost immediately and the deposit reads denser — while a neutral (0) watercolor stroke is unchanged."
    why_human: "Visual paint feel on the live WebGL sheet."
  - test: "Undo and redo a thick embossed stroke and a covering (Body high) stroke."
    expected: "Pigment and thickness restore together; redo restores the same eroded/deposited values."
    why_human: "No WebGL2 history surface in vitest; live history only."
  - test: "Reopen the project and replay without repainting; then switch paint layers with different document lights."
    expected: "The same relief repaints from script alone; each layer re-shades to its own light."
    why_human: "Live reopen/replay and per-layer visual re-shade."
  - test: "In the Paper & Light tab, drag Azimuth / Elevation / Intensity without painting."
    expected: "The settled wash re-lights immediately; the tab reads `Paper & Light`; one slider gesture is one undo step that restores the previous light."
    why_human: "Visual re-light and gesture ledger feel."
  - test: "After a light change, Play (reveal) and Apply/stroke-edit bakes."
    expected: "The baked frames match the live sheet's new light."
    why_human: "Live bake parity; the Play-Script dialog bake is a separate declared deferral (see below) and is not part of this row."
  - test: "Zoom/pan over a thick embossed stroke; raise Emboss on a thick stroke."
    expected: "No shimmer or crawl; the paint reads as raised with a lit side and a shadow side."
    why_human: "Perceptual shimmer and emboss look."
  - test: "Pick the five mediums and paint five strokes; pick two brushes inside one group after a manual tweak; pick acrylic vs watercolor."
    expected: "Each stroke keeps its own look on replay; a same-group pick keeps the manual tweak; acrylic reads thick and waterless, watercolor a wash."
    why_human: "Visual medium looks and replay of a multi-group project."
  - test: "Body/order and scattering rows: light pigment high Body over a dried dark area; Body 50; dark pigment high Body; water above zero at the border."
    expected: "High Body reads light with no bleed-through; Body 50 tints without erasing; a dark high-Body stroke covers and stays dark; the border blends when water > 0."
    why_human: "Perceptual opacity/cover judgement."
  - test: "Dry, replay, undo/redo, and export in every mode (paper, transparent, white, pigment) after scattering; zoom over a scattered area."
    expected: "Identical rasters across dry/replay/undo/redo; export matches the screen on every mode; no shimmer."
    why_human: "Live screen-vs-export comparison and visual stability."
  - test: "Open the medium dropdown in the Paint tab and inspect the five brush-library sections."
    expected: "Dropdown shows the selected medium; Watercolor / Gouache / Chalk / Graphite / Acrylic sections are always expanded, with the texture strip above and no filter/search/collapse."
    why_human: "UI look, popover placement and section layout."
---

# Phase 64: Medium Engine Verification Report

**Phase Goal:** Paint gains weight — one Viscosity global, five named Mediums, a real paint-thickness field lit as an emboss, an order term (`Body`), a scattering term and medium-grouped brushes let a stroke read denser, heavier and genuinely opaque, while a neutral watercolor stroke renders exactly as it did before.
**Verified:** 2026-11-17T17:31:31Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior `*-VERIFICATION.md` existed)

**Method note:** the automated `verify.artifacts` / `verify.key-links` verbs return `invalid` for this phase because its `must_haves.artifacts` are bare path strings and its `key_links` are prose, so every artifact was checked manually at the four levels (exists, substantive, wired, data flows). Every phase test file and every declared probe gate was re-run in this verification; SUMMARY claims were not used as evidence.

## Goal Achievement

The phase goal decomposes into the seven roadmap success criteria. Each is backed by plan-level truths below.

### Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Viscosity row; neutral default bit-identical; maximum visibly hardens without redefining `flow` | ✓ VERIFIED (mechanism + identity); visual row H1 | `GLOBAL_ROWS` has `viscosity` 'Viscosity'; `toEngineParams` maps /100+clamp; dissipation `exp(-dt*(3.0-flow*2.4+viscosity*12.0))*(fixing?exp(-dt*7):1)` and spread `0.12*(1-viscosity*0.9)`; `neutral-identity` probe PASS all 6 fields |
| 2 | Same raster live/bake/replay; lowering Viscosity after settle does not change settled pigment | ✓ VERIFIED | `determinismContract.test.ts` viscosity arms; `viscosity.test.ts` pins the single read and the two sites and forbids viscosity in settle/bleach/advect-ink/display |
| 3 | Fresh session selects watercolor; five mediums apply whole sets in one move; next stroke only; replay per stroke; manual tweak keeps medium | ✓ VERIFIED | `mediums.ts` five frozen records; `mediumSelection.test.ts` one bag write, id once, re-pick restores, unknown no-op, recorded strokes byte-identical; `brushGroupMedium.test.ts` Paint-tab agreement |
| 4 | Thickness deposit + superpose; lit emboss; light changes the render on live, re-render, Play, Apply, vector edit; never the paint | ✓ VERIFIED (enumerated paths); **MED-17 PARTIAL — declared deferral**; visual rows H4–H6 | `reliefFS` + additive `FUNC_ADD/ONE,ONE`; `displayFS` emboss algebra; `applyLiveConfig → engine.setLight`; `engineAdapter` light option; `applyAquarelleEventsToKey`/`bakeAquarelleEventsToFrame` light; `RotoRevealRenderInput.light`; probe `emboss-lit` differs from baseline on all 3 exports |
| 5 | Light pigment covers/lightens dark; Body erodes full at core/partial at edges and scatters; Body 50 lightens; Body 0 bit-identical | ✓ VERIFIED (identity + gates); visual rows H8 | `coverPass` binds the Lift program with `FUNC_ADD/(ZERO,ONE_MINUS_SRC_COLOR)` drawing `fixed` then `relief`; `bodyCurve=clamp01^6`; probe `neutral-identity --body 0` PASS; `cover-on` differs from `cover-off`; `scatter-low/high` differ from `scatter-off` |
| 6 | Five library sections; group→medium in one write only when the group changes; 15 classified + 8 new | ✓ VERIFIED | `brushGroupOrder/Labels/sections`; `BRUSH_PRESETS` = 23 (11 watercolor + 6 pastel + 2 gouache + 2 graphite + 2 acrylic); `pickAquarelleBrush` compares outgoing/incoming group before one `applyAquarelleMedium`; `brushGroups.test.ts`, `brushGroupMedium.test.ts` |
| 7 | Export matches screen on every `uMode`; no shimmer on zoom; undo restores eroded pigment and thickness | ✓ VERIFIED (automated half); rows H2/H6/H9 | Probe exports paper/transparent/white all carry the emboss and the scattering; mode-4 shades only premultiplied colour, alpha untouched; fixed one-texel document-space gradient; dual-pool protection once per stamp; live undo/shimmer/export rows H2/H6/H9 |

### Observable Truths (plan must-haves)

96 of 99 plan truths are VERIFIED. Three backstop truths (thickness undo/redo, reopen-and-replay relief, zoom shimmer) are ⚠️ PRESENT_BEHAVIOR_UNVERIFIED and routed to human verification.

#### 64-01 — Viscosity (MED-02..MED-06)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Viscosity reaches the engine only through `toEngineParams` (/100, clamp 0..1) | ✓ VERIFIED | `params.ts` `viscosity: clamp01(num(p.viscosity, d.viscosity)/100)`; `params.test.ts` |
| 2 | At 0 the dissipation is the exact pre-milestone literal `exp(-dt*(3.0-flow*2.4))` (+0) and spread exactly `0.12` | ✓ VERIFIED | `Engine.ts:2458,2506`; `viscosity.test.ts` "applies viscosity at exactly the two documented literals" |
| 3 | At 100 spread 0.012; at 50 spread 0.066 | ✓ VERIFIED | `0.12*(1-v*0.9)`; `viscosity.test.ts` |
| 4 | Viscosity only raises dissipation; never lowers the floor or replaces `flow` | ✓ VERIFIED | additive `+ viscosity*12.0` inside the exponent; `viscosity.test.ts` |
| 5 | `this.params.viscosity` read exactly once, applied at exactly two sites | ✓ VERIFIED | one read at `Engine.ts:2450`; two sites; `viscosity.test.ts` count pins |
| 6 | Recorded stroke without `viscosity` replays 0; non-finite falls back to 0 | ✓ VERIFIED | `toEngineParams` num/clamp; `determinismContract` payload arms; `params.test.ts` |
| 7 | Backstop: changing Viscosity after settle re-processes nothing | ✓ VERIFIED | `viscosity.test.ts` forbids the token in settle/bleach/advect-ink/display; only fluid-step consumers |
| 8 | Pre-milestone stroke byte-identical at default | ✓ VERIFIED | probe `neutral-identity` re-run: 6/6 fields equal to committed baseline |
| 9 | Backstop: live/bake/replay at same viscosity produce the same raster | ✓ VERIFIED | `determinismContract.test.ts` "replays identically within each viscosity arm and carries the value" + repeated-frame identity |

#### 64-02 — Five Mediums (MED-01, MED-07..MED-13, MED-19)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Medium is `{id,name,params}` frozen plain serializable data | ✓ VERIFIED | `mediums.ts` frozen records; `mediums.test.ts` |
| 2 | `Viscosity` row in the globals panel; canonical bag/keys/defaults carry the key | ✓ VERIFIED | `AquarelleGlobalsPanel.tsx` GLOBAL_ROWS; `aquarelleRecordState.ts`; `mediumSelection.test.ts` |
| 3 | Five built-ins over exactly the ten medium keys | ✓ VERIFIED | `mediums.ts` `MediumParamKey` ten keys; gouache 35/70/55/25/60/60/40/55/55/20; pastel(name Chalk) 0/65/30/0/80/70/60/85/25/0; graphite 0/45/25/0/85/75/100/90/0/0; acrylic 8/85/50/10/70/65/25/90/90/75 |
| 4 | `watercolor` equals canonical defaults, new keys 0 | ✓ VERIFIED | `WATERCOLOR_PARAMS` derived from `DEFAULT_CANONICAL_PARAMS`; `mediums.test.ts` |
| 5 | A medium never writes `size` or `lift` | ✓ VERIFIED | `MediumParamKey` union excludes both; `brushGroupMedium.test.ts` "keeps size and lift across every cross-group pick" |
| 6 | Medium selection applies params in exactly ONE spread write with the id in the same handler | ✓ VERIFIED | `applyAquarelleMedium` single `{...current, ...params}` assignment; `mediumSelection.test.ts` |
| 7 | Re-pick re-applies; no edited marker; manual tweak keeps selection | ✓ VERIFIED | `applyAquarelleMedium` compares bag and id independently; tests |
| 8 | Backstop: selecting a medium never alters recorded strokes; per-stroke snapshot authoritative | ✓ VERIFIED | `mediumSelection.test.ts` "leaves every recorded stroke byte-identical", "records all three keys in the per-stroke snapshot" |
| 9 | Backstop: replay on a machine with different medium defaults is identical | ✓ VERIFIED | per-stroke snapshot authority + `determinismContract` replay arms; replay reads payload params, not the medium |
| 10 | Medium dropdown is the first Paint-tab row and shows the selected name | ✓ VERIFIED | `AquarelleGlobalsPanel.tsx` medium row above `GLOBAL_ROWS`; `selectedMedium` fallback |
| 11 | Unknown/absent medium id leaves the bag unchanged and never throws | ✓ VERIFIED | `mediumById` returns null; `mediumSelection.test.ts` "total no-op for an unknown id" |

#### 64-03 — Thickness Field (MED-14, MED-16, MED-18)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One document-resolution `HALF_FLOAT_R` target, cleared by wipe/reset, never persisted | ✓ VERIFIED | `relief` created `g.target(dw,dh,[HALF_FLOAT_R])`; `clear()`/`resetSheet` loop `docTargets()` with relief last; `relief.test.ts`; no persisted field anywhere |
| 2 | Each dab deposits through its own resolved tip footprint with the paper-tooth gate | ✓ VERIFIED | `reliefFS` mirrors stampFS's 13 footprint uniforms; `bindFootprint` shared; `relief.test.ts` |
| 3 | Deposits accumulate additively | ✓ VERIFIED | `brushRelief`: `FUNC_ADD` + `blendFunc(ONE, ONE)`; test |
| 4 | Amount = `P.emboss × amount`; at emboss 0 no draw at all | ✓ VERIFIED | `reliefAmount = P.emboss * amount`; `if (reliefAmount > 0) this.brushRelief(...)`; test |
| 5 | Lift erodes thickness with the same footprint and amount | ✓ VERIFIED | `lift()` calls `drawRelief(amount, ...)` under the same rect/blend; `relief.test.ts` |
| 6 | Thickness never flows (no advect/settle/dry/bleed/fill read/write) | ✓ VERIFIED | `relief.test.ts` "no step, fill or pen path reads or writes the thickness target" |
| 7 | Undo protection positional with inkA/inkB/wet; `snapshotLayers()` and undo map carry it last | ✓ VERIFIED | pool-0 formats, `snapshotLayers()` 4 entries, travel layer map; `relief.test.ts` |
| 8 | Backstop: undo/redo of a thickness-changing stroke restores the field exactly | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | structural pairing pinned; no WebGL2 history in vitest — human row H2 |
| 9 | Size change and snapshot restore carry thickness through `WholeDoc` | ✓ VERIFIED | resize forward `copy(old.relief,...)`; WholeDoc `relief` read/upload as `gl.RED`; `relief.test.ts` |
| 10 | Pen and vector strokes deposit no thickness | ✓ VERIFIED | deposit only in the brush callback; `relief.test.ts` |
| 11 | Backstop: replay rebuilds thickness from the script alone; no persisted field | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | no-persisted-field + deterministic replay pinned; reopen visual parity — human row H3 |

#### 64-04 — Emboss (MED-15, MED-18)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Surface normal from the thickness gradient using the paper's one-texel central difference; multiplied into paint colour | ✓ VERIFIED | `displayFS` block; `paperLightFS` same law; `emboss.test.ts` |
| 2 | Lit term exactly 1.0 at zero gradient, any intensity, every `uMode` | ✓ VERIFIED | `litDelta = intensity*(dot(n,L)-L.z)*bump*GAIN`; zero at flat normal; probe light-0 identity PASS |
| 3 | Light is engine render state applied every display draw; never in a stroke payload/snapshot/pigment/thickness | ✓ VERIFIED | `setLight`/`drawDisplay` uniforms; `LightSettings` absent from `AquarelleStroke`/`AquarelleStrokePayload` |
| 4 | Shipped defaults reproduce `paperLightFS`'s (-0.5, 0.6, 0.62) direction with intensity 1 | ✓ VERIFIED | azimuth 129.8 / elevation 38.45 resolve to exactly that vector; intensity 1 |
| 5 | Emboss is the tenth globals row on 0..100, via the canonical bag and the one mapping | ✓ VERIFIED | `GLOBAL_ROWS` last row; `params.ts` /100; `AquarelleGlobalsPanel.test.ts` |
| 6 | Backstop: fixed one-texel document-space sampling prevents zoom/pan shimmer | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | unit-7 binding + fixed radius source-pinned; shimmer perceptual — human row H6 |
| 7 | Export paper/transparent/white carries the shade; mode-4 shades premultiplied colour only; flat picking unshaded | ✓ VERIFIED | displayFS mode-4 branch before `rgb *= shade`, alpha unshaded; probe all 3 export digests differ under emboss |
| 8 | At emboss 0 and at light 0 (any emboss) both export digests equal the baseline | ✓ VERIFIED | probes `neutral-identity --emboss 0` and `--emboss 100 --light 0`: 6/6 fields equal |

#### 64-05 — Document Light (MED-17)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Backstop: optional `light` absent stays absent through parse/re-encode | ✓ VERIFIED | `paintDocumentLight.test.ts` "keeps an absent light absent through parse and re-encode" |
| 2 | Present but malformed light fails closed | ✓ VERIFIED | `normalizeDocumentLight` throws for non-record/unknown/missing/non-finite/out-of-range; tests |
| 3 | Absent resolves to package `DEFAULT_LIGHT`; never retyped in the app | ✓ VERIFIED | imports `DEFAULT_LIGHT`; app has no 129.8/38.45 literals (only `Engine.ts`) |
| 4 | One store mutation `setDocumentLight`; one bump, one notification, one undo descriptor | ✓ VERIFIED | `efxPaintStore.ts` `'set-document-light'`; tests "returns one descriptor, one revision bump and one change notification" |
| 5 | Same-value write is a revision-stable no-op with null descriptor | ✓ VERIFIED | store compare; tests |
| 6 | Backstop: revision includes light; cache keys miss; sync fingerprint inherits | ✓ VERIFIED | `lightTerm` in `efxPaintDocumentRevision.ts`; tests "rotates the document revision", "rotates the sync fingerprint" |
| 7 | Per-layer independence | ✓ VERIFIED | `paintDocumentLight.test.ts` "never touches a sibling layer document" |
| 8 | Launch handoff inside the opaque `document` member, no new launch key | ✓ VERIFIED | `PhysicPaintLaunchContext.document?: EfxPaintDocumentPayload`; validator delegates to `parseEfxPaintDocument`; `project.ts` comment |
| 9 | `MceDocumentLight` declared in TS and Rust with the same members, field-diff pinned | ✓ VERIFIED | `app/src/types/project.ts:309` and `app/src-tauri/src/models/project.rs:443`; `mceFieldContract.test.ts` `expectMemberKeys('MceDocumentLight', ['azimuth','elevation','intensity'])` |

#### 64-06 — Body / Cover Pass (MED-19..MED-25)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Body row between Viscosity and Emboss; canonical key; default 0 | ✓ VERIFIED | `GLOBAL_ROWS` order water…viscosity, body, emboss; `params.ts` /100; bag/keys/defaults |
| 2 | At Body 0 no cover protection and nothing extra; pre-milestone bytes reproduce | ✓ VERIFIED | `if (coverAmount > 0)` guards both protection and draw; probe `neutral-identity --body 0` PASS |
| 3 | A dab above 0 erodes the settled pigment under its own tip before depositing | ✓ VERIFIED | per-dab `coverPass` before `brushInk`; shared footprint `uRound 0`; `coverage.test.ts` order test |
| 4 | Backstop: cover draws only `fixed` and `relief`; water/mobile untouched | ✓ VERIFIED | `coverPass` draws fixed then relief only; `coverage.test.ts` "never ink or wet" |
| 5 | One `bodyCurve = clamp01^6` in `scattering.ts` with exponent exported; Body 50 = 0.015625, Body 100 = 1 | ✓ VERIFIED | `scattering.ts`; `scattering.test.ts` band pins; shared by cover and deposit |
| 6 | Backstop: both pools protected once per stamp before the first cover draw | ✓ VERIFIED | caller-wide `touch(coverRect)` pool 0 + `history.protect(1, ±PROTECT_MARGIN, fixed.views)` before `eachDab`; `coverage.test.ts` |
| 7 | Body adds no target/texture/program; reuses the Lift program | ✓ VERIFIED | `coverPass` binds `this.programs.lift`; `coverage.test.ts`, `scattering.test.ts` target/program audit |
| 8 | Params snapshot carries `body`; a bag written before this milestone maps to 0 | ✓ VERIFIED | `mediumSelection.test.ts` snapshot keys; `determinismContract` "replays an absent body key exactly like an explicit zero" |

#### 64-07 — Light on Every Render Path (MED-17)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One `setDocumentLight` mutation and one ledger entry per gesture, from the Studio handler | ✓ VERIFIED | `PhysicsPaintStudio.tsx:2874` handler; store mutation; no view calls the store |
| 2 | Live sheet applies the document light every frame through idempotent `setLight` | ✓ VERIFIED | `applyLiveConfig(engine, getLight)` at both call sites; `setLight` compare-then-write |
| 3 | Every enumerated bake path resolves the light at render time (reveal Play + Apply/stroke-edit) | ✓ VERIFIED (enumerated paths; **see declared deferral**) | `RotoRevealRenderInput.light` → adapter; `applyAquarelleEventsToKey`/`bakeAquarelleEventsToFrame` light → `createDefaultAquarelleAdapter(size, paper, light)`; Studio passes `light: documentLight()` at 2213/8075/8416 |
| 4 | Light never stored in a stroke, params bag or paint | ✓ VERIFIED | `AquarelleStroke`/`AquarelleStrokePayload` carry no light; `mediums.ts` keys exclude it |
| 5 | Content signature rotates on a light change; same-value write leaves it; contract comment + both-direction tests | ✓ VERIFIED | `lightSignature` + `getContentSignature`; `studioScriptSnapshotController.ts:128`; tests at 484-504 |
| 6 | Defaults read from package `DEFAULT_LIGHT`; absent renders engine default | ✓ VERIFIED | imports; absent adapter path leaves engine default; `paintDocumentLight.test.ts` |
| 7 | Backstop: two paint layers keep independent lights, resolved by layer id | ✓ VERIFIED | `documentLight()` reads `getEfxPaintDocument(layerId)?.light`; sibling test |

#### 64-08 — Scattering Transport (MED-32, MED-33, MED-37)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `S` one broadband scalar on `inkB.a`/`fixedB.a`; no new target/texture/pass | ✓ VERIFIED | `scattering.test.ts` audit; no new allocation |
| 2 | Deposit `S = SCATTERING_MAX × bodyCurve(body) × amount` at every pigment site | ✓ VERIFIED | three exact sites pinned by `scattering.test.ts` |
| 3 | `advectInkFS` transports `S` unchanged | ✓ VERIFIED | shader carries B.a; no new uniform/branch; test |
| 4 | `settleFS` carries `S` into the settled layer | ✓ VERIFIED | `oB = vec4(B.rgb*uSettle, B.a*uSettle)`; `scattering.test.ts` |
| 5 | `bodyCurve` is the only sixth-power declaration; both consumers read it | ✓ VERIFIED | `scattering.test.ts` "declares no second curve"; cover + deposit |
| 6 | White-gouache retired end to end | ✓ VERIFIED | no `Pigment.white`, `WHITE_GOUACHE`, `bleachFS`, settle `keep` or coverage term; tests |
| 7 | Backstop: `Pigment` never crosses persistence; built only through `pigmentFromHex` | ✓ VERIFIED | retirement audit test; no `coeffs` in app/persistence |
| 8 | Backstop: at body 0 both `B.a` channels are exactly 0 and the render is byte-identical | ✓ VERIFIED | `scatteringDeposit(0, amount) = 0`; probe `neutral-identity --body 0` PASS |
| 9 | `SCATTERING_MAX`/`SCATTER_EPSILON` declared once and interpolated | ✓ VERIFIED | `scattering.ts` + spectral generator import; kmBand test forbids retyping |

#### 64-09 — Paper & Light Tab (MED-17)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Azimuth 0..360, Elevation 0..90, Intensity 0..4 below the grain rows; label `Paper & Light` | ✓ VERIFIED | `RightPanelPaperTab.tsx` three rows below PaperPicker; `TOP_PANE_TAB_LABELS.paper = 'Paper & Light'`; id/order/aria unchanged |
| 2 | Controlled by the document light via `documentLight`, `DEFAULT_LIGHT` fallback | ✓ VERIFIED | `props.light ?? DEFAULT_LIGHT`; `rightPanelProps.light = documentLight()` |
| 3 | One-field patch to `handleDocumentLightChange`; view calls no store | ✓ VERIFIED | each `onChange` emits one field; tab has no store import |
| 4 | Studio carries `light`/`onLightChange` in `rightPanelProps` | ✓ VERIFIED | `PhysicsPaintStudio.tsx:7705-7706`; panel threads to the single mount |
| 5 | Same-value gesture produces no descriptor/churn; real change one ledger entry | ✓ VERIFIED | store no-op test; one mutation per handler call; visual gesture row H4 |

#### 64-10 — Kubelka-Munk Composite (MED-34..MED-36, MED-38)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each band reconstructs with the two-constant KM layer-over-background form; final `rgb * paperCol` untouched | ✓ VERIFIED | `displayBasisGLSL`; `kmBand.test.ts`; paper multiply unchanged |
| 2 | Absorption input is HALF the stored band exponent, so T² equals today's exponential in the S→0 limit | ✓ VERIFIED | `k = 0.5*A`; kmBand test "halves the clamped exponent" |
| 3 | At/below `SCATTER_EPSILON`, today's exact arithmetic runs | ✓ VERIFIED | legacy lines kept character for character; probe neutral identity PASS |
| 4 | KM branch numerically total | ✓ VERIFIED | zero-absorption branch returns 1; normalized denominator with positive bound; kmBand totality tests |
| 5 | Granulation and edge scale scattering exactly as absorption | ✓ VERIFIED | `a *= k; b *= k; scatter *= k` with `k = mix(gran*(1+uEdgeDarken*edge),1,uFlat)`; test |
| 6 | High Body erases+scatters; low Body scatters only; per-texel composition | ✓ VERIFIED | cover and deposit both read `bodyCurve(body)`; probe cover/scatter gates; tests |
| 7 | Backstop: repeated probe digests identical; three export backgrounds render the scattered scene | ✓ VERIFIED | `scatter-high` vs `scatter-high-repeat` 6/6 equal; all 3 digests differ from `scatter-off`, at 256 and 1024 |
| 8 | Backstop: no new target/texture/pass/per-band S; cost bounded; HD delta reported | ✓ VERIFIED | source audits; HD probe re-run reproduces recorded digests and 45 vs 39 ms bake / 76 vs 68 ms render |

#### 64-11 — Brush Groups (MED-26, MED-27, MED-29..MED-31)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Compile-time `group: MediumId`; absent reads watercolor; nothing persisted | ✓ VERIFIED | `brushes.ts`; no serialized field, no Rust change |
| 2 | Backstop: 15 existing keep ids/order/params/tip bytes; classification 11 watercolor + 4 pastel; 8 new appended with recorded params | ✓ VERIFIED | `git show 09f0add3f` on `brushes.ts`: 169 insertions, 0 deletions — only `group:` tags added to legacy + appended new; `brushes.test.ts`; `brushBridge.test.ts` tip equality |
| 3 | Eight new unique ids; no rename/removal | ✓ VERIFIED | 23 presets total; ids pinned; test |
| 4 | One section per group in fixed order; label style; two-column grid; no filter/search/collapse | ✓ VERIFIED | `WatercolorBrushLibrary.tsx` maps `brushSections(BRUSH_PRESETS)`; `brushGroupLabels` Chalk over pastel; header comments |
| 5 | Empty group not rendered | ✓ VERIFIED | `brushSections` filters; test |
| 6 | Texture strip above every section; applies to any group; neither selects the other | ✓ VERIFIED | strip + import above the grid; `brushGroupMedium.test.ts` texture test |
| 7 | New procedural tips deterministic, same cost class | ✓ VERIFIED | `bristleTip` on the hair-segment helper; `brushes.test.ts` byte-identical tips |

#### 64-12 — Group-to-Medium Pick (MED-28)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Pick resolves outgoing/incoming groups; differing group applies the medium; same group writes nothing | ✓ VERIFIED | `pickAquarelleBrush`; tests |
| 2 | Application is `applyAquarelleMedium` — one bag write + id in the same handler | ✓ VERIFIED | `pickAquarelleBrush` calls it; `mediumSelection.test.ts` one spread write |
| 3 | Committed selection patch stays `{brushId, toolOverrides}` with no params/medium | ✓ VERIFIED | `aquarellePaintControls.ts` commit shape; `brushGroupMedium.test.ts` patch test |
| 4 | Group IS the medium id; no second mapping; non-preset id → no group, no write | ✓ VERIFIED | `groupOfPreset`; test "no group, no medium write" |
| 5 | Outgoing group read before `selectAquarelleTip` | ✓ VERIFIED | lines 74-78 of `aquarellePaintControls.ts` |
| 6 | Backstop: Paint tab agrees (id + ten globals; size/lift untouched); texture changes neither | ✓ VERIFIED | `brushGroupMedium.test.ts` agreement + texture tests |
| 7 | Backstop: every response surface funnels through `pickAquarelleBrush`; only the dropdown also references the handler | ✓ VERIFIED | source-audit tests "one tip-pick caller and two medium-handler callers", "routes every response surface through the one pick seam" |

**Score:** 96/99 truths verified (3 present, behavior-unverified — see `behavior_unverified_items` and Human Verification).

## Declared Deferrals (Out of Scope)

| Item | Status | Evidence |
| --- | --- | --- |
| `bakeAquarelleScript` (Roto Play-Script consume/Apply branch) still renders with the engine default light | **Open — declared deferral; makes MED-17 PARTIAL** | `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2677`; adapter created via the optional `ports.createAquarelleAdapter(size, paper)` port (`:557`, `:2700-2701`) whose signature carries no light; call sites `:3154`, `:3530`, `:3815`. Logged in `.planning/phases/64-medium-engine/deferred-items.md` and `.planning/WINDOWS.md` #125 (`unmet-truth`). Threading it needs a port-signature change plus a staged-cache key term. No later milestone phase covers it (Phase 65 = Studio API/MCP). |

**MED-17 verdict: PARTIALLY met.** The document setting, optional-additive persistence, fail-closed parser, dual-language declaration, one store mutation, revision/fingerprint term, the one writer, the live per-frame apply, the reveal Play bake, the Apply bake and the stroke/vector-edit bake are all implemented and verified. The Roto Play-Script bake (`bakeAquarelleScript`) is the one render path that still uses `DEFAULT_LIGHT`. This is not a phase-introduced stub: the path predates the phase, the gap is documented, and the 64-07 plan enumerated only the reveal Play bake and the Apply/stroke-edit bake. It must be closed by a follow-up quick/phase before the light claim can be called fully met product-wide.

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/efx-watercolor/src/playground/params.ts` | canonical→engine viscosity/body/emboss mapping | ✓ VERIFIED | /100 + clamp01 at the one seam |
| `packages/efx-watercolor/src/playground/mediums.ts` | five frozen records over ten keys | ✓ VERIFIED | gouache/pastel(Chalk)/graphite/acrylic + derived watercolor |
| `packages/efx-watercolor/src/playground/scattering.ts` | one Body curve + deposit law + constants | ✓ VERIFIED | exponent 6, MAX 8, epsilon 1e-3 |
| `packages/efx-watercolor/src/playground/Engine.ts` | viscosity sites, relief target, cover pass, light state | ✓ VERIFIED | 3-level + data-flow |
| `packages/efx-watercolor/src/playground/shaders.ts` | reliefFS, settle carry, emboss display, legacy/KM branches | ✓ VERIFIED | mode-4 alpha unshaded |
| `packages/efx-watercolor/src/playground/spectral.ts` | KM generator with epsilon legacy branch | ✓ VERIFIED | `Pigment = { coeffs }` only |
| `packages/efx-watercolor/src/playground/brushes.ts` | group tag/helpers + 23 presets | ✓ VERIFIED | 15 legacy tagged, 0 legacy changes |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | light option applied once before first stroke | ✓ VERIFIED | `setLight` once; adapter tests |
| `packages/efx-watercolor/probe/medium-engine/*` | probe harness + committed neutral baseline | ✓ VERIFIED | run/compare/index/probe + baseline present |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` | ten rows + medium dropdown | ✓ VERIFIED | viscosity/body/emboss last |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | bag keys/defaults, selected medium, one-write handler | ✓ VERIFIED | snapshot + tests |
| `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` | three light rows below grain | ✓ VERIFIED | one-field patches, DEFAULT_LIGHT fallback |
| `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` | `Paper & Light`, light props threading | ✓ VERIFIED | id/order/aria unchanged |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | documentLight, handler, rightPanelProps, lightSignature | ✓ VERIFIED | void placeholder removed |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | per-frame `setLight` via getLight | ✓ VERIFIED | both applyLiveConfig call sites |
| `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` | getAquarelleLight forwarding | ✓ VERIFIED | ref-stable forwarding |
| `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` | lightSignature | ✓ VERIFIED | absent/default canonical |
| `app/src/stores/efxPaintStore.ts` | setDocumentLight + operation kind | ✓ VERIFIED | one bump/descriptor |
| `app/src/efx-paint/document/efxPaintDocument*.ts` | optional light, fail-closed parser, revision term | ✓ VERIFIED | absent stays absent |
| `app/src/types/project.ts` + `app/src-tauri/src/models/project.rs` | `MceDocumentLight` dual declaration | ✓ VERIFIED | field-contract test |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | five always-expanded sections | ✓ VERIFIED | `brushSections` order |
| `app/src/components/physic-paint/view/aquarellePaintControls.ts` | `pickAquarelleBrush` seam | ✓ VERIFIED | outgoing group read first |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | `efxPaintStore.ts` | row `onLightChange` → Studio `handleDocumentLightChange` → `setDocumentLight` | WIRED | no view-side mutation |
| `PhysicsPaintStudio.tsx` | `engineAdapter.ts` | `documentLight()` → `light` option → `setLight` before first stroke | WIRED | reveal/Apply/stroke-edit paths |
| `AquarelleCanvasLayer.tsx` | `Engine.ts` | `getLight()` → `applyLiveConfig` → `engine.setLight` | WIRED | every frame, compare-then-write |
| `physicPaintStore.ts` | `physicsPaintRotoPlayScriptRenderer.ts` | `renderRotoRevealFrames({ light: document.light })` → adapter | WIRED | reveal Play bake |
| `AquarelleGlobalsPanel.tsx` | `aquarelleRecordState.ts` | dropdown → `applyAquarelleMedium` | WIRED | one bag write + id |
| `WatercolorBrushLibrary.tsx` | `aquarellePaintControls.ts` | card pick → `pickAquarelleBrush` → `applyAquarelleMedium` only on group change | WIRED | source-audited |
| `Engine.ts` relief target | `displayFS` | texture unit 7 `uRelief` | WIRED | emboss shade |
| `Engine.ts` scattering | `spectral.ts` KM | `inkB.a`/`fixedB.a` → `settleFS` → `displayFS` scatter | WIRED | one scalar, no new pass |
| `efxPaintDocumentParsers.ts` | `EfxPaintDocument.light` | fail-closed parse + absent-stays-absent encode | WIRED | revision/cache rotation |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RightPanelPaperTab.tsx` | `light` | `documentLight()` reads the active layer document; `DEFAULT_LIGHT` fallback | Yes | ✓ FLOWING |
| `AquarelleCanvasLayer.tsx` | `getLight()` | document getter per frame → `engine.setLight` → display uniforms | Yes | ✓ FLOWING |
| `AquarelleGlobalsPanel.tsx` | `GLOBAL_ROWS` values | live canonical bag `aquarelleParams` | Yes | ✓ FLOWING |
| `AquarelleGlobalsPanel.tsx` | `selectedMedium` | `aquarelleSelectedMediumId` → `mediumById` record | Yes | ✓ FLOWING |
| `engineAdapter.ts` | `options.light` | passed from Studio document read | Yes | ✓ FLOWING |
| `displayFS` | `uRelief` | the engine `relief` target written by the dab deposit | Yes | ✓ FLOWING |
| `displayFS` | `scatter` | `inkB.a`/`fixedB.a` written by `scatteringDeposit` and carried by settle | Yes | ✓ FLOWING |
| `WatercolorBrushLibrary.tsx` | `brushSections` | `BRUSH_PRESETS` (23 records with group tags) | Yes | ✓ FLOWING |
| `pickAquarelleBrush` | group | preset table at read time | Yes | ✓ FLOWING |

No `return []`/`return {}`/hardcoded empty data flows were found in the phase's rendered values; the only `return null` guards are legitimate guards (unknown medium id, non-preset id).

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full efx-watercolor suite | `pnpm exec vitest run` (cwd `packages/efx-watercolor`) | 31 files, 549 passed, 8 skipped | ✓ PASS |
| Phase app test files (wave A) | `pnpm exec vitest run` (cwd `app`) on 12 phase files | 12 files, 616 passed | ✓ PASS |
| Phase app test files (wave B) | `pnpm exec vitest run` (cwd `app`) on 8 phase files | 8 files, 328 passed | ✓ PASS |
| Replay determinism arms | `determinismContract.test.ts` (inside package run) | viscosity/emboss/body arms, absent body == 0, lit emboss replay | ✓ PASS |
| Module law exports | `scattering.test.ts` / `kmBand.test.ts` (inside package run) | curve, deposit, KM totality | ✓ PASS |
| Neutral baseline identity | `run.mjs --gate neutral-identity` + `compare.mjs neutral-identity` | 6/6 fields equal | ✓ PASS |
| Body 0 identity | `run.mjs --gate neutral-identity --body 0` + compare | 6/6 fields equal | ✓ PASS |
| Emboss 0 / light 0 identity | `run.mjs --gate neutral-identity --emboss 100 --light 0` + compare | 6/6 fields equal | ✓ PASS |

Full app suite was not re-run by this verifier (the orchestrator reported 9603 passed / 1 skipped / 96 todo after every wave; the pre-existing `app/src/lib/physicPaintBridge.test.ts` 63-05 flake is excluded from phase attribution). The 20 phase-scoped app test files (944 tests) and the complete package suite were re-run here.

## Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| neutral-identity | `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity` && `compare.mjs neutral-identity` | d2bd637a / 291d4a11 / 6ba88334; 6/6 equal | PASS |
| emboss 100, light 0 | `run.mjs --gate neutral-identity --emboss 100 --light 0` && compare | 6/6 equal | PASS |
| body 0 neutral | `run.mjs --gate neutral-identity --body 0` && compare | 6/6 equal | PASS |
| emboss-lit | `run.mjs --gate emboss-lit --emboss 100` && `compare.mjs emboss-lit --differs-from neutral-identity` | 21c55870 / 2f0e26da / 2ea31218 — all 3 differ | PASS |
| cover-off | `run.mjs --gate cover-off --scenario cover --body 0` | d573fa72 / b7614318 / 5218ffb8 | captured |
| cover-on | `run.mjs --gate cover-on --scenario cover --body 100` && `compare.mjs cover-on --differs-from cover-off` | ebc290e1 / 252b9a8b / 80bb5854 — all 3 differ | PASS |
| cover-on repeat | `run.mjs --gate cover-on-repeat ...` && `compare.mjs cover-on --other cover-on-repeat` | 6/6 equal | PASS |
| scatter-off / low / high | 3 `run.mjs` gates (`--body 0/50/100 --scenario cover`) | off d573fa72…; low 515850d6…; high ebc290e1… | captured |
| scatter-low / high vs off | `compare.mjs scatter-low --differs-from scatter-off`; `compare.mjs scatter-high --differs-from scatter-off` | all 3 digests differ on each | PASS |
| scatter-high repeat | `run.mjs --gate scatter-high-repeat ...` && `compare.mjs scatter-high --other scatter-high-repeat` | 6/6 equal | PASS |
| HD scatter-off | `run.mjs --gate scatter-off-hd --body 0 --scenario cover --size 1024` | d0422240 / f7bfabcf / bdb236f6 (matches 64-10 record) | captured |
| HD scatter-high | `run.mjs --gate scatter-high-hd --body 100 --scenario cover --size 1024`; `compare.mjs scatter-high-hd --differs-from scatter-off-hd` | 2fd5307c / 439b1596 / 244e1355; all 3 differ; bake 45 vs 39 ms, render 76 vs 68 ms | PASS |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MED-01 | 64-02 | Viscosity global row, 0..100 → 0..1 | ✓ SATISFIED | `GLOBAL_ROWS`, bag keys/defaults, tests |
| MED-02 | 64-01 | Neutral default bit-identical | ✓ SATISFIED | probe `neutral-identity` PASS |
| MED-03 | 64-01 | Dissipation only raises; two sites only | ✓ SATISFIED | additive exponent; `viscosity.test.ts` |
| MED-04 | 64-01 | Spread `0.12*(1-v*0.9)` | ✓ SATISFIED | `Engine.ts:2506`; tests |
| MED-05 | 64-01 | Per-stroke viscosity snapshot; live=bake=replay | ✓ SATISFIED | snapshot tests; determinism arms |
| MED-06 | 64-01 | Post-settle viscosity change does not reprocess | ✓ SATISFIED | source scan forbids settle/display consumers |
| MED-07 | 64-02 | Medium plain record | ✓ SATISFIED | `mediums.ts` |
| MED-08 | 64-02 | `watercolor` = today's defaults; fresh session | ✓ SATISFIED | derived record; `DEFAULT_MEDIUM_ID` |
| MED-09 | 64-02 | Five built-ins with recorded numbers | ✓ SATISFIED | records pinned by tests |
| MED-10 | 64-02 | One store write per switch | ✓ SATISFIED | `applyAquarelleMedium`; tests |
| MED-11 | 64-02 | Never alters recorded strokes | ✓ SATISFIED | `mediumSelection.test.ts` |
| MED-12 | 64-02 | Cross-machine replay via snapshot authority | ✓ SATISFIED | per-stroke snapshot + determinism |
| MED-13 | 64-02 | Existing Studio UI, manual tweak keeps medium | ✓ SATISFIED | dropdown + tests |
| MED-14 | 64-03 | Half-float thickness via each dab's footprint, superposes | ✓ SATISFIED | relief target, reliefFS, additive blend |
| MED-15 | 64-04 | Lit emboss; emboss 0 / intensity 0 byte-identical | ✓ SATISFIED | shader algebra + two probe gates |
| MED-16 | 64-03 | Emboss canonical param, snapshotted; no transport/height asset | ✓ SATISFIED | params bag; `relief.test.ts` |
| MED-17 | 64-05/07/09 | Document light; every render path; persisted; fingerprint | **PARTIAL — declared deferral** | All rendered/verified paths except `bakeAquarelleScript` (see Declared Deferrals) |
| MED-18 | 64-03/04 | Snapshot + undo protection; export on every `uMode`; no zoom shimmer | ✓ SATISFIED (automated half); rows H2/H6/H9 | WholeDoc + pool pairing tests; three export digests; fixed texel gradient |
| MED-19 | 64-02/06 | Body global, canonical set, row, default 0 | ✓ SATISFIED | `GLOBAL_ROWS`; bag/keys/defaults |
| MED-20 | 64-06 | Body 0 no cover; baseline identity | ✓ SATISFIED | guard + probe `--body 0` PASS |
| MED-21 | 64-06 | Erode settled pigment under own tip before deposit | ✓ SATISFIED | `coverPass` ordering + tests |
| MED-22 | 64-06 | Cover touches settled+thickness only; undo consistent | ✓ SATISFIED (structural); row H5 | draws fixed+relief only; dual protection |
| MED-23 | 64-06 | Body snapshot; medium carries value | ✓ SATISFIED | snapshot tests; record table |
| MED-24 | 64-06 | Undo/redo restore both pools, verified | ✓ SATISFIED (structural); row H2 | dual protection once per stamp; live row |
| MED-25 | 64-06 | No new target/texture/program; export on both `uMode` paths | ✓ SATISFIED | reuse Lift; probe exports |
| MED-26 | 64-11 | Compile-time group; absent=watercolor; no persistence | ✓ SATISFIED | `brushes.ts` |
| MED-27 | 64-11 | Five sections fixed order; no filter/search; empty omitted | ✓ SATISFIED | `brushSections`, library |
| MED-28 | 64-12 | Group→medium one write only on change; same-group keeps tweaks | ✓ SATISFIED | `pickAquarelleBrush` + tests |
| MED-29 | 64-11 | 15 classified (11/4); other groups new-only | ✓ SATISFIED | table + git diff |
| MED-30 | 64-11 | Eight new responses with recorded params; no rename/remove | ✓ SATISFIED | 23 ids pinned |
| MED-31 | 64-11 | Texture axis unchanged and orthogonal | ✓ SATISFIED | strip + tests |
| MED-32 | 64-08 | S on inkB.a/fixedB.a; no new target/pass | ✓ SATISFIED | source audits |
| MED-33 | 64-08 | Body derives S; advection transports; settle carries | ✓ SATISFIED | deposit sites + settleFS |
| MED-34 | 64-10 | KM layer-over-background; broadband scalar | ✓ SATISFIED | generator + kmBand tests |
| MED-35 | 64-10 | S=0 bit-identical; stable small-arg branch + epsilon | ✓ SATISFIED | legacy branch + probe identity |
| MED-36 | 64-10 | Scattering and order compose | ✓ SATISFIED | shared curve + probe gates |
| MED-37 | 64-08 | White-gouache retired; no shipped project writes it | ✓ SATISFIED | retirement audit tests |
| MED-38 | 64-10 | Replay determinism for S; export on every `uMode` | ✓ SATISFIED (automated half); row H9 | scatter repeats identical; three exports |

No orphaned MED requirement: every MED-01..MED-38 appears in at least one plan's `requirements` field (64-01:02-06; 64-02:01,07-13,19; 64-03:14,16,18; 64-04:15,18; 64-05:17; 64-06:19-25; 64-07:17; 64-08:32,33,37; 64-09:17; 64-10:34-36,38; 64-11:26,27,29-31; 64-12:28).

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | `TBD` / `FIXME` / `XXX` debt markers in phase files | None | The only `XXXX` hit is a test fixture string in `physicsPaintRotoLoopGuards.test.ts:1532`, not a debt marker |
| — | — | Placeholder/not-implemented text in phase UI/engine files | None | The `placeholder` matches in `PhysicsPaintStudio.tsx` are the pre-existing `'loop-placeholder'` key kind, unrelated |
| — | — | Empty implementations or hardcoded empty data in phase surfaces | None | All dynamic values trace to the store/document/engine |
| — | — | Skipped/ignored phase tests | None | No `.skip`, `ts-ignore` or `ts-expect-error` in the new phase tests |
| `app/src/components/physic-paint/Status` | — | `void handleDocumentLightChange;` placeholder (64-07) | Removed | 64-09 removed it; no match remains |

The four stale source-pin tests named in the execution notes were repointed, not deleted: the `Paper` → `Paper & Light` label pins in `physicsPaintRightPanelModuleGate.test.ts` and `PhysicsPaintRightPanel.test.ts`, and the legacy-only pins in `dryMedia.test.ts` / `aquarellePresetSelection.test.ts`; all pass.

## Human Verification Required

### 1. Viscosity hardening

**Test:** Set Viscosity to 100 on a fresh stroke; compare with 0 (neutral).
**Expected:** Paint visibly hardens — it stops moving almost immediately and the deposit reads denser — while the neutral stroke renders exactly as before.
**Why human:** Visual paint feel on the live WebGL sheet.

### 2. Undo/redo of a thick embossed and a covering stroke

**Test:** Paint a thick embossed stroke, undo, redo; paint a high-Body covering stroke over a dried dark area, undo, redo.
**Expected:** Pigment and thickness restore together; redo restores the same deposited/eroded values; the dark area comes back with its thickness.
**Why human:** No WebGL2 history surface can be driven from vitest.

### 3. Reopen/replay relief; per-layer light independence

**Test:** Save a project with thick strokes, reopen, replay; then create two paint layers with different lights and switch between them.
**Expected:** The same relief repaints from the stroke script with no persisted thickness; each layer re-shades to its own light.
**Why human:** Live GPU reopen/replay and visual per-layer re-shade.

### 4. Paper & Light live re-light and one-step gesture

**Test:** In the Paper & Light tab, drag Azimuth / Elevation / Intensity without painting; undo once.
**Expected:** The settled wash re-lights immediately; the tab reads `Paper & Light`; one gesture is one ledger entry and undo restores the previous light.
**Why human:** Visual re-light and gesture feel.

### 5. Play/Apply bake parity after a light change

**Test:** Change the light, then run the reveal Play bake and the Apply/stroke-edit bake.
**Expected:** Baked frames match the live sheet's new light.
**Why human:** Live bake parity. The Roto Play-Script dialog bake is a separate declared deferral (see above) and should not be folded into this row.

### 6. Emboss look and zoom/pan stability

**Test:** Raise Emboss on a thick stroke; zoom and pan across it.
**Expected:** The paint reads as raised with a lit side and a shadow side; no shimmer or crawl.
**Why human:** Perceptual shimmer and emboss look.

### 7. Five medium looks and group picks

**Test:** Paint five strokes in five mediums; replay them; pick two brushes inside one group after a manual tweak; pick acrylic vs watercolor.
**Expected:** Each replay keeps its own look; a same-group pick keeps the tweak; acrylic reads thick and waterless, watercolor a wash; graphite is tooth-gated; a texture survives a group switch.
**Why human:** Visual medium looks and multi-group replay.

### 8. Body/order and scattering appearance

**Test:** Light pigment high Body over a dried dark area; Body 50; dark pigment high Body; water above zero at the border.
**Expected:** High Body reads light with no bleed-through; Body 50 tints without erasing; a dark high-Body stroke covers and stays dark; the border blends when water > 0.
**Why human:** Perceptual opacity/cover judgement.

### 9. Render parity and export

**Test:** Dry/replay/undo/redo after scattering; export in paper, transparent, white and pigment modes; zoom over a scattered area.
**Expected:** Identical rasters across dry/replay/undo/redo; export matches the screen on every mode; no shimmer.
**Why human:** Live screen-vs-export comparison and visual stability.

### 10. Medium dropdown and brush-library layout

**Test:** Open the medium dropdown; inspect the five brush sections.
**Expected:** The dropdown shows the selected medium; Watercolor / Gouache / Chalk / Graphite / Acrylic sections are always expanded, with the texture strip above and no filter/search/collapse.
**Why human:** UI look, popover placement and section layout.

## Gaps Summary

No blocking gaps were found: 96/99 plan truths are verified, all phase-scoped tests and all declared probe gates pass, the neutral watercolor stroke reproduces the committed pre-milestone baseline byte-for-byte (including with Body 0, emboss 0 and light intensity 0), and every key link is wired with real data flowing.

Two things prevent a `passed` verdict:

1. **Three backstop truths are present and wired but not behaviorally observed** — thickness undo/redo exactness, reopen-and-replay relief, and zoom/pan shimmer. They route to human verification, which is why the status is `human_needed`.
2. **MED-17 is PARTIAL** — the Roto Play-Script bake (`bakeAquarelleScript`) still renders with the engine default light. This is a declared deferral (`deferred-items.md`, `WINDOWS.md` #125), not a phase-introduced stub, and no later milestone phase covers it; it needs a follow-up quick or phase (port signature + staged-cache light term).

The remaining human rows are visual/perceptual checks the node harness cannot mount a canvas for; the automated halves of those same requirements are green.

---

_Verified: 2026-11-17T17:31:31Z_
_Verifier: Claude (gsd-verifier)_
