---
phase: quick-260925-dso
verified: 2026-09-25T10:18:51Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - .planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-PLAN.md
  - .planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-RED-EVIDENCE.json
  - .planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-SUMMARY.md
  - packages/efx-physic-paint/src/brush/erase.ts
  - packages/efx-physic-paint/src/brush/paint.continuation.test.ts
  - packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts
  - packages/efx-physic-paint/src/brush/paint.ts
  - packages/efx-physic-paint/src/core/paper.ts
  - packages/efx-physic-paint/src/core/paperConditioning.test.ts
  - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts
  - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.paperHeight.test.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
covered_digest: "v1:sha256:29c45e56365780c3ecedf4798e427fd75e3c0e508b803d7f66bdce5e04da8391"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Native UAT row 1 — clean silhouette: render a stroke, compare edge silhouette side by side against a pre-fix build"
    expected: "Stroke edges clean — no ragged noise-carved edge"
    why_human: "Visual quality judgment on baked pixels; no automated check can grade silhouette appearance"
  - test: "Native UAT row 2 — grain-off flat: fresh layer / no paper (paperGrain: ''), settle a stroke"
    expected: "Settled stroke body shows no per-pixel deposit noise (flat physics height, constant 0.5)"
    why_human: "Settled visual appearance in the live app"
  - test: "Native UAT row 3 — paper tooth: select a paper, settle a stroke"
    expected: "Noticeable tooth/granulation (wet edges + adsorption valleys) WITHOUT pixel jitter — detail-normalized height"
    why_human: "Visual texture quality judgment"
  - test: "Native UAT row 4 — opacity unchanged: stroke body opacity vs before"
    expected: "Unchanged (PIN 0 law, no wash-out)"
    why_human: "Visual comparison against a pre-fix build"
  - test: "Native UAT row 5 — footprint parity: settled footprint vs preview ribbon (260925-b7c law)"
    expected: "Footprint matches preview; if raggedness remains, note it — the bristle paper-height skip is a known residual until 9b"
    why_human: "Visual parity check; known residual must be distinguished from regression"
  - test: "Native UAT row 6 — determinism: two identical held-pose strokes"
    expected: "Byte-identical result, no boil"
    why_human: "Live rendering behavior in the packaged app (vitest cannot see WKWebView render output)"
  - test: "Native UAT row 7 — Normal mode unchanged; informational: Grain-strength control visible but visually inert until 9b; paper tooth in paint body deferred to 9b"
    expected: "Normal mode looks as before; inert control is expected interim state, do not grade"
    why_human: "Visual regression check plus expected-interim confirmation"
  - test: "CR-01 escalation (review critical, PRE-EXISTING, not introduced by this quick): save a document with grain off (paperGrain: ''), reload it"
    expected: "grain stays off (paperHeight null) — currently EfxPaintEngine.ts:2920 `if (settings.paperGrain)` skips the empty string, so a fresh engine keeps its default paper across the round-trip"
    why_human: "Developer decision required: fix now (one line: `settings.paperGrain != null`, plus a round-trip pin) vs defer to 9b. Guard confirmed pre-existing at base commit 03cb0d37 line 2927; no regression from this quick; Studio main window partially masks it via applyBackgroundFallbackToEngine. Not a must-have failure (all setPaperGrain('') behavior is pinned and green), but review classified it 'must fix before ship'."
---

# Phase quick-260925-dso: Kill bake-time visual grain, condition physics height field — Verification Report

**Phase Goal:** Kill the bake-time visual grain and condition the physics height field. Remove bake-time visual modulation (fillPolyGrain grain alpha + applyPaperEmboss) from stroke raster. Condition physics height field: flat (null/0.5) when no paper or texture load failure, detail-normalized (mean-centre 0.5, clamp ±0.40) when paper selected.

**Verified:** 2026-09-25T10:18:51Z
**Status:** human_needed (automated checks all green; 7 native UAT rows + 1 review escalation pending)
**Re-verification:** No — initial verification (no prior VERIFICATION.md)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Stroke raster runs zero grain/emboss pixel passes (pickup 0 AND 60) | ✓ VERIFIED | `paint.grainRemoval.test.ts` green (3 tests) — behavioral: real `renderPaintStroke` run with observer; controls `paint-raster-geometry`/`paint-raster-layers` collected; zero `paint-grain-*`/`paint-emboss-*`/`paint-raster-paper-emboss` stages; no `put` in op log; source-shape leg passes. Repo-wide grep: `fillPolyGrain`/`applyPaperEmboss` absent from all of `packages/efx-physic-paint/src` production code. All three layer loops in paint.ts now call `fillFlat` on every layer (lines 371/411/471). Visual half (baked silhouette raggedness) = native UAT row 1 |
| 2 | Grain-off and failed textures are flat; no procedural fbm height-map generator | ✓ VERIFIED | `EfxPaintEngine.paperHeight.test.ts` green (4 tests) — behavioral: real `setPaperGrain('')` and `setPaperGrain('texture-load-failed-key')` both leave `paperHeight === null`; map-hit control returns the exact shared reference. `ensureHeightMap` deleted from paper.ts; engine import dropped (diff 03cb0d37..HEAD); no `fbm` height-map use in any production source (`util/noise.ts` exports an unused `fbm` noise util — no production importer, dead-code info only). See human-verification item 8 for the pre-existing load round-trip gap (CR-01) |
| 3 | Loaded paper height detail-normalized (mean 0.5, band [0.10, 0.90]) and piped through conditionHeightMap at load | ✓ VERIFIED | `paperConditioning.test.ts` green (6 tests): export present, mean 0.5 (a), clamp [0.10, 0.90] (b), rank-monotone (c), idempotent on symmetric input (d), source-shape (e). Wiring confirmed: paper.ts:53 `const heightMap = conditionHeightMap(raw)` directly after red-channel extraction; tex.heightMap/paperHeight/physicsHeightMap share the one reference (engine 1060-1062) |
| 4 | Physics simulation untouched (wet-layer/compositor/fluids/drying byte-identical; DEPOSIT_KEEP_TIER=70) | ✓ VERIFIED | `git diff --name-only 03cb0d37..HEAD` lists only the 10 expected src files + RED-EVIDENCE.json — zero hits for wet-layer.ts, compositor.ts, fluids.ts, drying.ts, types.ts, stroke.ts, canvas.ts, app/, package.json, pnpm-lock.yaml. `DEPOSIT_KEEP_TIER = 70` confirmed at wet-layer.ts:417 |
| 5 | Format and UI compatibility kept (embossStrength 0.45/8, setEmbossStrength, SETTINGS_KEYS, validator, documentFormat round-trip, app control untouched) | ✓ VERIFIED | `EfxPaintEngine.documentFormat.test.ts` green (3 tests). Defaults at engine 592-593, SETTINGS_KEYS at 228, validator at 264-265, `setEmbossStrength` at 1066, serialize/load at 2892/2921 all present; no app/ files in the diff (TopBar/Settings control untouched) |
| 6 | Harness parity: pyp/stb free of grain replication, law gates hold | ✓ VERIFIED | `productionAaSettleMeasurement.test.ts` 7/7 + `physicsWidthScaling.test.ts` 7/7 + `physicsSettledFootprint.test.ts` green (18 passed \| 3 skipped). Zero `GRAIN`/`grainFn` left in either harness. Live output: 0 STOP findings, envelope PASS (6–8 ≤ 8), PIN 0 body ratio 1.0000 everywhere, PIN 0b meanDisplay 255.00, W5 determinism byte-identical. Bottom-side sanity 3→2 is the plan-authorized case (b) recalibration with before/after numbers recorded — no law gate weakened |

**Score:** 6/6 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts` | Pin 1, RED at base then GREEN | ✓ VERIFIED | 97 lines, substantive, green (3 tests); RED recorded in RED-EVIDENCE.json (failed at base on both pickup legs + source-shape) |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.paperHeight.test.ts` | Pin 2, RED at base then GREEN | ✓ VERIFIED | 63 lines, 4 tests green; RED: `expected Float32Array[...] to be null` recorded |
| `packages/efx-physic-paint/src/core/paperConditioning.test.ts` | Pin 3, RED at base then GREEN | ✓ VERIFIED | 69 lines, 6 tests green; RED: `expected 'undefined' to be 'function'` recorded |
| `packages/efx-physic-paint/src/core/paper.ts` | conditionHeightMap wired into loadPaperTexture; procedural generator deleted | ✓ VERIFIED | Export at :71, call at :53, `ensureHeightMap` gone |
| `packages/efx-physic-paint/src/brush/paint.ts` | Grain fill + emboss applier deleted; flat fill every layer | ✓ VERIFIED | No identifiers remain; three loops `fillFlat`-only; emboss params dropped from all four signatures |
| `.planning/quick/.../260925-dso-SUMMARY.md` | status automated-ready + native UAT rows | ✓ VERIFIED | 7 UAT rows present; narrative status "Automated-ready — 7 native UAT rows pending"; frontmatter `status: complete` matches the 260925-b7c precedent; no done claim |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | --- | --- |
| loadPaperTexture | conditionHeightMap → tex.heightMap → setPaperGrain → paperHeight | red-channel extraction piped through conditioner; `?? null` lookup | ✓ WIRED | paper.ts:53 → engine:1060-1062; one shared conditioned reference |
| three raster layer loops | flat fill every layer → transferToWetLayerClipped | `fillFlat(oc, v, color/segHex, lAlpha)` then wet transfer | ✓ WIRED | paint.ts:371/411/471 + transfer calls; wet-transfer inputs changed, simulation math not |
| engine raster/erase call sites | shrunk paint.ts/erase.ts signatures | emboss args dropped on both sides; tsc completeness net | ✓ WIRED | `npm run check` (tsc --noEmit) clean; diff shows arg removal at engine 2204/2480/2558 sites |
| pyp/stb harness raster model | production raster | in-harness grain replication removed in parity commit 6200eadd | ✓ WIRED | Both harnesses green with 0 STOP findings after removal |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| conditioned heightMap | `raw[i] = pd[i*4]/255` → `conditionHeightMap(raw)` | real decoded paper texture ImageData | Yes — real photo red channel, conditioned once at load | ✓ FLOWING |
| paperHeight in raster/deposit | `tex?.heightMap ?? null` from `paperTextures` map populated by loadPaperTexture | real texture load (reject → null) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 3 pins + continuation + documentFormat | `vitest run <5 files>` | 19 passed (19), 5 files | ✓ PASS |
| Harnesses + law gates (pyp/stb/footprint) | `vitest run productionAaSettleMeasurement physicsWidthScaling physicsSettledFootprint` | 18 passed \| 3 skipped, 0 STOP findings | ✓ PASS |
| Full package suite (single run) | `vitest run` (package) | 1 failed \| 20 passed (21 files); 173 passed \| 3 skipped | ✓ PASS (matches base) |
| Sole failure pre-existence | same test at base commit 03cb0d37 in temp worktree | `EfxPaintEngine liveAlphaCache boundary > preserves displayed wet alpha...` fails identically at base | ✓ PASS (pre-existing, ledger 74) |
| tsc | `npm run check` | clean, exit 0 | ✓ PASS |

### Probe Execution

No probes declared for this quick — Step 7c SKIPPED (no probe scripts; verification is via the three pin files and harness batteries, all executed in this verification).

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| QUICK-260925-DSO | 260925-dso-PLAN.md frontmatter | ✓ SATISFIED | Not present in `.planning/REQUIREMENTS.md` (quicks are ad-hoc; no orphaned requirement IDs mapped to this quick) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `brush/paint.ts` | 11 | Unused `sampleH` import left by the deletion (review IN-01) | ⚠️ Warning | Dead import; no behavior impact; fold into 9b signature cleanup |
| `brush/erase.ts` | 36 | Dead `paperHeight` positional param kept (review IN-02) | ⚠️ Warning | Call sites must still supply it; deferred to 9b by review |
| `core/paper.ts` | 69 | Doc claims "Idempotent on its own output" — false when clamping engages (review WR-01) | ⚠️ Warning | Doc/test-claim overreach; conditioning runs once at load so no live bug; fix comment + add clamping-input test in 9b |
| `engine/EfxPaintEngine.ts` | 1066 | `setEmbossStrength` still does requestRender + flush for zero-consumer state (review WR-02) | ⚠️ Warning | Render churn on an inert control; covered by the 9b deferral of the Grain-strength control, but side-effect not |
| `engine/EfxPaintEngine.ts` | 377-378 | Write-only `texHeight`/`physicsHeightMap` fields (review IN-03) | ℹ️ Info | Dead state pinned by pin-2 control; keep-or-drop decision at 9b |
| `paint.grainRemoval.test.ts` | 59 | Stale comment "emboss branch is live at base" (review IN-04) | ℹ️ Info | Comment-only; misleading for future readers |
| Debt markers (TBD/FIXME/XXX/TODO/HACK) | — | None in any file modified by this quick | ✓ CLEAN | — |

**Debt marker gate:** clear — no unreferenced TBD/FIXME/XXX in phase files.

### Human Verification Required

See `human_verification` frontmatter — 8 items: the 7 native UAT rows from the SUMMARY (visual/live behavior vitest cannot grade; no done claim before native UAT per plan) plus the CR-01 escalation decision.

### Gaps Summary

No gaps. All 6 must-have truths verified against actual code with passing behavioral tests; all 6 artifacts exist, substantive, and wired; all 4 key links confirmed; diff guardrail empty on every locked surface; full package suite matches base (the single failure proven pre-existing at base commit via a temp worktree); tsc clean.

Outstanding before closure: the 7 native UAT rows (user's live check) and the CR-01 decision — review's critical finding that `loadProjectData`'s truthy guard (`if (settings.paperGrain)`, EfxPaintEngine.ts:2920) drops the grain-off `''` encoding on document reload. Verified pre-existing (identical guard at base 03cb0d37:2927), asymmetric with the adjacent `embossStrength != null` guard, not covered by any must-have wording (all `setPaperGrain('')` behavior is pinned and green), and partially masked by the Studio re-apply path — escalated to the developer as human-verification item 8 rather than treated as a phase gap.

---

_Verified: 2026-09-25T10:18:51Z_
_Verifier: Claude (gsd-verifier)_
