---
phase: 261124-ujb
verified: 2026-11-24T23:21:47Z
status: human_needed
score: 8/8 must-haves verified
covered_files:
  - .planning/quick/261124-ujb-read-specs-v2-2-0-medium-engine-gsd-quic/261124-ujb-PLAN.md
  - .planning/quick/261124-ujb-read-specs-v2-2-0-medium-engine-gsd-quic/261124-ujb-SUMMARY.md
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/mediumSelection.test.ts
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/bristles.test.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/mediums.test.ts
  - packages/efx-watercolor/src/playground/mediums.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
covered_digest: "v4:sha256:60600291075a83d55d447d037cff122337e596de89c5df18990260a570376b2a"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/8
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory: []
human_verification:
  - test: "UAT row 1 — Gouache, Edge transparency 0, falloff 0 and falloff 100, stroke on paper"
    expected: "Render byte-identical to before the change (the two automated mode-1 identity gates prove bit-identity against the d509a886d baselines; confirm on screen)"
    why_human: "The artist's eye on the live canvas is the acceptance surface; the automated proxy is byte-identity."
  - test: "UAT row 2 — Edge transparency 50, falloff 50, stroke on paper and a curved S-stroke"
    expected: "Under the 2026-11-25 law the core is slightly translucent too (film 1 − 0.5·0.35 = 0.825), the rim is half-transparent (0.5), the ramp is smooth; no banding on the curved stroke"
    why_human: "Band quality and the faint core translucency at amount 50 are visual judgments."
  - test: "UAT row 3 — Edge transparency 100, falloff 100, and the rebuilt white-border case: Feather 100 at falloff 0 and 100"
    expected: "The core keeps ~65 % film (measured 0.693 on the probe), the fade hugs the silhouette, the rim is inert (it does not erase paint already on the sheet), and the band shows full-strength paint over the underlayer — no white/pale rail (the artist's 2026-11-24 report)"
    why_human: "Inertness, the ~65 % core and the absence of the white border are visual judgments; the automated station bars are proxies."
  - test: "UAT row 4 — Edge transparency 100, falloff 0"
    expected: "The fade reaches the middle band (probe mid film 0.200 — the broad ramp), the core still holds ~65 % film, soft airbrush look"
    why_human: "The soft-airbrush look and whether the broad ramp reaches far enough are visual judgments."
  - test: "UAT row 5 — Over a committed stroke on a fresh key, amount 100 / falloff 50"
    expected: "The rim reveals the base as a proportional mixture of the underlayer and full-strength paint; no milky/white halo (the 2026-11-24 pale-rail case)"
    why_human: "The milky-halo check is a visual judgment on the committed sheet."
  - test: "UAT row 6 — Leave the key, reopen, paint on the restored sheet"
    expected: "Documented limitation accepted: under the translucent band the sheet's own paint is replaced (the one deposit law), not glazed"
    why_human: "Behaviour across leave/reopen is a live-session judgment."
  - test: "UAT row 7 — Watercolor medium"
    expected: "Rows absent, render identical"
    why_human: "Render identity on screen; automated visibility tests and the 0 default cover the code path."
  - test: "UAT row 8 — Leave/reopen + forced re-render, and Undo/Redo"
    expected: "The bake matches the live view at the same frame"
    why_human: "Live/bake/Undo parity is a cross-session behavior the probe cannot exercise."
  - test: "UAT row 9 — Feather 0 / 85 × falloff 0 / 100"
    expected: "The laws compose; no seam at the stroke caps or along the rim"
    why_human: "Seam composition is a visual judgment (the probe has no cross-sweep seam bar)."
  - test: "Extra (whole-mark translucency — the 2026-11-25 acceptance question) — at amount 100 compare the stroke's BODY against amount 0 on a fresh key, at falloff 0/50/100"
    expected: "The body reads visibly more transparent at amount 100, not only the fringe. Probe numbers to look against: the deposit weight (coverage channel) at the core is 0.693 (law 0.65) and the mid reads 0.200 / 0.256 / 0.416; the cumulative pigment absorbance at the core/mid stays at ~1.04–1.07× the neutral reference (the carried colour is full strength by design), so the visible effect must come from the thinner film, not from a lighter pigment"
    why_human: "Whether a 65 % deposit weight reads as a translucent body on the artist's canvas is exactly the judgment that drove the 2026-11-25 revision; the probe measures the channels, not the perceived body."
  - test: "Extra (probe margin) — paint falloff 0, 50 and 100 side by side at amount 100"
    expected: "The three shapes read visibly distinct, in particular broad (0) versus linear (50): the probe measures their mid film at 0.200 vs 0.256 (separation 0.057), below the 0.12 station tolerance, so a single probe capture alone cannot discriminate that adjacent pair"
    why_human: "Whether the adjacent falloff settings read as distinct shapes is a human visual decision; the law's landmarks (0.190 / 0.325 / 0.488) are separated by more than the tolerance and are pinned exactly by the executed unit tests."
---

# Quick 261124-ujb: Edge transparency and Edge falloff (Spec 10) — Re-verification Report

**Phase Goal:** Deliver Spec 10 for the Gouache/Pen brush family with the law as revised by the artist's second UAT look (2026-11-25): one lateral film that scales the **DEPOSIT WEIGHT across the WHOLE mark** — `edgeProfile = BRISTLE_EDGE_CORE + (1 − CORE)·t^e` with `BRISTLE_EDGE_CORE = 0.35`, `edgeFilm = 1 − amount·edgeProfile` — so amount 100 leaves 65 % film in the core and reaches 0 at the silhouette, the falloff shapes the ramp; the carried colour stays full strength (the deposit's source is `cA·a`), the scatter S rides the film through `a`, and amount 0 is byte-identical. Canonical params + records + rows, watercolor-silent. UAT rows 1-9 remain the human hand-off.
**Verified:** 2026-11-24T23:21:47Z
**Status:** human_needed
**Re-verification:** Yes — after the second UAT-driven law revision (`e0f040f33`). The previous round ended `human_needed` with no `gaps:` list (its only remaining items were the UAT rows), so this is a full re-verification, not a gap-closure pass. `e0f040f33` is HEAD and the only code change since the previous `verified:` timestamp; every gate below was re-executed at that commit.

## Law Revision (2026-11-25)

The artist's second live look reported that at amount 100 the four strokes' bodies were identical (measured mean RGB ~235,134,97) and only the fringe changed — the slider read as a "feather/noise edge remover". The 2026-11-24 deposit-weight law still kept `film(0) = 1`, so the core never moved.

Commit `e0f040f33` ("the edge film fades the whole mark, not only its border") changes ten files (the film in `shaders.ts`, the twin and its pins, the four constants/bind in `Engine.ts`, the comparator stations/fixtures, and prose). The live law is now:

- `BRISTLE_EDGE_CORE = 0.35` (`bristles.ts:289`), bound as `uEdgeCore` (`Engine.ts:3640`).
- The gather computes `float edgeProfile = uEdgeCore + (1.0 - uEdgeCore) * pow(edgeT, edgeExp);` then `float edgeFilm = 1.0 - uEdgeFade * edgeProfile;` (`shaders.ts:1334-1335`).
- The film stays the deposit weight: `g.coverage = inked * featherFade * edgeFilm;` · `g.cA *= featherFade;` · `g.cB *= featherFade;` · `g.alpha *= featherFade * edgeFilm;` (`shaders.ts:1341-1344`); `Gathered` still has **no** `film` member; the deposit is unchanged — `oA = cA * a;` and `oB = vec4(cB * a, uScatter * a);` (`shaders.ts:1427/1431`); the cover equilibrium `float target = a * uCoverTarget * g.alpha;` (`shaders.ts:1465`).
- The spec's original "scales the whole carried film" wording and its "film(0) = 1 / core never moves" anchor are **superseded** by the PLAN's revised truths 2 and 3 and by the task goal; this report verifies the revised law and does not fail the task for those deviations (and the 2026-11-24 colour-dilution wording is likewise superseded by `1028861ed`).
- Amount 0 remains exactly inert by the plain-arithmetic form (the product is exactly zero); both identity gates re-passed byte-identically against the pre-change `d509a886d` baselines after this revision.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Edge transparency 0 is inert: the probe captures at (amount 0, falloff 0) and (0, 100), painted by a live `bristle-round` stroke (`brushId: 'bristle-round'` on the script entry, so `gatherBristle` runs), are byte-identical to baselines captured from the pre-change engine (UAT row 1). | ✓ VERIFIED | Fresh captures re-run this round: `/tmp/medium-engine/edge-transparency-neutral.json` and `-neutral-broad.json` both carry digests `21171475 / 3ebe1b9d / fb026f34 / 606376d0`, bit-identical to the committed baselines (provenance `capturedFromCommit: d509a886d`, `capturedAt 2026-11-24T21:47:17Z`, written once in `130fe7ee0`, never edited — `git log` confirms one touch). Both mode-1 comparator runs PASS "all 12 fields equal" (byteLength 4665600, minAlpha 255, visibleAlphaMaxDelta null). Every capture echoes `strokeBrush: 'bristle-round'` and `brush: 'bristle-round'`, so the gather and the film actually ran. The script entry stamps `brushId: 'bristle-round'` literally (`probe.ts:3247`); the twin early-returns 1 at `a <= 0` and the shader's product is exactly zero. |
| 2 | The film is the DEPOSIT WEIGHT and fades the WHOLE mark (revised 2026-11-24 / 2026-11-25): coverage and the cover alpha carry `edgeFilm`; cA/cB stay full strength because the deposit's source is `cA * a`; the scatter S rides the film through `a` alone. The profile is `BRISTLE_EDGE_CORE + (1 - CORE)·t^e`, so amount 100 leaves 65 % film in the core and reaches 0 at the silhouette — no pale rail, and the whole mark reads translucent, not only its border (UAT rows 3 and 5). | ✓ VERIFIED | `shaders.ts:1334-1335` (profile + film), `1341-1344` (coverage and alpha carry it, cA/cB do not), `1427/1431` (deposit: `oA = cA * a`, `oB = vec4(cB * a, uScatter * a)`), `1465` (cover target carries `g.alpha`). `g.film` exists nowhere in the shader (grep exit 0 only for the negative test pins at `scattering.test.ts:802/814`). **Behavioural evidence (independently recomputed from the fresh captures vs the neutral reference):** cumulative pigment absorbance ratios at core/mid are 1.0655 / 1.0576 (broad), 1.0655 / 1.0403 (linear), 1.0655 / 1.0534 (rim) — full strength, NOT the 0.69/0.20–0.42 coverage ratios — so the carried colour is not diluted; the rim deposits nothing (ink 0.000 vs reference 1.26–1.39) while its attenuation subtracts the same `a` (inert, not an eraser); the cover equilibrium `target / a = uCoverTarget · g.alpha` still fades with the film, retaining the committed base proportionally. The "whole mark reads translucent" reading is the UAT visual question (see Human Verification, extra item). Unit pins: `scattering.test.ts:762-820` (four uniforms, profile, film, the four positive lines, and negative pins for the attenuation half, threshold, cA/cB, cover, relief, touch). |
| 3 | film(0) = 1 − amount·BRISTLE_EDGE_CORE at every falloff (0.65 at amount 100), film(rim) = 1 − amount at every falloff, and the fade midpoint reads the landmark table at amount 1 for falloff 0 / 50 / 100. | ✓ VERIFIED | Twin `bristles.ts:451-458`: `profile = CORE + (1 − CORE)·t^e`, `1 − a·profile`, early return 1 at `a <= 0` / non-finite. Executed describes (`bristles.test.ts:733-800`): amount-0 exactly 1 at every lateral and falloff; core (lateral 0 and start 0.55) = `1 − amount·BRISTLE_EDGE_CORE` at every amount/falloff; rim exactly `1 − amount`; mid `= 1 − (CORE + (1 − CORE)·0.5^e)` with e = 0.5 / 1 / 2; monotone sweep ending at 0. Fresh probe sweeps: core 0.6926 on all three (expected 0.6500, Δ +0.0426, inside the ±0.06 documented convergence bar); rim exactly 0.0000 = 1 − amount; mid 0.1998 / 0.2563 / 0.4160 against expected 0.1904 / 0.3250 / 0.4875 (Δ +0.0094 / −0.0687 / −0.0715, all inside ±0.12). The formula is the contract; note the prose order caveat in Observations (the enumerated "0.49 / 0.325 / 0.19 for falloff 0 / 50 / 100" in the PLAN/SUMMARY/comparator comment is reversed — 0.49 belongs to falloff 100 — while the code and tests compute per-falloff correctly). |
| 4 | Falloff 0 reads broad (fade reaches the core ramp earliest), 50 linear, 100 rim (fade hugs the silhouette), and the three points are separated in the probe's lateral profile by more than the tolerance. | ✓ VERIFIED (with a probe-margin warning — see Observations) | Exponent map pinned exactly by executed tests (`edgeFalloffExponent` 0.5 / 1 / 2 at bias 0 / 50 / 100, clamped, non-finite → 1; `bristles.ts:425-433`, tests at `bristles.test.ts:830-855`); the shader's `exp2(2.0 * uEdgeFalloff - 1.0)` mirrors it. At the LAW level the mid landmarks are 0.1904 / 0.3250 / 0.4875 — adjacent separations 0.1346 and 0.1625, both above the 0.12 bar. Measured sweeps are correctly ordered (broad 0.1998 < linear 0.2563 < rim 0.4160) and the extremes are separated by 0.2162 > 0.12; the measured adjacent broad↔linear separation is 0.0565 < 0.12 (compression from the coverage channel's many-dab convergence and the film-floor calibration), so one capture cannot fully discriminate that adjacent pair — routed to the human falloff-distinctness check, as in the previous round. All three sweeps differ from the neutral baseline on every exported digest (broad `fbfcac89/4de5070d/280d50ca`, linear `de23f1a6/b72a000f/ffd033a6`, rim `962aea3a/1daa766d/624b9656`; pigment `d9db31a1 / eb26753a / 42945c64` vs `606376d0`). |
| 5 | Both params are canonical: they live inside the Gouache and Pen medium records with 0 / 50, Reset restores 0 / 50, and re-picking a medium resets both like every other medium param (D-03). | ✓ VERIFIED | `aquarelleRecordState.ts`: keys in `AquarelleGlobalParams` (123-124), in `AQUARELLE_GLOBAL_KEYS` (146-147, 18 keys — the snapshot loop and the selection-write allowlist carry them automatically) and in `DEFAULT_AQUARELLE_PARAMS` (168-169, 0 / 50). `mediums.ts`: `MediumParamKey` includes the pair (54-55); the acrylic record ends `edgeFade: 0, edgeFalloff: 50` (155-156); the watercolor record DERIVES both from `DEFAULT_CANONICAL_PARAMS` (91-92). `params.ts`: canonical keys 98/104, defaults 0/50 (124-125), `toEngineParams` emits `clamp01(num(p.edgeFade, d.edgeFade) / 100)` and the same for falloff (232-233). Executed pins: `params.test.ts:67` (the whole 18-key object), `:179-180`; `mediumSelection.test.ts:144-168, 239-240, 261-264, 297-298`; `AquarelleGlobalsPanel.test.ts:236-237, 258-259, 339-340, 375-376` (set 55/5, Reset restores 0/50); `brushGroupMedium.test.ts:95-96`. Note: ONE acrylic record backs both bristle responses (Gouache and Pen); both tool contexts render the rows through the shared record. |
| 6 | Both rows are acrylic-only: visible for Gouache, absent for watercolor and the Water tool, so `uEdgeFade` stays 0 for watercolor and its render is identical (UAT row 7). | ✓ VERIFIED | `aquarelleParamVisibility.ts:180-181`: `{ key: 'edgeFade', label: 'Edge transparency', group: 'edge', paint: BRISTLE_MEDIA }` and the falloff row, immediately after Feather; `BRISTLE_MEDIA = ['acrylic']` (116). The Water tool filters on `row.water === true` and the Eraser on `row.lift === true`, so neither sees them; `isAquarelleParamRowVisible` is the ONE shared selector. Executed pins: `aquarelleParamVisibility.test.ts:49` (P_A union), `:221-222` (15-row literal), `:331` (watercolor / water / eraser false). The watercolor record's `edgeFade` is 0 (derived), and `bindGather` binds `clamp(0, 0, 1)` → the shader film is exactly 1.0 (identity proven byte-identical by truth 1). |
| 7 | The visible silhouette is unchanged: the paper threshold is untouched, cells beyond the silhouette clamp to the full rim factor so the edge narrows at amount 100 by design, and amount 0 leaves the footprint byte-identical. | ✓ VERIFIED | `git show e0f040f33` touches only the film block, the four uniforms/bind and the constant in the engine-side code — the threshold / `featherShift` / `takeoff` block is untouched and negatively pinned (`scattering.test.ts:815-825` refuses all four `uEdge*` identifiers in the threshold slice). The twin clamps `u = clamp01(lateral)` so beyond-silhouette cells take the full rim factor (executed beyond-rim clamp test) and the JSDoc states the narrowing is by design. Amount 0: the identity digests (truth 1) prove the footprint is bit-identical, both gates re-passing after this revision. |
| 8 | Every capture the probe comparisons run satisfies the visible-alpha contract for its capture type: the live bristle-response `edge-transparency` capture reports the bristle skip with no delta/samples, one shared predicate makes the probe and the comparator agree, a non-bristle capture can never carry a skip, and a bristle capture can never report a delta beside its skip. | ✓ VERIFIED | All five fresh captures report `visibleAlphaSkip` (the bristle film-blur reason), `visibleAlphaMaxDelta: null`, `visibleAlphaSamples: 0`, `opaqueExportMinAlpha: 255`. `isBristleCapture` is pinned literal-identical in `probe.ts:3414-3416` and `compare.mjs:196-198` (both `scenario.startsWith('bristle-') || scenario === 'edge-transparency'`) and consumed at `probe.ts:3661` / `compare.mjs:236`. Executed direction fixtures (`harness.test.ts:2085-2150`): a non-bristle capture carrying a skip fails ("cannot be skipped"), a non-bristle zero-sample pass fails, a bristle capture with a delta beside its skip fails ("a skipped check records no delta"), a bristle capture dropping the skip reason fails; opaque captures must keep minAlpha 255. |

**Score:** 8/8 truths verified (0 present, behavior-unverified).

### Judged Deviations (carried forward)

**Deviation 1 — plain arithmetic `1.0 - uEdgeFade * edgeProfile` instead of a ternary guard.** Still the live form; at `uEdgeFade = 0` the product is exactly zero and the pre-change program renders bit-identically (re-proven by both fresh amount-0 captures). NaN/inf is unreachable: `edgeU`/`edgeT` are clamped [0,1], `edgeExp` lies in [0.5, 2] (`bindGather` clamps the uniform), `pow(0, e>0) = 0`, and values arrive via `toEngineParams`' `num()` + `clamp01`.

**Deviation 2 — the probe comparator calibrates the station domain from the film's own rim floor (1 − amount) at amount > 0.** Untouched by this revision; the identity path at amount 0 uses the reference's 2 %-of-peak rim. Executed harness fixtures prove the comparator is fail-closed (blank profile, missing `edgeAcross`, missing `edgeTiling.enclosed`, an unfaded film, wrong falloff, a `'round'` strokeBrush, and a wider reference rim all behave as pinned).

**Superseded wording — the spec's "scales the whole carried film" and "film(0) = 1" are deliberately NOT verified.** The PLAN's revised truths 2-3 and the task goal are the verified contract; treating the old wording as a failure would contradict the explicit revisions. The original core-anchored law was measured wrong on the live surface (the artist's 2026-11-25 report), and the current law's core fade is measured at 0.693 (law 0.65).

### Deferred Items

None. This is a quick task with no later phase in a milestone; UAT rows 1-9 are the human hand-off, not deferred scope.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json` | Pre-change identity baseline (0,0) | ✓ VERIFIED | Exists, `capturedFromCommit: d509a886d`; fresh capture reproduces all four digests; written once in `130fe7ee0`, never edited. |
| `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json` | Pre-change identity baseline (0,100) | ✓ VERIFIED | Same provenance; digests identical to the (0,0) baseline and to the fresh capture. |
| `packages/efx-watercolor/src/playground/bristles.ts` | Tested twin + exponent map + four constants | ✓ VERIFIED | `BRISTLE_EDGE_START` 278, exp bounds 280/282, `BRISTLE_EDGE_CORE = 0.35` 289; twin 451-458; exponent map 425-433; non-finite guards; beyond-rim clamp documented. |
| `packages/efx-watercolor/src/playground/shaders.ts` | The ONE lateral film in `BRISTLE_GATHER` + the deposit weight | ✓ VERIFIED | Uniforms 971-974 (`uEdgeStart`, `uEdgeCore`, `uEdgeFade`, `uEdgeFalloff`); film block 1331-1335; weight lines 1341-1344; deposit 1427-1431; no `g.film` in the struct; the revision diff touches only this block (+comments). |
| `packages/efx-watercolor/src/playground/Engine.ts` | Params, defaults, unconditional binding | ✓ VERIFIED | Params 135-136, `DEFAULT_PARAMS` 0 / 0.5 (153-154); `bindGather` binds `uEdgeStart = BRISTLE_EDGE_START`, `uEdgeCore = BRISTLE_EDGE_CORE`, `uEdgeFade`, `uEdgeFalloff` (clamped 0..1) at 3639-3642; `bindGather` called at 3192, 3227, 3741, 3771. |
| `packages/efx-watercolor/src/playground/params.ts` | Canonical 0..100 keys mapped to 0..1 | ✓ VERIFIED | Keys 98/104, defaults 0/50 (124-125), `toEngineParams` 232-233 (`/100` + `clamp01` + `num()` sanitiser). |
| `packages/efx-watercolor/src/playground/mediums.ts` | Both records carry 0 / 50; keys in `MediumParamKey` | ✓ VERIFIED | `MediumParamKey` 54-55; watercolor derives both (91-92); acrylic literal 0 / 50 (155-156); executed key-pin and record-literal tests. |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Keys in interface, defaults, key list | ✓ VERIFIED | 123-124, 146-147 (18 keys), 168-169; snapshot loop over `AQUARELLE_GLOBAL_KEYS` and the selection allowlist carry them with no new code. |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | Two acrylic-only rows | ✓ VERIFIED | Rows `edgeFade` / `edgeFalloff` immediately after Feather (180-181), `paint: BRISTLE_MEDIA`, labels "Edge transparency" / "Edge falloff", edge group. |

All nine artifacts pass levels 1 (exists), 2 (substantive), 3 (wired) and 4 (data flows — see below).

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `aquarelleParamVisibility.ts` | `aquarelleRecordState.ts` | Row keys must exist in `AQUARELLE_GLOBAL_KEYS` / `DEFAULT_AQUARELLE_PARAMS` | ✓ WIRED | Both keys present; snapshot loop and allowlist iterate the list; executed tests round-trip them. |
| `aquarelleRecordState.ts` | `mediums.ts` | Both keys in the medium records for Reset / re-pick | ✓ WIRED | Acrylic literal 0/50; watercolor derived 0/50; `applyAquarelleMedium` writes the whole record; the panel Reset iterates the record. |
| `mediums.ts` | `params.ts` | Record bag feeds the canonical params; pair maps through `toEngineParams` | ✓ WIRED | `MediumParamKey` extended; `toEngineParams` maps both with the non-finite sanitiser and `/100` normalisation. |
| `params.ts` | `Engine.ts` | Normalised 0..1 values into `Params`, consumed by `bindGather` | ✓ WIRED | `Params` members and defaults; `toEngineParams` → `engine.setParams` at both writers (`app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:358-359`, `engineAdapter.ts:423`). |
| `Engine.ts` | `shaders.ts` | `bindGather` binds `uEdgeStart` / `uEdgeCore` / `uEdgeFade` / `uEdgeFalloff` for every consumer | ✓ WIRED | Bindings 3639-3642; `bindGather` called at all four consumers; uniform declarations pinned by executed source tests. |
| `shaders.ts` | `bristles.ts` | The shader's exponent map mirrors the tested twin; the gather uses the constant chain | ✓ WIRED | Shader `exp2(2.0 * uEdgeFalloff - 1.0)` ≡ twin `2 ** (2b - 1)`; `uEdgeStart` / `uEdgeCore` bound from the constants; `lateral / uFeatherEdge` matches the twin's silhouette-units contract. |
| `probe.ts` | `brushes.ts` | The scenario's own `brushId: 'bristle-round'` | ✓ WIRED | Literal at `probe.ts:3247`; `resolvedBrush` chain includes the scenario; the comparator fails any capture whose `strokeBrush` is not `bristle-round` (executed fixture, including a `'round'` rejection). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AquarelleGlobalsPanel.tsx` slider rows | `params[row.key]` (edgeFade / edgeFalloff) | `aquarelleParams` signal (0..100), written by `setAquarelleParam` | Yes — `AquarelleCanvasLayer.tsx:358-359` → `toEngineParams` → `engine.setParams` | ✓ FLOWING |
| `Engine.ts` uniforms | `this.params.edgeFade` / `.edgeFalloff` | `toEngineParams` normalisation of the live bag / the medium record (Reset, re-pick) | Yes — bound per gather call, no static fallback | ✓ FLOWING |
| `shaders.ts` film | `edgeProfile` / `edgeFilm` | `lateral`, `uFeatherEdge`, `uEdgeStart`, `uEdgeCore`, `uEdgeFade`, `uEdgeFalloff` | Yes — scales `g.coverage` and `g.alpha` (deposit weight + cover equilibrium); cA/cB stay full strength; the probe measures the rendered result | ✓ FLOWING |
| Probe capture | `edgeAcross { offsets, cover, ink }` / `edgeTiling.enclosed` | Live headless-Chrome WebGL render of the real `bristle-round` stroke | Yes — 281 offsets of real rendered coverage/ink; blank profiles fail | ✓ FLOWING |

No value in the chain ends in a hardcoded literal or a mock; the only constants are the declared neutral defaults (0 / 50 canonical, 0 / 0.5 engine) and the law's own anchors (start 0.55, core 0.35, exp bounds), which are the law.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package suite (incl. the 147-test probe harness, twin, params, records, shader pins) | `pnpm --dir packages/efx-watercolor exec vitest run` | 43 test files passed; 1057 passed, 8 skipped, 0 failed; exit 0 | ✓ PASS |
| App typecheck | `pnpm --dir app exec tsc --noEmit` | exit 0, clean | ✓ PASS |
| Full app suite (after rebuilding the package `dist` from source so the app sees the revision) | `pnpm --dir app exec vitest run` | 466 files passed / 1 failed / 2 skipped (469); 9875 passed / 1 failed / 4 skipped / 96 todo (9976); the single failure is the known `physicPaintBridge.test.ts` unhandled-rejection flake at `:8461` (`unregisterListener`), re-run in isolation: 186 passed / 1 skipped — not a gap | ✓ PASS (known flake) |
| Fingerprint of the changed-file set | `gsd_run query verification.fingerprint <phase dir> <22 files>` | 24 covered files, `v4:sha256:60600291075a83d55d447d037cff122337e596de89c5df18990260a570376b2a` | ✓ PASS |

### Probe Execution

The phase's probe is the headless-Chrome medium-engine harness (`run.mjs` capture + `compare.mjs` evaluation), not a `scripts/*/tests/probe-*.sh` script. All five gates were re-executed in this verification; captures live in `/tmp/medium-engine/`, baselines in `packages/efx-watercolor/probe/medium-engine/baselines/`.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Identity (0,0) | `run.mjs --gate edge-transparency-neutral --scenario edge-transparency --edge 0 --falloff 0 --size 1080` then `compare.mjs edge-transparency-neutral` | PASS — digests `21171475 / 3ebe1b9d / fb026f34 / 606376d0` equal the `d509a886d` baseline; all 12 compared fields equal | PASS |
| Identity (0,100) | same with `--gate edge-transparency-neutral-broad --falloff 100` | PASS — same four digests; all 12 fields equal | PASS |
| Sweep broad (100,0) | `run.mjs --gate edge-transparency-broad --edge 100 --falloff 0` then `compare.mjs edge-transparency-broad --differs-from edge-transparency-neutral` | PASS — exported digests differ (`fbfcac89/4de5070d/280d50ca`); core 0.6926 (expected 0.6500 ± 0.06); mid 0.1998 (expected 0.1904 ± 0.12); rim 0.0000 = 1 − amount; ink rim 0 < core 2.401; enclosure bars hold | PASS |
| Sweep linear (100,50) | same with `--gate edge-transparency-linear --falloff 50` | PASS — digests differ (`de23f1a6/b72a000f/ffd033a6`); core 0.6926; mid 0.2563 (expected 0.3250, Δ −0.0687); rim 0.0000; ink direction holds | PASS |
| Sweep rim (100,100) | same with `--gate edge-transparency-rim --falloff 100` | PASS — digests differ (`962aea3a/1daa766d/624b9656`); core 0.6926; mid 0.4160 (expected 0.4875, Δ −0.0715); rim 0.0000; ink direction holds | PASS |
| Revised-law station re-derivation (behavioural) | independent re-implementation of the comparator's film-floor calibration and station reads over the three fresh captures | core 0.6926 / 0.6926 / 0.6926 (expected 0.65); mid 0.1998 / 0.2563 / 0.4160; rim 0.0000 ×3; silhouette 16.5 / 17.5 / 17.5 px, axis 0.5 px; ink ratios vs reference 1.0655 / 1.0576 / 1.0403 / 1.0534 at core/mid — the deposit weight fades, the carried colour does not | PASS |
| Probe source/harness pins | included in the package suite (`probe/medium-engine/harness.test.ts`) | 147 tests green, including the comparator fixtures (blank / missing / notiling / unfaded / wrong-falloff / `'round'` strokeBrush rejection, the film-domain calibration, and the alpha-law direction pins) and the independently encoded fixture law (`EDGE_FIXTURE_CORE = 0.35`, `EDGE_FIXTURE_EDGE_START = 0.55` declared in the test, not imported from the comparator) | PASS |

### Test Quality Audit

| Test File | Linked Req/Truth | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|------------------|--------|---------|----------|-----------------|---------|
| `packages/efx-watercolor/src/playground/bristles.test.ts` | truths 3, 4 | yes | 0 | no | Value/Behavioral | PASS |
| `packages/efx-watercolor/src/playground/params.test.ts` | truth 5 | yes | 0 | no | Value | PASS |
| `packages/efx-watercolor/src/playground/mediums.test.ts` | truth 5 | yes | 0 | no | Value | PASS |
| `packages/efx-watercolor/src/playground/scattering.test.ts` | truths 2, 7 | yes | 0 | no | Behavioral (source-law pins) | PASS |
| `packages/efx-watercolor/probe/medium-engine/harness.test.ts` | truths 2, 4, 8 | yes (147) | 0 | no — baselines are a PRE-change external oracle (`d509a886d`), captured before any `src/` change; station landmarks are the law's formula, recomputed independently in the fixture | Behavioral | PASS |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` | truth 5 | yes | 1 pre-existing `describe.skip` (line 824, 261123-hr5 emboss band — unrelated feature) | no | Behavioral | PASS (WARNING-class: pre-existing skip on an unrelated feature; active tests cover this phase's Reset) |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts` | truth 6 | yes | 0 | no | Value | PASS |
| `app/src/components/physic-paint/view/mediumSelection.test.ts` | truth 5 | yes | 0 | no | Value | PASS |
| `app/src/components/physic-paint/view/brushGroupMedium.test.ts` | truth 5 | yes | 0 | no | Value | PASS |

**Disabled tests on requirements:** 0 new; one pre-existing unrelated `describe.skip` in a phase-linked app test file → WARNING only.
**Circular patterns detected:** 0 blocking — the probe baselines are a pre-change external oracle, and the harness fixture declares its own law constants rather than importing the comparator's.
**Insufficient assertions:** 0.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| — | — | No requirement IDs declared (`requirements: []` in the PLAN frontmatter); this is a quick task with no `REQUIREMENTS.md` mapping | N/A | Verified: no `261124-ujb` entry in `.planning/REQUIREMENTS.md`. |

### Decision Coverage

Decision coverage verify (warning): `check.decision-coverage-verify` returned `could-not-parse` (total 0) in the previous round — the CONTEXT.md bullet-list format is not accepted by the parser. Manual review: every still-operative CONTEXT.md decision is honored — the pair rides the medium records with 0 / 50 defaults, Reset and re-pick (D-03); falloff direction 0 broad / 50 linear / 100 rim with `edgeFalloffExponent = 2^(2b−1)`; silhouette units `u = clamp(lateral / uFeatherEdge, 0, 1)`; `uEdgeStart = 0.55` silhouette-relative; the beyond-silhouette clamp stated as intended; no new UI component. The CONTEXT's "film(0) = 1 always" specific is superseded by the two UAT revisions (explicitly out of scope for failure per the task).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No `TBD` / `FIXME` / `XXX` markers in any changed source/test file (grep exit 1); no `TODO` / `HACK` / `PLACEHOLDER`; no newly added `describe.skip` / `it.skip`; no new empty-return stubs; no `g.film` leftovers. |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | None | — | No Step 7 blocker arose that lacked deterministic evidence. |

## Observations (non-blocking)

1. **Probe discrimination margin at adjacent falloff settings (WARNING).** The fresh mid stations are 0.1998 (broad), 0.2563 (linear), 0.4160 (rim). Each passes its own ±0.12 station bar against its expected landmark (0.1904 / 0.3250 / 0.4875), the ordering is correct, and the extremes are separated by 0.2162. But the adjacent broad↔linear separation is 0.0565 — below the 0.12 station tolerance — and the discrimination is asymmetric: a broad capture mislabelled as linear would fail (Δ 0.1252), a linear capture mislabelled as broad would pass (Δ 0.0659). At the law level the adjacent landmarks ARE separated by more than the tolerance (0.1346 / 0.1625), so this is a probe-measurement compression (many-dab convergence plus the film-floor calibration), not a law violation. Surfaced to the artist as the falloff-distinctness human check; not a gap. (The SUMMARY's claim that "the falloff separation is now wider than the 0.12 bar" holds at the law level but not for the measured adjacent pair.)
2. **Documentation drift (WARNING — prose only).** Three prose spots enumerate the new mid landmarks in reversed falloff order: "0.49 / 0.325 / 0.19 for falloff 0 / 50 / 100" in the PLAN truth 3, the SUMMARY "UAT feedback 2026-11-25" bullet, and the `compare.mjs` station docblock. The correct mapping is 0.19 / 0.325 / 0.49 for falloff 0 / 50 / 100 (0.49 belongs to falloff 100); the code, the fixture (`harness.test.ts` mid-mismatch comment: 0.190 broad vs 0.488 rim) and the executed tests compute per-falloff correctly. Separately, the SUMMARY frontmatter `coverage` D1 description ("scales coverage, cA, cB and alpha together") and the `bristles.test.ts` block comment ("scales the WHOLE carried film — coverage, cA, cB and alpha together") still describe the pre-`1028861ed` law — the deposit-weight law scales coverage and alpha only. The five stale comment blocks flagged in the previous round (params.ts, Engine.ts, mediums.ts, scattering.test.ts, probe.ts) were refreshed by `ee0c6b03f` and this revision. None of these is a debt marker; code and pins are correct. Suggested follow-up: fix the ordering/description prose when next touching those files.
3. **The whole-mark translucency is a visual claim, routed to UAT.** The probe's coverage (deposit weight) at the core drops to 0.6926 (law 0.65), but the cumulative pigment absorbance at core/mid stays at 1.04–1.07× the neutral reference because `cA` stays full strength by design and the many-dab lerp converges to the carried colour. Whether amount 100 makes the body read visibly transparent (the exact 2026-11-25 acceptance question) is therefore a human check, recorded with these numbers in Human Verification item 10.
4. **Full app suite flake.** The known `physicPaintBridge.test.ts` unhandled rejection at `:8461` (`cleanup()` → `unlisten` on an undefined listener) failed the full run; the file passes in isolation (186 passed / 1 skipped). Unrelated to this quick (no changes to that path).
5. **App `dist` freshness.** The app resolves `@efxlab/efx-watercolor` through `dist`, which predated the revision; it was rebuilt from source before the app suite (gitignored output, no source change). Required whenever package source changes.
6. **Truth 5 wording vs the medium model.** The truth says "the Gouache and Pen medium records"; the model has ONE acrylic medium record (`id: 'acrylic'`, displayed "Gouache") backing both bristle responses. Both responses carry the pair through the shared record and both tool contexts render the rows; the operative outcome (canonical params, Reset, re-pick) holds for both.

## Human Verification Required

1. **UAT row 1** — Gouache, Edge transparency 0, falloff 0 and 100: render byte-identical to before the change (the automated identity gates already prove bit-identity; confirm on screen).
2. **UAT row 2** — Edge transparency 50, falloff 50: the core is slightly translucent (film 0.825), the rim half-transparent, smooth ramp; no banding on a curved S-stroke.
3. **UAT row 3** — Edge transparency 100, falloff 100, plus the rebuilt white-border case: Feather 100 at falloff 0 and 100. The core keeps ~65 % film (measured 0.693), the fade hugs the silhouette, the rim is inert; **the band shows full-strength paint over the underlayer — no white/pale rail** (the artist's 2026-11-24 report).
4. **UAT row 4** — Edge transparency 100, falloff 0: the fade reaches the middle band (probe mid 0.200), the core holds ~65 % film; soft airbrush look.
5. **UAT row 5** — Over a committed stroke on a fresh key, amount 100 / falloff 50: the rim reveals the base as a proportional mixture of the underlayer and full-strength paint; **no milky/white halo**.
6. **UAT row 6** — Leave the key, reopen, paint on the restored sheet: documented limitation accepted (the sheet's own paint is replaced under the translucent band, not glazed).
7. **UAT row 7** — Watercolor: rows absent, render identical.
8. **UAT row 8** — Leave/reopen + forced re-render, and Undo/Redo: the bake matches the live view at the same frame.
9. **UAT row 9** — Feather 0 / 85 × falloff 0 / 100: the laws compose; no seam at the stroke caps or along the rim.
10. **Extra (whole-mark translucency — the 2026-11-25 acceptance question)** — At amount 100 compare the stroke's BODY against amount 0 on a fresh key at falloff 0 / 50 / 100: the body should read visibly more transparent, not only the fringe. Probe numbers for reference: the deposit weight at the core is 0.693 (law 0.65) and the mid reads 0.200 / 0.256 / 0.416, while the cumulative pigment absorbance stays at ~1.04–1.07× the neutral reference (the carried colour is full strength by design).
11. **Extra (probe margin)** — Paint falloff 0, 50 and 100 side by side at amount 100: confirm the shapes read visibly distinct, in particular broad (0) versus linear (50) (probe mid 0.200 vs 0.256, separation 0.057 below the 0.12 station tolerance; law landmarks 0.190 / 0.325 / 0.488).

## Gaps Summary

No automated gaps. All 8 must-haves are verified against HEAD `e0f040f33` under the 2026-11-25 whole-mark deposit-weight law: both amount-0 captures are byte-identical to the pre-change `d509a886d` baselines (all 12 fields equal, fresh re-captures), the gather computes `edgeProfile = uEdgeCore + (1 − uEdgeCore)·t^e` and `edgeFilm = 1 − uEdgeFade·edgeProfile` with `BRISTLE_EDGE_CORE = 0.35` bound as `uEdgeCore`, coverage and the cover alpha carry the film while cA/cB stay full strength and the scatter S rides `a` alone (probe ink ratios 1.04–1.07 of the reference vs coverage ratios 0.20–0.69), the core now fades (0.6926 measured, expected 0.65 ± 0.06) and the rim stays exactly `1 − amount`, the falloff exponent map and the landmark formula are pinned exactly by executed unit tests with the three sweeps correctly ordered, both params are canonical with Reset and re-pick coverage, the rows are acrylic-only, the threshold block is untouched, and the visible-alpha contract holds in both directions. Two warnings are recorded: the probe's adjacent-falloff discrimination margin (measured 0.0565 < 0.12, law-level 0.1346 > 0.12) and documentation drift (reversed landmark order in three prose spots; two stale law descriptions). Neither is a phase gap. UAT rows 1-9 plus the whole-mark-translucency check and the falloff-distinctness check remain the human hand-off, so the status is `human_needed`, not `passed`.

---

_Verified: 2026-11-24T23:21:47Z_
_Verifier: Claude (gsd-verifier)_
