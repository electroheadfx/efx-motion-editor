---
phase: 64-medium-engine
verified: 2026-11-22T16:53:13Z
status: gaps_found
score: 167/194 must-haves verified
covered_files: [".planning/phases/64-medium-engine/64-01-PLAN.md",".planning/phases/64-medium-engine/64-01-SUMMARY.md",".planning/phases/64-medium-engine/64-02-PLAN.md",".planning/phases/64-medium-engine/64-02-SUMMARY.md",".planning/phases/64-medium-engine/64-03-PLAN.md",".planning/phases/64-medium-engine/64-03-SUMMARY.md",".planning/phases/64-medium-engine/64-04-PLAN.md",".planning/phases/64-medium-engine/64-04-SUMMARY.md",".planning/phases/64-medium-engine/64-05-PLAN.md",".planning/phases/64-medium-engine/64-05-SUMMARY.md",".planning/phases/64-medium-engine/64-06-PLAN.md",".planning/phases/64-medium-engine/64-06-SUMMARY.md",".planning/phases/64-medium-engine/64-07-PLAN.md",".planning/phases/64-medium-engine/64-07-SUMMARY.md",".planning/phases/64-medium-engine/64-08-PLAN.md",".planning/phases/64-medium-engine/64-08-SUMMARY.md",".planning/phases/64-medium-engine/64-09-PLAN.md",".planning/phases/64-medium-engine/64-09-SUMMARY.md",".planning/phases/64-medium-engine/64-10-PLAN.md",".planning/phases/64-medium-engine/64-10-SUMMARY.md",".planning/phases/64-medium-engine/64-11-PLAN.md",".planning/phases/64-medium-engine/64-11-SUMMARY.md",".planning/phases/64-medium-engine/64-12-PLAN.md",".planning/phases/64-medium-engine/64-12-SUMMARY.md",".planning/phases/64-medium-engine/64-13-PLAN.md",".planning/phases/64-medium-engine/64-13-SUMMARY.md",".planning/phases/64-medium-engine/64-14-PLAN.md",".planning/phases/64-medium-engine/64-14-SUMMARY.md",".planning/phases/64-medium-engine/64-15-PLAN.md",".planning/phases/64-medium-engine/64-15-SUMMARY.md",".planning/phases/64-medium-engine/64-16-PLAN.md",".planning/phases/64-medium-engine/64-16-SUMMARY.md",".planning/phases/64-medium-engine/64-17-PLAN.md",".planning/phases/64-medium-engine/64-17-SUMMARY.md",".planning/phases/64-medium-engine/64-18-PLAN.md",".planning/phases/64-medium-engine/64-18-SUMMARY.md",".planning/phases/64-medium-engine/64-19-PLAN.md",".planning/phases/64-medium-engine/64-19-SUMMARY.md",".planning/phases/64-medium-engine/64-20-PLAN.md",".planning/phases/64-medium-engine/64-20-SUMMARY.md",".planning/phases/64-medium-engine/64-21-PLAN.md",".planning/phases/64-medium-engine/64-21-SUMMARY.md",".planning/phases/64-medium-engine/64-22-PLAN.md",".planning/phases/64-medium-engine/64-22-SUMMARY.md",".planning/phases/64-medium-engine/64-23-PLAN.md",".planning/phases/64-medium-engine/64-23-SUMMARY.md",".planning/phases/64-medium-engine/64-24-PLAN.md",".planning/phases/64-medium-engine/64-24-SUMMARY.md",".planning/phases/64-medium-engine/64-25-PLAN.md",".planning/phases/64-medium-engine/64-25-SUMMARY.md",".planning/phases/64-medium-engine/64-26-PLAN.md",".planning/phases/64-medium-engine/64-26-SUMMARY.md",".planning/phases/64-medium-engine/64-27-PLAN.md",".planning/phases/64-medium-engine/64-27-SUMMARY.md",".planning/phases/64-medium-engine/64-28-PLAN.md",".planning/phases/64-medium-engine/64-28-SUMMARY.md","app/src/components/physic-paint/PhysicsPaintStudio.test.ts","app/src/components/physic-paint/PhysicsPaintStudio.tsx","app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx","app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts","app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts","app/src/components/physic-paint/engine/aquarelleSheetSignature.ts","app/src/components/physic-paint/engine/committedFrameRelight.test.ts","app/src/components/physic-paint/engine/committedFrameRelight.ts","app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts","app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts","packages/efx-watercolor/probe/medium-engine/compare.mjs","packages/efx-watercolor/probe/medium-engine/harness.test.ts","packages/efx-watercolor/src/playground/Engine.ts","packages/efx-watercolor/src/playground/lastTouch.test.ts","packages/efx-watercolor/src/playground/lastTouchCarry.test.ts","packages/efx-watercolor/src/playground/lastTouchCarry.ts","packages/efx-watercolor/src/playground/lastTouchClock.test.ts","packages/efx-watercolor/src/playground/lastTouchClock.ts","packages/efx-watercolor/src/playground/liveSeed.test.ts","packages/efx-watercolor/src/playground/scattering.test.ts","packages/efx-watercolor/src/playground/shaders.ts"]
covered_digest: "v4:sha256:da82460dd41f8a43a7a624d19e621249998a0e3ffc315a73e974cb1ec407777c"
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 143/174
  previous_covered_digest: "v4:sha256:4d7243dfcf792492d9a1f14a67fb419d6993a593eb8487ba32cde40ae025b9e1"
  gaps_closed:
    - "64-15 truth 2 — the commit consumes the coverage sheet end to end; the coverage raster is read directly (or via a transparent scratch), so the exponent 1 - cover is true on the real 2D compositor (CR-04, 64-25)"
    - "64-15 truth 4 — the committed alpha law, recorded and proven as OPAQUE TRANSMITTANCE: storage alpha 255, coverage in RGB only, visible alpha derived at display (64-25)"
    - "64-24 truth 3 — the last-touch field survives every texel outside the current dab via the previous-dab-rect carry; the dead uAmount is retired (CR-03/WR-03/IN-04, 64-26)"
    - "64-19 truth 2 — a relight refused during playback/draft/wireframe parks one request and drains it exactly once on the idle edge (WR-04, 64-27)"
  gaps_remaining:
    - "Body has no row in the globals panel (64-06 truth 1, MED-19)"
    - "Emboss is capped at 15, not the 0..100 row (64-04 truth 5)"
    - "The bristle Body path is Body-independent — Body 0 and Body 100 captures are digest-identical (64-22 truth 3, MED-21)"
    - "12 of 15 committed probe gates FAIL; the coverage-alpha invariants still read a darkness-only alpha"
    - "Plan truths that describe the pre-amendment row/key law are failed as written (64-22 truth 4, 64-02 truth 3, 64-15 truth 3)"
    - "The four bristle identity gates and the edge census fail on their own digests and relation invariant"
    - "UAT: 4 failed rows (11-14) and 10 pending; 64-UAT.md says 'NOT complete'"
  regressions: []
gaps:
  - truth: "64-15 truth 3 — The coverage sheet is guarded (`isFullyOpaqueRaster` + transparent fallback, null fallback)"
    status: failed
    reason: "The seam never calls `isFullyOpaqueRaster`; `aquarelleLayerContract.test.ts` pins its absence. The shipped guard is different in form: `readCoverage` returns null when the raster is unreadable or mis-sized (WR-02 source-dimension check) and the merge fails open to the raw sheet. The guard's intent holds, but the truth as written names a mechanism that does not exist."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts"
        issue: "no `isFullyOpaqueRaster` call; readCoverage null-guard + fail-open instead"
    missing:
      - "Amend the truth text to the shipped guard (readCoverage null + fail-open), or restore the named helper"
  - truth: "64-04 truth 5 — Emboss is the globals row on 0..100 via the one mapping"
    status: failed
    reason: "Post-UAT the Emboss slider is capped at 15 (`EMBOSS_MAX = 15`, aquarelleParamVisibility.ts:90; comment: 'emboss relief is very hard above 15'). The row exists and maps through the one mapping, but not on 0..100."
    artifacts:
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
        issue: "EMBOSS_MAX = 15"
    missing:
      - "Either restore the 0..100 row or record the artist's cap as an amendment to the plan/requirement text"
  - truth: "64-06 truth 1 — Body row between Viscosity and Emboss; default 0"
    status: failed
    reason: "Quick 261121-mtu removed the Body row entirely: 'body has no row anywhere (bag-only, Reset-only)' (aquarelleParamVisibility.ts:29) and a test pins that no row key is 'body'. MED-19 explicitly requires Body exposed as a row in the existing globals panel, and roadmap SC5 describes the user setting Body high / Body 50."
    artifacts:
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
        issue: "AQUARELLE_PARAM_ROWS has no body row"
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts"
        issue: "pins 'never gives body, wetSeconds or size a row'"
    missing:
      - "Restore the Body row, or obtain an explicit amendment of MED-19/SC5 and the plan truth"
  - truth: "64-22 truth 3 — The Body cover pass for a bristle response is bristle-modulated and writes fixed (alpha-shaped) and relief (LINEAR) on the gather mask"
    status: failed
    reason: "The D-21 Body erode pass is deleted for bristle responses (bristleBodyCoverFS pinned absent; coverPass is skipped when !bristle). The dab law attenuates ink AND fixed by (1-a) inside bristleInk, Body-independent. Fresh evidence this run: the correctly-invoked bristle-body0 and bristle-body100 gates produce BYTE-IDENTICAL captures (digestPaper 06490686 / digestTransparent 5d8ad79c / digestWhite 39a717e2 / digestPigment c12cc2f3 in both), so Body currently has no effect at all on the bristle path."
    artifacts:
      - path: "packages/efx-watercolor/src/playground/Engine.ts"
        issue: "coverPass skipped for bristle responses; bristleInk attenates ink+fixed regardless of Body"
      - path: "packages/efx-watercolor/src/playground/shaders.ts"
        issue: "bristleBodyCoverFS removed; third gather consumer is bristleReliefFS"
    missing:
      - "Reconcile the plan truth/prohibition text with the shipped dab law (delivery-law amendment), or restore the Body-modulated cover pass"
  - truth: "64-22 truth 4 — Feather/Pickup/Refill are canonical globals in the Paint tab in the thirteen-row order (Feather after Body, Pickup then Refill after Feather, Emboss last), and Feather widens the gather's softness band (0.09 + 0.25·feather)"
    status: failed
    reason: "Row law changed: no Body row; emboss is second, not last; pickup/refill precede feather; pickup is hidden for watercolor and refill for watercolor/acrylic (quick 261121-mtu). `gatherSoftness` returns the constant BRISTLE_SOFTNESS (0.09) and ignores feather; the bristle-edge census confirms it (Feather 100 narrower than Feather 0)."
    artifacts:
      - path: "packages/efx-watercolor/src/playground/bristles.ts"
        issue: "gatherSoftness ignores feather"
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
        issue: "13 rows with a different order; body absent; pickup/refill hidden per medium"
    missing:
      - "Amend the plan truth to the artist's row law and softness constant, or restore the written behaviour"
  - truth: "64-22 truth 5 / 64-23 truth 6 / 64-21 truth 5 — Every non-bristle response is byte-identical; the identity gates reproduce their committed baselines"
    status: failed
    reason: "The committed gates for white-over-blue, red-over-blue-50, cover-advect, cover-lift, cover-over-wet and cover-textured all FAIL on digestPigment and/or their scenario invariants (fresh run: 12 of 15 gates red). The drift is caused by the 2026-11-21 display-alpha amendment plus later acrylic/bristle commits that were never re-baselined; re-authoring them was explicitly out of scope for 64-25..64-28."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/*.json"
        issue: "cover-* and red/white-over-blue baselines captured 2026-11-18 (7ca0c63d2), before the alpha amendment"
      - path: "packages/efx-watercolor/probe/medium-engine/compare.mjs"
        issue: "invariants still assert coverage-derived alpha (crossCoverAlpha / coverAlpha*), which the pigment export no longer carries"
    missing:
      - "Re-author the affected baselines and invariants to the shipped alpha law, or restore the coverage-alpha law"
  - truth: "64-23 truth 5 — The bristle-edge census proves Feather 100 is wider than Feather 0 with non-zero directional variation and width below half-width"
    status: failed
    reason: "Deterministic gate failure (fresh run): 'INVARIANT edgeSoftnessPxFeather100 1.87 is not wider than edgeSoftnessPxFeather0 20.27 (Feather is not widening the band)'. The census direction is inverted relative to its own invariant."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/bristle-edge-1080.json"
        issue: "captured 2026-11-19; current capture fails the relation invariant (all 4 digests differ)"
    missing:
      - "Fix the feather/edge law so the census direction holds, or re-specify the census invariant with the artist's ruling"
  - truth: "64-24 truth 6 — Every non-bristle render is byte-identical and the four bristle gates are re-authored from verified pairs plus a bristle-wet proof"
    status: failed
    reason: "All four bristle-body gates FAIL when run with their recorded scenario (cover-textured, bristle-flat/bristle-round, 1080/2048): 4 differing digests each and 'coverAlphaCoveredFraction 0 is outside [0.02, 0.80]'. bristle-wet-1080 fails with 4 differing digests (pickup 28.37 vs 214.09 now passes the 64-28 derived floor). The non-bristle identity set is also red."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/bristle-*.json"
        issue: "captured 2026-11-19, before the 2026-11-21/22 alpha and acrylic commits"
    missing:
      - "Re-author the four bristle baselines and the wet proof after the alpha/acrylic law settles"
  - truth: "Roadmap SC5 / MED-19 — Body is a user-facing order term; a light pigment covers and lightens a dark one, Body 50 lightens without erasing"
    status: failed
    reason: "No Body row (above); the Body-100 white-over-blue gate fails both alpha bars (crossCoverAlpha 0.05 < 0.90; crossCoverAlpha - crossDarkAlpha 0 < 0.60); the Body 60 bar fails (gap 0 < 0.04). The phase's own UAT files this twice: row 12 says Body 'behaves as a transparency/coverage term, the rim is a hard line, and a pale halo outlines every bristle stroke'. Fresh: the bristle Body 0/100 pair is digest-identical."
    artifacts:
      - path: "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
        issue: "no Body row"
      - path: "packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json"
        issue: "crossCoverAlpha 0.05, gap 0; Body 60 gap 0"
    missing:
      - "Make Body a real order term with a visible control, and re-prove the crossing bars"
  - truth: "Roadmap SC7 / MED-18 / MED-25 / MED-38 — Export matches the screen on every uMode path; undo restores the eroded pigment and thickness exactly"
    status: failed
    reason: "CR-04 is now fixed (64-25), so the committed merge no longer wipes the base. But export/screen parity is still not demonstrated on the committed path: the mode-4 pigment export is darkness-only while the probe invariants that assert the coverage claim are red, and the acceptance matrix is red (12/15). Undo of the eroded pools remains structurally pinned only (behavior-unverified, carried)."
    artifacts:
      - path: "packages/efx-watercolor/src/playground/shaders.ts"
        issue: "mode-4 alpha is darkness-only; live underlay law differs"
      - path: "packages/efx-watercolor/probe/medium-engine/compare.mjs"
        issue: "coverage-alpha invariants still active against a darkness-only export"
    missing:
      - "Re-establish and re-gate the export/screen parity contract on the shipped storage law"
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
    reason: "Fresh deterministic gate failures: white-over-blue (digestPigment a6df8b31 vs 786fcb32; crossCoverAlpha 0.05 < 0.90; crossCoverAlpha - crossDarkAlpha 0 < 0.60), cover-advect (0.12 < 0.60), cover-lift (0.12 < 0.90; afterLift 0.08 > 60% of before), cover-textured (4 digests differ; coveredFraction 0), cover-over-wet (digestPigment differs), red-over-blue-50 (digestPigment differs). The invariants measure coverage through an alpha channel that is now darkness-only."
    artifacts:
      - path: "packages/efx-watercolor/probe/medium-engine/compare.mjs"
        issue: "coverage-alpha invariants still active"
      - path: "packages/efx-watercolor/probe/medium-engine/probe.ts"
        issue: "crossCoverAlpha = alphaMean(pigment, cross); the pigment alpha is darkness-only"
    missing:
      - "Re-specify the invariants/instrument on the coverage raster (exportCanvas('coverage')) or restore coverage-derived display alpha; re-capture baselines from verified deterministic pairs"
  - truth: "64-16 truth 4 — UAT rows 2/7/8 describe the coverage model and no row is answered"
    status: failed
    reason: "64-UAT.md has 10 pending rows and 4 FAILED rows (11-14), updated 2026-11-18T19:08:56Z, and its summary states: 'Phase status: NOT complete.' The gap-closure round did not run UAT."
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
    why_human: "The probe bars for Body are RED (see gaps); the visual read is additionally human."
  - test: "UAT 9 — Dry, replay, undo/redo, and export in every mode (paper, transparent, white, pigment) after scattering; zoom over a scattered area."
    expected: "Identical rasters across dry/replay/undo/redo; export matches the screen on every mode; no shimmer."
    why_human: "Export/screen parity is visual and its committed acceptance matrix is still red."
  - test: "UAT 10 — Open the medium dropdown in the Paint tab and inspect the five brush-library sections."
    expected: "Dropdown shows the selected medium; Watercolor / Gouache / Chalk / Graphite / Acrylic sections are always expanded, with the texture strip above and no filter/search/collapse."
    why_human: "Visual layout judgement."
  - test: "64-27 coverage D3 — commit a light change during a real playback session, then let playback end."
    expected: "The visible committed frame re-lights exactly once when the blocking state clears, under the document's newest light."
    why_human: "The parked scheduler and its idle-edge drain are unit-tested and source-pinned, but the visible re-light across a real Studio playback session cannot be exercised by vitest (no WebGL2 Studio surface). Flagged human_judgment in the 64-27 plan."
---

# Phase 64: Medium Engine Verification Report

**Phase Goal:** Paint gains weight — one Viscosity global, five named Mediums, a real paint-thickness field lit as an emboss, an order term (`Body`), a scattering term and medium-grouped brushes let a stroke read denser, heavier and genuinely opaque, while a neutral watercolor stroke renders exactly as it did before.

**Verified:** 2026-11-22T16:53:13Z
**Status:** gaps_found
**Score:** 167/194 must-haves verified; 24 failed; 3 present, behavior-unverified
**Re-verification:** Yes — after the re-review gap closure (64-25..64-28 + `95220123f`). The prior report (2026-11-22T13:46:23Z, 143/174, gaps_found) is the contract; its 16 gap entries were re-checked, the four closed ones are recorded below, and the fingerprint was recomputed over the expanded covered set (`v4:sha256:da82460d…`).

**Bottom line:** the four re-review plans and the follow-up review-fix commit are real and well-tested — CR-04, CR-03, WR-03, WR-04, IN-04, IN-05, IN-07 plus review findings WR-01, WR-02, IN-01, IN-03 are fixed in source with substantive gates, and no previously verified truth regressed (full suites green). The phase goal is still not achieved: the Body row is absent, Body is inert on the bristle path, Emboss is capped at 15, 12 of 15 committed probe gates fail, and the artist's `64-UAT.md` still records 4 failed rows and 10 pending — "Phase status: NOT complete".

## Goal Achievement

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Viscosity row; neutral default bit-identical; maximum visibly hardens without redefining `flow` | ✓ VERIFIED (mechanism + identity); UAT 1 pending | Viscosity row present; dissipation/spread laws pinned by `viscosity.test.ts`; `neutral-identity` and `watercolor-50` PASS this run |
| 2 | Same raster live/bake/replay; lowering Viscosity after settle does not change settled pigment | ✓ VERIFIED | `determinismContract.test.ts`; single-read/two-site pins; no settle/display consumer |
| 3 | Fresh session selects watercolor; five mediums apply whole sets in one move; next stroke only; per-stroke replay; manual tweak keeps medium | ✓ VERIFIED (automated); UAT 7 pending | `mediums.ts` five records; `mediumSelection.test.ts` one bag write; `brushGroupMedium.test.ts` |
| 4 | Thickness deposit + superpose; lit emboss; light changes the render on live, re-render, Play, Apply, vector edit; never the paint | ✓ VERIFIED (mechanism); undo/replay/shimmer behavior-unverified; UAT 3/4/5/6 pending | `reliefFS`; `displayFS` emboss; light threaded through every enumerated bake; `bakeAquarelleScript` deferral remains |
| 5 | Light pigment covers/lightens dark; Body erodes full core/partial edges and scatters; Body 50 lightens; Body 0 bit-identical | ✗ FAILED | No Body row (MED-19); white-over-blue Body 100 alpha bars red; Body 60 bar red; the bristle Body 0/100 pair is digest-identical; UAT 12 says Body behaves as transparency |
| 6 | Five library sections; group→medium in one write only when the group changes; 15 classified + 8 new | ✓ VERIFIED; UAT 10 pending | `brushGroupOrder/Labels/sections`; 23 presets; `pickAquarelleBrush` |
| 7 | Export matches screen on every `uMode`; no shimmer on zoom; undo restores eroded pigment and thickness | ✗ FAILED | CR-04 fixed, but the export/parity acceptance matrix is still red; undo structural + behavior-unverified |

### Re-review Gap-Closure Plans (the delta this run judged)

#### 64-25 — Coverage-Composite Merge (MED-22, MED-25, MED-38) — 4 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Coverage red survives compositing: direct read or TRANSPARENT scratch; cover 0 keeps the base (128,128); cover 0.5 exponent 0.498; cover 1 replaces | ✓ VERIFIED | `readCoverage` direct read / transparent scratch in `physicsPaintRotoAlphaMerge.ts`; test asserts `[128,128,64]`, ≈182, sheet at cover 255 |
| 2 | Committed alpha law is OPAQUE TRANSMITTANCE, proven end to end (storage 255; derived 127/159/191) | ✓ VERIFIED | `b[i + 3] = 255` with the storage-law comment; `alphaScene` exact merged bytes + derived alphas over the real `transmittanceRectToPigmentAlpha` |
| 3 | Fail-open unchanged; exactly one `transmittanceSourceToPigmentAlpha` in the merge | ✓ VERIFIED | fail-open tests (null / unreadable / mis-sized); one conversion call (pigment-alpha branch) |
| 4 | The gate models the REAL compositor (source-over alpha-over + genuine white fill); RED recorded | ✓ VERIFIED | `ModelCanvas`/`ModelContext` implement source-over and unpremultiplied readback; WR-02 mis-sized scaling test; TDD RED evidence recorded before the fix |

#### 64-26 — Last-Touch Carry and Clock (MED-05, MED-23, MED-38) — 6 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every texel outside the current dab keeps its previous value; the previous-dab-rect carry makes the halves agree | ✓ VERIFIED | `lastTouchCarry.ts`; CPU gate reproduces the shipped rollback, then proves two non-overlapping dabs both survive (and a third, and an overlap) |
| 2 | The carry is invalidated at every whole-target write (`clearLastTouch`, `uploadWhole`, `resizeDocument` copy) and pinned; the false docstring is corrected | ✓ VERIFIED | `invalidateCarry` at Engine.ts:811, 915, 1001 (+2115 from IN-03); source-pin tests; docstring now states the carry law |
| 3 | `WholeDoc.layers.lastTouch` carries AGES; `captureSheet`/`restoreSheet` are pass-through; `restoreSheet` never mutates the ages array | ✓ VERIFIED | `stampsToAges` in `captureWhole`, `agesToStamps` in `uploadWhole` (new array); clock tests pin no mutation |
| 4 | The live time base is monotonic; only `setClock` re-anchors; the precision bound is recorded | ✓ VERIFIED | `clearLastTouch` never touches `timeBaseMs`; `setClock` nulls it; f32 bound test at 24 h |
| 5 | The touch path carries no dead uniform | ✓ VERIFIED | `bristleTouchFS` declares only `uTimes`/`uCover`/`uNow`; `bristleTouch` takes no amount; supersession recorded in the shader comment and suite header |
| 6 | Affected pins amended in place; the probe harness/baselines untouched | ✓ VERIFIED | amended suites green; baselines still at `a6dcd283c` (2026-11-19) |

#### 64-27 — Parked Relight Refusal (MED-17) — 5 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A refused relight is PARKED, not dropped; the idle edge runs exactly one bake against the then-current document | ✓ VERIFIED | `setBlocked` + one `pending` flag; drain on the blocked-to-idle edge; committedFrameRelight tests |
| 2 | No retry loop; requests collapse into one pending; a refusal is distinguishable from "ran, no change" | ✓ VERIFIED | no timers; `start()` parks before setting `inFlight`; tests |
| 3 | Every bound survives across the edge: one in flight, one queued, one automatic follow-up, swallowed rejection, `settle()` waits through a parked request | ✓ VERIFIED | four new interleaving tests (unblock-during-flight queues, never a second run) |
| 4 | The Studio drives the gate from ONE narrow signal effect; no render-body write, no `.peek()`, no timer; controller creation and the two request sites untouched | ✓ VERIFIED | `useLayoutEffect` + one `effect()` reading `isPlaying` / `draftMode.value` / `wireframeMode.value`, dep `[isPlaying]`; one `setBlocked` call site (WR-01 fix in `95220123f`) |
| 5 | The runner's guards stay; the last-seen signature advances only after a real bake | ✓ VERIFIED | guards intact; `lastSyncedLightSignatureRef` advances only on `applied` |

D3 (a visible re-light across a real playback session) is `human_judgment: true` in the plan and is carried on the human-verification list — not failed.

#### 64-28 — Sheet Signature and Pickup Floor (MED-05, MED-23, MED-38) — 5 truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The cache key is the WHOLE event list, canonically digested; any deposit-affecting field or order changes it | ✓ VERIFIED | `aquarelleSheetSignature.ts` (FNV-1a, type-tagged, length-framed, sorted keys); 10 tests; wired at 3 call sites |
| 2 | The digest is canonical and total: key-order independent, explicit markers for absent/non-finite, unsigned 32-bit | ✓ VERIFIED | `aquarelleSheetSignature.test.ts` (order-only, key-insertion, totality, explicit undefined) |
| 3 | The digest is a deliberate superset of the deposit inputs (over-invalidation is the safe side) | ✓ VERIFIED | encoder hashes every event field; docstring records the asymmetry |
| 4 | The pickup floor is derived from the recorded baseline gap (199.52 → 99.76), not the decorative 1-luma bar | ✓ VERIFIED | `compare.mjs` `RECORDED_PICKUP_GAP`/`PICKUP_MIN_DELTA`; fresh bristle-wet capture 28.37 vs 214.09 passes the relation |
| 5 | Synthetic executions and pins amended; a new 49/50 pair becomes the discriminating case | ✓ VERIFIED | `harness.test.ts` (recorded pair exits 0; 100/100.5 and 49/50 exit 1 with the derived-floor message) |

### Carried Failed Truths (from the prior contract)

| # | Truth group | Status | Fresh evidence |
| --- | --- | --- | --- |
| 1 | 64-06 truth 1 / MED-19 — Body row | ✗ FAILED | `aquarelleParamVisibility.ts:29` "`body` has no row anywhere"; test pins the absence |
| 2 | 64-04 truth 5 — Emboss 0..100 row | ✗ FAILED | `EMBOSS_MAX = 15` (line 90) |
| 3 | 64-22 truth 3 / MED-21 — bristle Body modulation | ✗ FAILED | Body 0 and Body 100 captures digest-identical (c12cc2f3 both) |
| 4 | 64-22 truth 4 — row law + Feather widening | ✗ FAILED | 13 rows, no Body, emboss second; `gatherSoftness` constant |
| 5 | 64-22 truth 5 / 64-23 truth 6 / 64-21 truth 5 — identity gates | ✗ FAILED | white-over-blue, red-over-blue-50, cover-* red (fresh run) |
| 6 | 64-23 truth 5 — edge census | ✗ FAILED | 1.87 not wider than 20.27 |
| 7 | 64-24 truth 6 — bristle gates re-authored | ✗ FAILED | four gates, 4 differing digests + coveredFraction 0; bristle-wet 4 digests |
| 8 | SC5 / MED-19 — Body order term visible | ✗ FAILED | no row; white-over-blue bars; UAT 12 |
| 9 | SC7 / MED-18 / MED-25 / MED-38 — export parity + undo | ✗ FAILED | probe matrix red; undo behavior-unverified |
| 10 | 64-02 truth 3 — ten medium keys | ✗ FAILED | 14 keys per record |
| 11 | 64-16 t1/t2, 64-17 t3/t4/t5, 64-20 t1/t2, 64-14 t6 — probe matrices green | ✗ FAILED | 12/15 gates red |
| 12 | 64-16 truth 4 — UAT rows answered | ✗ FAILED | 4 failed + 10 pending; "NOT complete" |
| 13 | 64-15 truth 3 — `isFullyOpaqueRaster` guard at the seam | ✗ FAILED | no call; contract pins its absence; readCoverage null-guard + fail-open instead |

### Regression Check on Previously Verified Truths

All previously VERIFIED truths were re-checked at existence/basic-sanity level, and the full suites were green this run (see Behavioral Spot-Checks). No regression is recorded. The prior report's four re-opened items (CR-04, CR-03, WR-04, plus 64-15 truth 4) are closed above.

### Deferred Items

None. Phase 65 (Studio API/MCP) does not cover the remaining Body, probe-matrix or UAT gaps.

**Declared deferral (documented, not a gap):** `bakeAquarelleScript` (Roto Play-Script consume/Apply branch) still renders with the engine default light — logged in `deferred-items.md` and `.planning/WINDOWS.md` row 125, and explicitly scoped out of UAT row 5.

### Advisory (New Scope, Unevidenced)

None. Every blocking finding is either a carried-forward gap from the prior report or backed by a deterministic fresh artifact (the probe captures, the source pins, or the test failures). New-scope observations (`run.mjs:60` stale alpha prose; the prior report's invalid `--scenario bristle-body` invocation) are attached to the existing probe-contract gap, not scored as new blockers.

## Required Artifacts

`verify.artifacts` returns no parsed entries for the four gap plans (their `must_haves.artifacts` are bare path strings), so each was checked manually at four levels.

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts` | coverage read + storage law | ✓ VERIFIED | direct read gated on SOURCE dims; transparent scratch; `b[i+3]=255`; fail-open; one conversion |
| `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts` | real-compositor gate | ✓ VERIFIED | ModelContext implements source-over; cover 0/0.5/1, alpha law, WR-02 scaling, fail-open |
| `packages/efx-watercolor/src/playground/lastTouchCarry.ts` | one-rect carry state machine | ✓ VERIFIED | `newLastTouchCarry`/`takeCarry`/`recordStamp`/`invalidateCarry`; imported and used by Engine |
| `packages/efx-watercolor/src/playground/lastTouchClock.ts` | stamps↔ages | ✓ VERIFIED | in-place → ages; new-array stamps; no clock reads |
| `packages/efx-watercolor/src/playground/Engine.ts` | carry + ages + monotonic base | ✓ VERIFIED | carry blit before the scissored stamp; 4 invalidation sites; `captureWhole`/`uploadWhole`; `clearLastTouch` never re-anchors |
| `packages/efx-watercolor/src/playground/shaders.ts` | no dead uniform | ✓ VERIFIED | `bristleTouchFS` has `uTimes`/`uCover`/`uNow` only |
| `app/src/components/physic-paint/engine/committedFrameRelight.ts` | parked scheduler | ✓ VERIFIED | `setBlocked`, one `pending`, idle-edge drain, no timers |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | gate + request sites | ✓ VERIFIED | layout-effect gate; two request sites; merge uses coverage-composite |
| `app/src/components/physic-paint/engine/aquarelleSheetSignature.ts` | canonical digest | ✓ VERIFIED | FNV-1a over a type-tagged sorted-key walk |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | cache keyed on digest | ✓ VERIFIED | `rememberSheet`/`takeSheet`/`restoreCachedSheet` use the digest |
| `packages/efx-watercolor/probe/medium-engine/compare.mjs` | derived pickup floor | ✓ VERIFIED for IN-07; ⚠️ STALE CONTRACT overall | floor 99.76 derived; coverage-alpha invariants still assert the old law |
| `packages/efx-watercolor/probe/medium-engine/baselines/*` | committed references | ⚠️ STALE | untouched since 2026-11-18/19; 12 gates fail against them |

## Key Link Verification

`verify.key-links` reports every link unverified because its heuristic checks the `to` path textually inside the `from` file, and these links are described as prose contracts (data-format/law links). Each was verified manually:

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `Engine.exportCoverageCanvas` | `physicsPaintRotoAlphaMerge.ts` | cover in RGB AND alpha → merge reads red directly | WIRED | `readCoverage` direct read; transparent-scratch fallback |
| `physicsPaintRotoAlphaMerge.ts` | `AquarelleCachedBaseLayer.tsx` | opaque transmittance → display-derived alpha | WIRED | `transmittanceRectToPigmentAlpha` at the display layer |
| `useRotoFramePersistenceCoordinator.ts` | `physicsPaintRotoAlphaMerge.ts` | `mergeBlend: 'coverage-composite'` + coverage canvas | WIRED | Studio call sites at ~10324/10345 |
| `Engine.bristleTouch` | `shaders.bristleTouchFS` | scissored draw over the dab rect | WIRED | read half sampled, write half stamped |
| `Engine.bristleTouch` | `lastTouchCarry.ts` | carry read→write before the stamp; invalidations | WIRED | import line 33; call sites 3600/3611; invalidations 811/915/1001/2115 |
| `Engine.captureWhole/uploadWhole` | `lastTouchClock.ts` | ages boundary | WIRED | `stampsToAges` / `agesToStamps` |
| `PhysicsPaintStudio.tsx` | `committedFrameRelight.ts` | `setBlocked` gate + two request sites | WIRED | one setBlocked call site; layout effect |
| `committedFrameRelight.ts` | the Studio's Apply lane | reads light + events at run time; signature after a true result | WIRED | last-seen signature advances only on `applied` |
| `AquarelleCanvasLayer.tsx` | `aquarelleSheetSignature.ts` | cache key = whole-event digest | WIRED | three call sites; old count-based walk absent |
| `compare.mjs` | `baselines/bristle-wet-1080.json` | pickup floor derived from the recorded gap | WIRED | `RECORDED_PICKUP_GAP = 199.52`; fresh capture passes the relation |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `physicsPaintRotoAlphaMerge.ts` | `cov` | coverage raster red channel, read directly/transparently | Yes | ✓ FLOWING (was HOLLOW_PROP under CR-04) |
| `Engine.bristleTouch` | `lastTouch` field | previous-dab carry + scissored stamp | Yes | ✓ FLOWING (was DISCONNECTED under CR-03) |
| `lastTouch` carrier | age | ages boundary re-stamped on the live clock | Yes | ✓ FLOWING (was WRONG across time-base resets) |
| `committedFrameRelight` | pending request | blocked-state gate → idle edge | Yes | ✓ FLOWING |
| `AquarelleCanvasLayer` | sheet signature | whole event list canonical digest | Yes | ✓ FLOWING |
| `compare.mjs` | pickup floor | baseline's recorded gap | Yes | ✓ FLOWING |
| `displayFS` mode 4 | cover | live underlay branch only | Partial | ⚠️ STATIC (export ignores coverage by design after the amendment) |
| `aquarelleParamVisibility.ts` | Body row | — | none | ✗ MISSING (no row; MED-19) |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Gap-plan app suites (5 files) | `pnpm exec vitest run` (cwd `app`, the 5 files) | 511 passed | ✓ PASS |
| Gap-plan package suites (6 files) | `pnpm exec vitest run` (cwd `packages/efx-watercolor`, the 6 files incl. `harness.test.ts`) | 169 passed | ✓ PASS |
| Full app suite | supplied by the run (already gathered) | 465 files / 9,792 passed / 1 skipped | ✓ PASS |
| Full package suite | supplied by the run (already gathered) | 41 files / 896 passed / 8 skipped | ✓ PASS |
| Regression gate | supplied by the run | 48 files / 2,072 tests passed | ✓ PASS |
| Typecheck / build | supplied by the run | both `tsc --noEmit` clean; build passed (largest chunk 1.85 MB < 2 MB) | ✓ PASS |
| Probe gates (15) | see Probe Execution | 3 PASS / 12 FAIL | ✗ FAIL |

## Probe Execution

Run in headless WebGL2 Chrome from `packages/efx-watercolor/probe/medium-engine`; fresh this round (logs `/tmp/verify64-probes-r2.log`, `/tmp/verify64-bristle-r2.log`). Baselines untouched (still at `a6dcd283c`, 2026-11-19).

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| neutral-identity | `node run.mjs --gate neutral-identity` && `node compare.mjs neutral-identity` | all 7 fields equal | PASS |
| neutral-pigment | `--gate neutral-pigment --size 256` && compare | all 7 fields equal | PASS |
| watercolor-50 | `--gate watercolor-50 --scenario watercolor-50 --size 1080` && compare | all 7 fields equal | PASS |
| white-over-blue | `--gate white-over-blue --scenario white-over-blue --size 1080 --body 100` && compare | digestPigment a6df8b31 vs 786fcb32; crossCoverAlpha 0.05 < 0.90; crossCoverAlpha − crossDarkAlpha 0 < 0.60 | FAILED |
| cover-advect | `--gate cover-advect --scenario cover-advect --size 256 --body 100` && compare | digestPigment differs; coverAlphaAfterAdvect 0.12 < 0.60 | FAILED |
| cover-lift | `--gate cover-lift --scenario cover-lift --size 256 --body 100` && compare | coverAlphaBeforeLift 0.12 < 0.90; afterLift 0.08 > 60% of before | FAILED |
| cover-textured | `--gate cover-textured --scenario cover-textured --size 512 --body 100 --brush chalk` && compare | 4 digests differ; coverAlphaCoveredFraction 0 outside [0.02, 0.80] | FAILED |
| cover-over-wet | `--gate cover-over-wet --scenario cover-over-wet --size 256 --body 100` && compare | digestPigment differs; 0 scenario invariants failed | FAILED |
| red-over-blue-50 | `--gate red-over-blue-50 --scenario red-over-blue-50 --size 1080 --body 100` && compare | digestPigment differs | FAILED |
| bristle-edge-1080 | `--gate bristle-edge-1080 --scenario bristle-edge --size 1080` && compare | 4 digests differ; edgeSoftnessPxFeather100 1.87 not wider than Feather0 20.27 | FAILED |
| bristle-wet-1080 | `--gate bristle-wet-1080 --scenario bristle-wet --size 1080` && compare | 4 digests differ; 0 scenario invariants failed; pickup 28.37 vs 214.09 (passes the derived 99.76 floor) | FAILED |
| bristle-body0-1080 | `--gate bristle-body0-1080 --scenario cover-textured --size 1080 --brush bristle-flat` && compare | 4 digests differ; coverAlphaCoveredFraction 0 outside [0.02, 0.80] | FAILED |
| bristle-body100-1080 | same with `--body 100` | 4 digests differ; identical capture digests to the body-0 run | FAILED |
| bristle-round-body0-1080 | same with `--brush bristle-round` | 4 digests differ; coveredFraction 0 | FAILED |
| bristle-body100-2048 | same with `--size 2048 --body 100` | 4 digests differ; coveredFraction 0 | FAILED |

Note (verification-metadata correction): the prior report invoked the four bristle-body gates with `--scenario bristle-body`, which the current harness rejects ("invalid --scenario"), so those comparisons read a stale capture. Re-run this round with the baselines' own recorded scenario (`cover-textured`, the recorded brush and size), the four gates still fail identically — 4 differing digests and coveredFraction 0. For the two `bristle-flat` gates, the Body 0 and Body 100 captures are digest-identical: Body currently changes nothing on the bristle path.

## Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `physicsPaintRotoAlphaMerge.test.ts` | MED-22/25/38 | all | 0 | no | Behavioral (real compositor model) | PASS — the former CR-04 blind spot is gone |
| `lastTouchCarry.test.ts` | MED-05/23/38 | 7 | 0 | no | Behavioral (pair simulation reproduces the bug and the fix) | PASS |
| `lastTouchClock.test.ts` | MED-05/23 | 4 | 0 | no | Value/Behavioral | PASS |
| `lastTouch.test.ts` | MED-32..38 | 26 | 0 | no | Source pins for the GL wiring; the pair law is covered by the carry gate | PASS with note (the GPU blit itself is not pixel-observed) |
| `committedFrameRelight.test.ts` | MED-17 | 10 | 0 | no | Behavioral (scheduler interleavings incl. parked cases) | PASS |
| `PhysicsPaintStudio.test.ts` | MED-17 | 446 | 0 | no | Source pins (one gate, layout effect, one setBlocked site) | PASS |
| `aquarelleSheetSignature.test.ts` | MED-05/23/38 | 10 | 0 | no | Behavioral (identity, order, totality) | PASS |
| `aquarelleLayerContract.test.ts` | MED-05/23 | all | 0 | no | Source pins (three sites, old walk absent) | PASS |
| `probe/medium-engine/harness.test.ts` | MED-19..21 | 53 | 0 | partial (self-captured baselines by design) | Status/Value | PASS |
| `aquarelleParamVisibility.test.ts` | MED-19 | all | 0 | no | Value | PASS as a test; it pins the deviation (no `body` row) |

**Disabled tests on requirements:** 0.
**Insufficient assertions:** 0 blockers in the gap-plan tests. Residual: `compare.mjs`'s coverage-alpha invariants measure an alpha the pigment export no longer carries (the carried matrix gap); `lastTouch.test.ts` remains source-pin for the GPU side of the carry.

### Decision Coverage

`check decision-coverage-verify` returns `skipped: true` (non-blocking): the verb looks for `CONTEXT.md`, while this phase stores `64-CONTEXT.md`. Not evaluable programmatically.

## Requirements Coverage

All 38 MED IDs appear in at least one plan's `requirements` field (no orphans). 32 SATISFIED, 6 BLOCKED.

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MED-01 | 64-02 | Viscosity global row 0..100 → 0..1 | ✓ SATISFIED | row present; bag/keys |
| MED-02 | 64-01/21 | Neutral default bit-identical | ✓ SATISFIED | `neutral-identity` + `watercolor-50` PASS; paperSeed pinned |
| MED-03 | 64-01 | Dissipation only raises; two sites | ✓ SATISFIED | additive exponent; count pins |
| MED-04 | 64-01 | Spread `0.12*(1-v*0.9)` | ✓ SATISFIED | source + tests |
| MED-05 | 64-01/24/26/28 | Per-stroke snapshot; live=bake=replay | ✓ SATISFIED | snapshot + determinism; ages boundary; whole-event signature |
| MED-06 | 64-01 | Post-settle change does not reprocess | ✓ SATISFIED | source scan |
| MED-07 | 64-02 | Medium plain record | ✓ SATISFIED | `mediums.ts` |
| MED-08 | 64-02 | `watercolor` = today's defaults; fresh session | ✓ SATISFIED | derived record |
| MED-09 | 64-02 | Five built-ins with recorded numbers | ✓ SATISFIED (amended set: 14 medium keys over the 16-key canonical set) | records pinned |
| MED-10 | 64-02 | One store write per switch | ✓ SATISFIED | `applyAquarelleMedium` |
| MED-11 | 64-02 | Never alters recorded strokes | ✓ SATISFIED | byte-identical test |
| MED-12 | 64-02 | Cross-machine replay via snapshot authority | ✓ SATISFIED | snapshot + determinism |
| MED-13 | 64-02 | Existing Studio UI; manual tweak keeps medium | ✓ SATISFIED | dropdown + tests |
| MED-14 | 64-03/23 | Half-float thickness via each dab's footprint; superposes | ✓ SATISFIED | target + blend law + traces |
| MED-15 | 64-04 | Lit emboss; emboss 0 / intensity 0 byte-identical | ✓ SATISFIED | algebra + identity probes |
| MED-16 | 64-03 | Emboss canonical param; no transport asset | ✓ SATISFIED | params bag |
| MED-17 | 64-05/07/09/18/19/27 | Document light; every render path; persisted; cache fingerprint; one gesture one entry; refused relight parks | ✓ SATISFIED (declared deferral: `bakeAquarelleScript`; D3 human) | persistence/parser/revision/live/reveal/Apply; parked scheduler |
| MED-18 | 64-03/04 | Snapshot + undo protection; export on every `uMode`; no zoom shimmer | ✗ BLOCKED | export/screen parity only partly demonstrated (probe matrix red); undo remains behavior-unverified |
| MED-19 | 64-02/06/20 | Body global, canonical set, **row**, default 0; coverage coherence | ✗ BLOCKED | no Body row (quick 261121-mtu); Body 100/60 probe bars red |
| MED-20 | 64-06/20 | Body 0 no cover; baseline identity | ✓ SATISFIED | guards + three identity probes |
| MED-21 | 64-06/20/22 | Erode settled pigment under own tip before deposit; partial at edges; scaled by Body | ✗ BLOCKED | non-bristle path holds; the bristle path is Body-independent (body 0/100 captures identical); UAT 12 reports Body as transparency |
| MED-22 | 64-06/15/25 | Cover touches settled+thickness only; destructive to settled; undo consistent | ✓ SATISFIED (structural; UAT 2 pending) | `coverPass` fixed+relief; CR-04 fixed in the commit path |
| MED-23 | 64-06/24/26/28 | Body snapshot; live/bake/replay same raster; medium values | ✓ SATISFIED (values amended: Chalk body 0) | snapshot tests; mediums; last-touch laws |
| MED-24 | 64-06/22 | Undo/redo restore both eroded pools, protected before first draw | ✓ SATISFIED (structural; UAT 2) | dual protection + pairing |
| MED-25 | 64-06/13/17/25 | Body adds no new target/texture/program beyond the thickness channel; export on both `uMode` paths | ✗ BLOCKED | written "no new target" clause predates the amended coverage/bristle delivery law; export parity gates red |
| MED-26 | 64-11 | Compile-time group; absent=watercolor; no persistence | ✓ SATISFIED | `brushes.ts` |
| MED-27 | 64-11 | Five sections fixed order; no filter/search | ✓ SATISFIED | `brushSections` |
| MED-28 | 64-12 | Group→medium one write only on change | ✓ SATISFIED | `pickAquarelleBrush` |
| MED-29 | 64-11 | 15 classified (11/4) | ✓ SATISFIED | table + git diff |
| MED-30 | 64-11 | Eight new responses; no rename/remove | ✓ SATISFIED | 23 ids pinned |
| MED-31 | 64-11/22 | Texture axis unchanged and orthogonal | ✓ SATISFIED | strip + tests |
| MED-32 | 64-08/24 | S on `inkB.a`/`fixedB.a`; no new target/pass | ✗ BLOCKED | S rides B.a (holds), but the 261119-pod 2×RGBA16F document-sized smear pair exists beyond D-29 |
| MED-33 | 64-08 | Body derives S; advection transports; settle carries | ✓ SATISFIED | deposit sites + settleFS |
| MED-34 | 64-10 | KM layer-over-background; broadband scalar | ✓ SATISFIED | generator + kmBand |
| MED-35 | 64-10 | S=0 bit-identical; stable small-arg branch | ✓ SATISFIED | legacy branch + identity |
| MED-36 | 64-10 | Scattering and order compose | ✓ SATISFIED (automated watercolor law; acrylic Body complaint tracked at UAT 12) | shared curve + coverage tests |
| MED-37 | 64-08 | White-gouache retired | ✓ SATISFIED | retirement audits |
| MED-38 | 64-10/14/15/24/25/26/28 | Replay determinism for S; export on every `uMode` | ✗ BLOCKED | determinism holds; export/screen parity not demonstrated (probe matrix red) |

Note: REQUIREMENTS.md's checkboxes mark MED-05/17/22/23/25/38 as done, and its traceability table (last updated 2026-11-15) still says "Gaps Found" for most rows. Neither reflects this verification: MED-25 and MED-38 are BLOCKED on evidence above.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `compare.mjs` | scenario invariants | Invariants read coverage through a darkness-only alpha | 🛑 Blocker (carried gap) | The acceptance contract no longer measures its claim |
| `run.mjs` | 60 | Prose says the mode-4 export alpha is `max(1 − min(rgb), cover)` | ⚠️ Warning | Stale contract prose; belongs to the same probe-matrix gap |
| `aquarelleParamVisibility.ts` | 29, 90 | Body row removed; Emboss max 15 | ⚠️ Warning (requirement conflict) | MED-19 / 64-04 truth 5 |
| `Engine.ts` | 782 | Document-sized 2×RGBA16F `smearCanvas` | ⚠️ Warning (delivery-law amendment) | Contradicts MED-32 as written |
| `64-27-SUMMARY.md` | key-decisions | Describes the Studio gate as a passive `useEffect` | ℹ️ Info | `95220123f` moved it to `useLayoutEffect` (WR-01); the summary text is stale, the code is correct |
| Changed phase files (9 implementation files) | — | `TBD` / `FIXME` / `XXX` debt markers | None | 0 hits (fresh scan) |
| Gap-plan surfaces | — | Empty implementations / hardcoded empty rendered data | None | Dynamic values trace to store/document/engine |
| `Engine.ts` (former 3553-3560) | — | False "outside-rect texels keep their age" docstring | Fixed | 64-26 replaced it with the carry law |
| `physicsPaintRotoAlphaMerge.ts` (former 112-115) | — | False "coverage is an opaque raster" comment | Fixed | 64-25 states the two-raster law |
| `shaders.ts` (former uAmount) | — | Dead uniform declared/uploaded | Fixed | 64-26 deleted it and recorded the supersession |

## Review Findings Assessed

`64-REVIEW.md` + `64-REVIEW-DISPOSITION.md` record 15 findings; the disposition is `fixed` for 13 and `open` for 2.

| Finding | Bearing after this verification |
| --- | --- |
| CR-01, CR-02, CR-03, CR-04, WR-03, WR-04, IN-04, IN-05, IN-07 | Fixed in source and substantively tested (64-25..64-28); verified above |
| WR-01, WR-02, IN-01, IN-03 | Fixed in `95220123f`; verified (layout-effect gate, source-dimension guard, 256 KiB docstring, travel invalidation) |
| IN-02 — `rememberSheet` can park a sheet `restoreCachedSheet` can never take (empty event list) | **Present (still true):** `adoptSheet`/frame-leave call `rememberSheet` when `events` is truthy, while `restoreCachedSheet` refuses `events.length === 0`. **Does not undermine a must-have**: at most one of three cache slots is briefly wasted in a transient scene, the entry expires by the cache bound, and the key still opens blank over its cached image exactly as the cache law states. Open Info/cleanup, not a gap. |
| IN-06 — dead seed path (`seedAquarelleEngine`, `yieldToHostMs`) | **Not a must-have gap:** `seedAquarelleEngine` is package public API with no in-repo consumer (the app contract test pins its absence from the app), and `yieldToHostMs` is live inside the package bake (`aquarelleBake.ts:503`). It is dead surface to retire, not a violation of any phase must-have. Open Info/cleanup. |

## Human Verification Required

The human sink is `64-UAT.md` (`status: testing`, updated 2026-11-18T19:08:56Z): **10 pending rows + 4 FAILED rows**. The 4 failed rows are evidence, not awaiting input:

| UAT row | Result | Defect |
| --- | --- | --- |
| 11 — Acrylic Bristle Round/Flat, Feather 100 and Pickup 100 | **failed** | No perceptible change between low and 100%; strokes read as flat soft bars (GAP-2) |
| 12 — Body as a mixer with the background | **failed** | Body behaves as transparency; hard rim; pale halo (GAP-1) — numerically corroborated by the digest-identical Body 0/100 bristle captures |
| 13 — Edge anti-aliasing and acrylic water | **failed** | Uniform soft/hard edges with aliasing; no water; no wet-gated edge mixing (GAP-3) |
| 14 — Texture tip vs default bristle tip | **failed** | Texture tip bypasses the bristle engine (`isBristleResponse()` excludes any `textureId`); result reads closer to the reference than the new path (GAP-4) |

The 10 pending rows (1-10) remain the live visual checks for viscosity, undo/redo, reopen/replay, Paper & Light, bakes, shimmer, mediums, Body/scattering, export parity and library layout — listed in the frontmatter of this report. The three behavior-unverified backstop truths (thickness undo/redo, reopen-and-replay relief, zoom/pan shimmer) are part of rows 2, 3 and 6. The 64-27 D3 visible re-light across a real playback session is carried as an additional human item.

## Gaps Summary

The four re-review plans did exactly what they claimed: CR-04 (coverage read through a white fill), CR-03 (last-touch rollback outside the dab), WR-03 (time-base resets), WR-04 (dropped relight during playback/draft/wireframe), IN-04 (dead uniform), IN-05 (under-specified sheet signature) and IN-07 (decorative pickup floor) are all fixed in source with gates that reproduce the old defect and prove the new law. The review-fix commit (`95220123f`) closes WR-01, WR-02, IN-01 and IN-03. The neutral identity still holds byte-for-byte and no previously verified truth regressed.

The phase goal is still not achieved, for four independent reasons:

1. **The visible contract is unmet.** Body has no row (MED-19), Body is inert on the bristle path (Body 0 vs 100 captures are digest-identical), Emboss is capped at 15 against a 0..100 truth, and the artist's UAT has recorded four failed acrylic rows and called the phase "NOT complete".
2. **The acceptance matrix is red.** 12 of 15 committed probe gates fail on this run: the coverage-alpha invariants measure an alpha the pigment export no longer carries, the Body-100/60 crossing bars fail, and the bristle gates plus the edge census fail on their own digests and their own relation invariant. Re-baselining was explicitly out of scope for 64-25..64-28, so this round did not touch it.
3. **Several plan truths describe a law that no longer ships.** The row law (64-22 truth 4), the ten-key medium set (64-02 truth 3), and the `isFullyOpaqueRaster` seam guard (64-15 truth 3) need either restoration or an explicit text amendment — the coverage/composite and acrylic-dab amendments superseded them silently.
4. **UAT is incomplete.** 10 rows pending, 4 failed.

Secondary, still-real conflicts: MED-25/MED-32's written "no new target" clauses predate the amended coverage/bristle delivery law (the last-touch pair and the 2×RGBA16F smear pair exist), and `compare.mjs`/`run.mjs` still describe the pre-amendment alpha law.

What would close the phase: restore (or formally amend) the Body row and the Emboss range, make Body actually modulate the bristle path, re-author the probe baselines and invariants against the shipped OPAQUE TRANSMITTANCE / darkness-only display law, reconcile the superseded plan truths, and run the 14 UAT rows.

---

_Verified: 2026-11-22T16:53:13Z_
_Verifier: Claude (gsd-verifier)_
