---
phase: 261124-ujb
verified: 2026-11-24T22:49:54Z
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
covered_digest: "v4:sha256:039926f2e60bc8d77d711c18d18a2ec7ffd7be551c4498c734dccad15b6a7579"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/8
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "UAT row 1 — Gouache, Edge transparency 0, falloff 0 and falloff 100, stroke on paper"
    expected: "Render byte-identical to before the change (the automated mode-1 identity gates already prove bit-identity; confirm on screen)"
    why_human: "The artist's eye on the live canvas is the acceptance surface; the automated proxy is the probe's byte-identity against the pre-change baselines."
  - test: "UAT row 2 — Edge transparency 50, falloff 50, stroke on paper and a curved S-stroke"
    expected: "Core unchanged, rim half-transparent, smooth ramp over the outer half; no banding on the curved stroke"
    why_human: "Band quality on a curved stroke is a visual judgment."
  - test: "UAT row 3 — Edge transparency 100, falloff 100, and the rebuilt white-border case: Feather 100 at falloff 0 and 100"
    expected: "The middle band stays ~75 % opaque and the fade hugs the silhouette; the rim is inert (it does not erase paint already on the sheet); the band shows full-strength paint over the underlayer — no white/pale rail (the artist's 2026-11-24 report)"
    why_human: "Inertness (no erase of same-sheet paint), the ~75 % middle and the absence of the white border are visual judgments; the automated ink-direction/ink-ratio and rim-floor bars are proxies."
  - test: "UAT row 4 — Edge transparency 100, falloff 0"
    expected: "The transparency reaches the middle band (~29 % film there); soft airbrush look; the centreline stays full"
    why_human: "The soft-airbrush look is a visual judgment."
  - test: "UAT row 5 — Over a committed stroke on a fresh key, amount 100 / falloff 50"
    expected: "The rim reveals the base as a proportional mixture of the underlayer and full-strength paint; no milky/white halo (the UAT-reported pale rail is gone)"
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
    why_human: "Seam composition is a visual judgment."
  - test: "Extra (probe margin) — paint falloff 0, 50 and 100 side by side at amount 100"
    expected: "The three shapes read visibly distinct, in particular broad (0) versus linear (50): the probe measures their mid-station film at 0.320 vs 0.394 (separation 0.074), below the 0.12 station tolerance, so a single probe capture alone cannot discriminate the adjacent pair"
    why_human: "Whether the adjacent falloff settings read as distinct shapes is exactly a human visual decision; the law's expected landmarks (0.293 / 0.5 / 0.75) are separated by more than the tolerance and are pinned exactly by the executed unit tests."
---

# Quick 261124-ujb: Edge transparency and Edge falloff (Spec 10) — Re-verification Report

**Phase Goal:** Implement `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-10-edge-transparency.md`, revised after the artist's first UAT look (2026-11-24): two bristle-only sliders (Edge transparency = amount, Edge falloff = broad/linear/rim) driving one lateral `edgeFilm` that is the **DEPOSIT WEIGHT** — coverage and the cover alpha carry it, the carried colour (cA/cB) stays full strength, and the scatter S rides it through `a`; neutral at amount 0 and inert at the rim at 100; canonical params + rows hidden for watercolor; no uniform opacity, no alpha-law change, no Body change. UAT rows 1-9 remain the human hand-off.
**Verified:** 2026-11-24T22:49:54Z
**Status:** human_needed
**Re-verification:** Yes — after the UAT-driven law revision (`1028861ed`). The previous round ended `human_needed` with no `gaps:` list (its only remaining items were the UAT rows), so this is a full re-verification, not a gap-closure pass; the revision commit is the only code change since the previous `verified:` timestamp.

All evidence below was re-executed against HEAD `1028861ed`. SUMMARY.md claims were used only as a starting point; every load-bearing number was re-derived from the code and from fresh probe captures.

## Law Revision (2026-11-24)

The artist's first live look reported a **white border** on a Gouache mark at Edge transparency 100 (Feather 100), amplified at falloff 100. Root cause: the deposit's source is `cA * a`, so the superseded law — which scaled the carried coefficients by `edgeFilm` **and** carried the film in `a` — squared the replacement while the attenuation of the underlayer stayed linear, leaving a pale rail (probe: the red underlayer's pigment alpha dropped 177 → 86 where the new paint deposited almost nothing; the band read (250,198,199)).

Commit `1028861ed` ("the edge film is the deposit weight, not a colour dilution") changes exactly two files (`shaders.ts`, `scattering.test.ts`) and makes the film the **deposit weight**:

- Removed: `Gathered.film`, the unconditional `featherFade *= edgeFilm`, and the S-term factor `* g.film`.
- Live law: `g.coverage = inked * featherFade * edgeFilm;` · `g.cA *= featherFade;` · `g.cB *= featherFade;` · `g.alpha *= featherFade * edgeFilm;` — the deposit `oB = vec4(cB * a, uScatter * a)` with `a = g.coverage`, so the carried colour stays full strength and the S rides the film through `a` alone. The cover equilibrium (`target = a * uCoverTarget * g.alpha`) still fades with the film, so the committed base is retained proportionally.
- The original spec's "scales the whole carried film" wording is **superseded** by the PLAN's revised truth 2; this report verifies the revised law and does not fail the wording deviation. The identity baselines, the comparator stations and the three sweeps were unchanged by the revision and all five probe gates pass.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Edge transparency 0 is inert by construction: with amount 0 the edge film early-returns 1 and the probe captures at (amount 0, falloff 0) and (0, 100), painted by a live `bristle-round` stroke (`brushId: 'bristle-round'` on the script entry, so `gatherBristle` runs), are byte-identical to baselines captured from the pre-change engine (UAT row 1). | ✓ VERIFIED | Fresh captures `/tmp/medium-engine/edge-transparency-neutral.json` (0,0) and `-neutral-broad.json` (0,100) carry digests `21171475/3ebe1b9d/fb026f34/606376d0`, bit-identical to the committed baselines (provenance `capturedFromCommit: d509a886d`, captured 2026-11-24T21:47:17Z in `130fe7ee0` — before any `src/` change — never edited). Both mode-1 comparator runs PASS with all 12 compared fields equal (byteLength 4665600, minAlpha 255). `strokeBrush`/`brush` echo `bristle-round` on every capture, so the gather and the film actually ran. Re-run after the revision commit: both identity gates still PASS. The film is causally live, not dead code: the three amount-100 captures produce all-different exported digests (truth 4). |
| 2 | The film is the DEPOSIT WEIGHT, never a colour dilution (revised after UAT 2026-11-24 — the artist's white border): coverage and the cover alpha carry `edgeFilm`; cA/cB stay full strength because the deposit's source is `cA * a`; the scatter S rides the film through `a` alone. At amount 100 the rim is inert (no deposit, no erase), and the rim inside the band is a proportional mixture of the underlayer and full-strength paint — never a pale rail (UAT rows 3 and 5). | ✓ VERIFIED | `shaders.ts` at HEAD: `float edgeFilm = 1.0 - uEdgeFade * pow(edgeT, edgeExp);` (1329), `featherFade *= alongFade * trailSupport;` (1330), the threshold `inked` untouched (1332), then `g.coverage = inked * featherFade * edgeFilm;` (1335), `g.cA *= featherFade;` (1336), `g.cB *= featherFade;` (1337), `g.alpha *= featherFade * edgeFilm;` (1338). **`g.film` exists nowhere** (grep exit 1; the struct member is removed). Deposit: discard `if (a <= 1e-3)` (1382); attenuation half `oA = vec4(a); oB = vec4(a);` (1415-1416); carried half `oA = cA * a;` (1421) and `oB = vec4(cB * a, uScatter * a);` (1425) — S rides `a` alone. With `a = g.coverage` (film-scaled) the attenuation subtracts the same film weight (inert at the rim, not an eraser) and the discard deposits nothing at 100 %. **Behavioural evidence:** the probe's mid-station cumulative ink ratio versus the neutral reference is 1.091 / 1.0543 / 1.0381 across the three sweeps (≈ full strength), while the coverage ratio equals the film (0.3200 / 0.3943 / 0.6316) — under the superseded squared law the ink would have tracked the film. Cover equilibrium `float target = a * uCoverTarget * g.alpha;` (1459) → `target / a = uCoverTarget · g.alpha`, and `g.alpha` carries the film, so the committed base is retained proportionally and nothing is written when `a → 0` at the rim. Relief reads `gatherBristle(vUv).coverage` (film-carried weight); touch reads the coverage channel with no gather; no `uEdge*` uniform appears in the cover, relief or touch programs. Unit pins in `scattering.test.ts`: the four positive lines, `expectNotContains(deposit, 'g.film')`, and negative pins for the attenuation half, threshold block, cover, relief and touch. |
| 3 | film(0) = 1 at every amount and falloff (the core never moves), film(rim) = 1 − amount at every falloff, and the fade midpoint reads 0.293 / 0.5 / 0.75 at amount 1 for falloff 0 / 50 / 100 (the landmark table). | ✓ VERIFIED | `bristles.test.ts` executes `bristleEdgeFilm` (441-447): amount-0 inert (exactly 1), core 1 at every (amount, falloff), rim exactly `1 - amount`, mid landmarks 0.5 / 0.292893 / 0.75 at amount 1, plus the monotone sweep, beyond-rim clamp and never-NaN cases. Probe sweeps (independently recomputed from the captures): core 1.0000 on all three; rim station 0.0000 = 1 − amount; mid 0.3200 / 0.3943 / 0.6316 — each within the 0.12 station bar of its landmark. |
| 4 | Falloff 0 reads broad (transparency reaches mid-width), 50 linear, 100 rim (fade hugs the silhouette), and the three points are separated in the probe's lateral profile by more than the tolerance. | ✓ VERIFIED (with a probe-margin warning — see Observations) | Exponent map pinned exactly by executed tests: `edgeFalloffExponent` (423-425) reads 0.5 / 1 / 2 at bias 0 / 50 / 100 (clamped, non-finite → 1); the shader's `exp2(2.0 * uEdgeFalloff - 1.0)` mirrors it. Measured mid stations, recomputed from the captures by re-implementing the comparator's calibration: broad 0.3200 vs expected 0.2929 (Δ +0.0271); linear 0.3943 vs 0.5 (Δ −0.1057); rim 0.6316 vs 0.75 (Δ −0.1184). Correctly ordered; extremes separated by 0.3116 > 0.12. The three sweeps differ from the neutral baseline on the three exported digests: broad `e4614527/dc153f05/fe00f905`, linear `eae3cb3c/064a4464/50467d9b`, rim `94f193fd/60a56f8e/2eae62e8` (pigment also differs: `76cbb9b5 / b203845b / 74775f5d` vs `606376d0`). Caveat: the measured adjacent broad↔linear separation is 0.0743, below the 0.12 station tolerance, so a single probe capture cannot discriminate the adjacent pair; routed to human verification as an extra check (non-blocking). |
| 5 | Both params are canonical: they live inside the Gouache and Pen medium records with 0 / 50, Reset restores 0 / 50, and re-picking a medium resets both like every other medium param (D-03). | ✓ VERIFIED | `aquarelleRecordState.ts`: both keys in `AquarelleGlobalParams` (123-124), in `AQUARELLE_GLOBAL_KEYS` (146-147, 18 keys — the snapshot loop and the selection-write allowlist carry them automatically) and in `DEFAULT_AQUARELLE_PARAMS` (168-169, 0 / 50). `mediums.ts`: `MediumParamKey` includes the pair (54-55); the acrylic record ends `edgeFade: 0, edgeFalloff: 50` (155-156); the watercolor record DERIVES both from `DEFAULT_CANONICAL_PARAMS` (91-92). `params.ts`: canonical keys 96/102, defaults 0/50 (122-123), `toEngineParams` emits `clamp01(num(p.edgeFade, d.edgeFade) / 100)` and the same for falloff (230-231). Executed tests: snapshot round-trip, allowlist writes, `applyAquarelleMedium` writing the whole record including 0 / 50, and the `AquarelleGlobalsPanel` Reset test (sets 55/5, asserts the record's 0/50 restored with size 77 and lift 33 untouched). Model note: there is ONE acrylic medium record backing both bristle responses (Gouache and Pen); both tool contexts render the rows through the shared record. |
| 6 | Both rows are acrylic-only: visible for Gouache, absent for watercolor and the Water tool, so `uEdgeFade` stays 0 for watercolor and its render is identical (UAT row 7). | ✓ VERIFIED | `aquarelleParamVisibility.ts` rows 180-181: `{ key: 'edgeFade', label: 'Edge transparency', group: 'edge', paint: BRISTLE_MEDIA }` and the falloff row, immediately after Feather. The Water tool filters on `row.water === true`, the Eraser on `row.lift === true`, so neither sees them. Executed tests assert `brush + acrylic true`, `watercolor / water tool / eraser false` for both keys. The watercolor record's `edgeFade` is 0 (derived), and `bindGather` binds `uEdgeFade = clamp(0, 0, 1)` → the shader's film is exactly 1.0 (identity proven byte-identical by truth 1). |
| 7 | The visible silhouette is unchanged: the paper threshold is untouched, cells beyond the silhouette clamp to the full rim factor so the edge narrows at amount 100 by design, and amount 0 leaves the footprint byte-identical. | ✓ VERIFIED | The revision diff (`git show 1028861ed`) touches only the film block and the deposit's carried terms in `shaders.ts` plus the pins; the threshold / `featherShift` / `takeoff` block is untouched and negatively pinned in `scattering.test.ts` (no `uEdge*` anywhere in it). `bristleEdgeFilm` clamps `u = clamp01(lateral)` so beyond-silhouette cells take the full rim factor (executed beyond-rim clamp test), documented as by design in the twin's JSDoc. Amount 0: the identity digests (truth 1) prove the footprint is bit-identical, both gates re-passing after the revision. |
| 8 | Every capture the probe comparisons run satisfies the visible-alpha contract for its capture type: the live bristle-response `edge-transparency` capture reports the bristle skip with no delta/samples, one shared predicate makes the probe and the comparator agree, a non-bristle capture can never carry a skip, and a bristle capture can never report a delta beside its skip. | ✓ VERIFIED | All five captures report `visibleAlphaSkip` = the bristle film-blur reason, `visibleAlphaMaxDelta: null`, `visibleAlphaSamples: 0`, `opaqueExportMinAlpha: 255`. `isBristleCapture` is pinned literal-identical in `probe.ts` (3412-3413) and `compare.mjs` (196-198) by executed tests. Three executed direction fixtures in `harness.test.ts`: a non-bristle capture carrying a skip fails, a bristle capture with a delta beside its skip fails, and opaque captures must keep minAlpha 255. |

**Score:** 8/8 truths verified (0 present, behavior-unverified).

### Judged Deviations (carried forward from the first round)

**Deviation 1 — plain arithmetic `1.0 - uEdgeFade * pow(edgeT, edgeExp)` instead of the plan's ternary guard.** Still the live form. With `uEdgeFade = 0` the product is exactly zero, so the film is exactly 1.0 and the pre-change program renders bit-identically — re-proven this round by both fresh amount-0 captures reproducing the `d509a886d` baselines. NaN/inf is unreachable: `edgeU` and `edgeT` are clamped [0,1], `edgeExp` lies in [0.5, 2] because `bindGather` clamps the uniform (Engine.ts:3640), `pow(0, e>0) = 0`, and the values arrive only through `toEngineParams`' `num()` + `clamp01` sanitisation (params.ts:230-231) from the two writers (`AquarelleCanvasLayer.tsx:358`, `engineAdapter.ts:423`).

**Deviation 2 — the probe comparator calibrates the station domain from the film's own rim floor (1 − amount) at amount > 0.** Still the active calibration and untouched by the revision; the identity path at amount 0 still uses the reference's 2 %-of-peak rim. The executed harness fixtures prove the comparator is fail-closed (blank profile, missing `edgeAcross`, missing `edgeTiling.enclosed`, an unfaded film that never reaches its floor, and a null `edgeAmount` each FAIL with the correct named invariant; a wrong-falloff profile fails).

**Superseded wording — the spec's "scales the whole carried film" is deliberately NOT verified.** The PLAN's revised truth 2 (deposit weight) is the verified contract, per the task goal; treating the old wording as a failure would contradict the explicit revision. The original law is not merely re-worded, it was measured wrong on the live surface (the white rail), and the probe's ink-ratio evidence above demonstrates the replacement is the full-strength behaviour.

### Deferred Items

None. This is a quick task with no later phase in a milestone; UAT rows 1-9 are the human hand-off, not deferred scope.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json` | Pre-change identity baseline (0,0) | ✓ VERIFIED | Exists, 281 offsets, `capturedFromCommit: d509a886d`, digests match the fresh capture exactly; added once in `130fe7ee0`, never edited. |
| `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json` | Pre-change identity baseline (0,100) | ✓ VERIFIED | Same provenance; digests identical to the (0,0) baseline and to the fresh capture. |
| `packages/efx-watercolor/src/playground/bristles.ts` | Tested twin `bristleEdgeFilm` + `edgeFalloffExponent` + three constants | ✓ VERIFIED | Constants 278/280/282 (`BRISTLE_EDGE_START = 0.55`, exp min 0.5, max 2); twin 441-447; exponent map 423-425; non-finite guards; JSDoc documents silhouette units and the beyond-rim clamp by design. |
| `packages/efx-watercolor/src/playground/shaders.ts` | The ONE lateral film in `BRISTLE_GATHER` + the revised deposit weight | ✓ VERIFIED | Uniforms 970-972; film block 1329-1338 with the revised comments; deposit 1382/1415-1425 (`oB = vec4(cB * a, uScatter * a)`); no `g.film` anywhere. The revision diff contains exactly these changes (no threshold, cover, relief, or touch edits). |
| `packages/efx-watercolor/src/playground/Engine.ts` | Params, defaults, unconditional binding | ✓ VERIFIED | Params 134-135, `DEFAULT_PARAMS` 0 / 0.5 (152-153), `bindGather` binds `uEdgeStart = BRISTLE_EDGE_START`, `uEdgeFade`, `uEdgeFalloff` (clamped 0..1) at 3638-3640; `bindGather` is called at all four consumers (3191, 3226, 3739, 3769). |
| `packages/efx-watercolor/src/playground/params.ts` | Canonical 0..100 keys mapped to 0..1 | ✓ VERIFIED | Keys 96/102, defaults 0/50 (122-123), `toEngineParams` 230-231 (`/100` + `clamp01` + `num()` sanitiser). |
| `packages/efx-watercolor/src/playground/mediums.ts` | Both records carry 0 / 50; keys in `MediumParamKey` | ✓ VERIFIED | `MediumParamKey` 54-55; watercolor derives both (91-92); acrylic literal 0 / 50 (155-156); executed key-pin and record-literal tests. |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Keys in interface, defaults, key list | ✓ VERIFIED | 123-124, 146-147 (18 keys), 168-169; the snapshot loop over `AQUARELLE_GLOBAL_KEYS` and the selection allowlist carry them with no new code. |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | Two acrylic-only rows | ✓ VERIFIED | Rows `edgeFade` / `edgeFalloff` immediately after Feather (180-181), `paint: BRISTLE_MEDIA`, labels "Edge transparency" / "Edge falloff", edge group; `isAquarelleParamRowVisible` is the ONE shared selector. |

All nine artifacts pass levels 1 (exists), 2 (substantive), 3 (wired) and 4 (data flows — see below).

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `aquarelleParamVisibility.ts` | `aquarelleRecordState.ts` | Row keys must exist in `AQUARELLE_GLOBAL_KEYS` / `DEFAULT_AQUARELLE_PARAMS` | ✓ WIRED | Both keys present; snapshot loop and allowlist iterate the list; executed tests round-trip them. |
| `aquarelleRecordState.ts` | `mediums.ts` | Both keys in the medium records for Reset / re-pick | ✓ WIRED | Acrylic literal 0/50; watercolor derived 0/50; `applyAquarelleMedium` writes the whole record; the panel Reset iterates the record. |
| `mediums.ts` | `params.ts` | Record bag feeds the canonical params; pair maps through `toEngineParams` | ✓ WIRED | `MediumParamKey` extended; `toEngineParams` maps both with the non-finite sanitiser and `/100` normalisation. |
| `params.ts` | `Engine.ts` | Normalised 0..1 values into `Params`, consumed by `bindGather` | ✓ WIRED | `Params` members and defaults; `toEngineParams` → `engine.setParams` at both writers (`AquarelleCanvasLayer.tsx:358`, `engineAdapter.ts:423`). |
| `Engine.ts` | `shaders.ts` | `bindGather` binds `uEdgeStart` / `uEdgeFade` / `uEdgeFalloff` for every consumer | ✓ WIRED | Bindings 3638-3640; `bindGather` called at 3191, 3226, 3739, 3769; uniform declarations pinned by executed source tests. |
| `shaders.ts` | `bristles.ts` | The shader's exponent map mirrors the tested twin; the gather uses the silhouette constant chain | ✓ WIRED | Shader `exp2(2.0 * uEdgeFalloff - 1.0)` ≡ twin `2 ** (2b - 1)`; `uEdgeStart` bound from `BRISTLE_EDGE_START`; the shader's `lateral / uFeatherEdge` matches the twin's silhouette-units contract. |
| `probe.ts` | `brushes.ts` | The scenario's own `brushId: 'bristle-round'` | ✓ WIRED | Literal pinned in `probe.ts` and `run.mjs`; `resolvedBrush` chain includes the scenario; the comparator fails any capture whose `strokeBrush` is not `bristle-round` (executed fixture, including a `'round'` rejection). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AquarelleGlobalsPanel.tsx` slider rows | `params[row.key]` (edgeFade / edgeFalloff) | `aquarelleParams` signal (0..100), written by `setAquarelleParam` | Yes — `AquarelleCanvasLayer.tsx:358` → `toEngineParams` → `engine.setParams` | ✓ FLOWING |
| `Engine.ts` uniforms | `this.params.edgeFade` / `.edgeFalloff` | `toEngineParams` normalisation of the live bag / the medium record (Reset, re-pick) | Yes — bound per gather call, no static fallback | ✓ FLOWING |
| `shaders.ts` film | `edgeFilm` | `lateral`, `uFeatherEdge`, `uEdgeStart`, `uEdgeFade`, `uEdgeFalloff` | Yes — scales `g.coverage` and `g.alpha` (the deposit weight and the cover equilibrium); `cA`/`cB` stay full strength; the probe measures the rendered result | ✓ FLOWING |
| Probe capture | `edgeAcross { offsets, cover, ink }` / `edgeTiling.enclosed` | Live headless-Chrome WebGL render of the real `bristle-round` stroke | Yes — 281 offsets of real rendered coverage/ink; blank profiles fail | ✓ FLOWING |

No value in the chain ends in a hardcoded literal or a mock; the only constants are the declared neutral defaults (0 / 50 canonical, 0 / 0.5 engine), which are the law's neutral point.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package test suite (incl. the 147-test probe harness, twin, params, records, shader pins) | `pnpm --dir packages/efx-watercolor exec vitest run` | 1057 passed, 8 skipped, 0 failed; exit 0 | ✓ PASS |
| App typecheck | `pnpm --dir app exec tsc --noEmit` | exit 0, clean | ✓ PASS |
| Full app suite | `pnpm --dir app exec vitest run` | 467 test files passed / 2 skipped (469); 9876 tests passed / 4 skipped / 96 todo (9976); exit 0. The pre-existing `physicPaintBridge.test.ts` timing flake did NOT recur this run. | ✓ PASS |
| Fingerprint of the changed-file set | `node .claude/gsd-core/bin/gsd-tools.cjs query verification.fingerprint "<phase dir>" <22 files>` | 24 covered files, `v4:sha256:039926f2e60bc8d77d711c18d18a2ec7ffd7be551c4498c734dccad15b6a7579` | ✓ PASS |

### Probe Execution

The phase's probe is the headless-Chrome medium-engine harness (`run.mjs` capture + `compare.mjs` evaluation), not a `scripts/*/tests/probe-*.sh` script. All five gates were re-executed in this verification; captures live in `/tmp/medium-engine/`, baselines in `packages/efx-watercolor/probe/medium-engine/baselines/`.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Identity (0,0) | `run.mjs --gate edge-transparency-neutral --scenario edge-transparency --edge 0 --falloff 0 --size 1080` then `compare.mjs edge-transparency-neutral` | PASS — digests `21171475/3ebe1b9d/fb026f34/606376d0` equal the `d509a886d` baseline; all 12 compared fields equal | PASS |
| Identity (0,100) | same with `--gate edge-transparency-neutral-broad --falloff 100` | PASS — same four digests; all 12 fields equal | PASS |
| Sweep broad (100,0) | `run.mjs --gate edge-transparency-broad --edge 100 --falloff 0` then `compare.mjs edge-transparency-broad --differs-from edge-transparency-neutral` | PASS — exported digests differ (`e4614527/dc153f05/fe00f905`); core 1.0000; mid 0.3200 (expected 0.2929, Δ +0.0271); rim 0.0000 = 1 − amount; ink rim 0 < core 2.254; enclosure bars hold | PASS |
| Sweep linear (100,50) | same with `--gate edge-transparency-linear --falloff 50` | PASS — exported digests differ (`eae3cb3c/064a4464/50467d9b`); mid 0.3943 (expected 0.5, Δ −0.1057); rim 0.0000; ink direction holds | PASS |
| Sweep rim (100,100) | same with `--gate edge-transparency-rim --falloff 100` | PASS — exported digests differ (`94f193fd/60a56f8e/2eae62e8`); mid 0.6316 (expected 0.75, Δ −0.1184); rim 0.0000; ink direction holds | PASS |
| Revised-law ink check (behavioural) | independent recomputation of the mid-station cumulative ink ratio vs the neutral reference from the three sweep captures | 1.091 / 1.0543 / 1.0381 (≈ full strength) while coverage ratio = film 0.3200 / 0.3943 / 0.6316 — the carried colour is NOT film-scaled | PASS |
| Probe source/harness pins | included in the package suite (`probe/medium-engine/harness.test.ts`) | 147 tests green, including the comparator fixtures (blank/missing/notiling/unfaded/nan rejection, wrong-falloff, `'round'` strokeBrush rejection) and the three alpha-law direction pins | PASS |

### Test Quality Audit

| Test File | Linked Req/Truth | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|------------------|--------|---------|----------|-----------------|---------|
| `packages/efx-watercolor/src/playground/bristles.test.ts` | truths 3, 4 | yes (twin describe 729-817) | 0 | no | Value/Behavioral | PASS |
| `packages/efx-watercolor/src/playground/params.test.ts` | truth 5 | yes | 0 | no | Value | PASS |
| `packages/efx-watercolor/src/playground/mediums.test.ts` | truth 5 | yes | 0 | no | Value | PASS |
| `packages/efx-watercolor/src/playground/scattering.test.ts` | truths 2, 7 | yes (revised pins) | 0 | no | Behavioral (source-law pins) | PASS |
| `packages/efx-watercolor/probe/medium-engine/harness.test.ts` | truths 2, 4, 8 | yes (147) | 0 | no — baselines are a PRE-change external oracle (`d509a886d`), captured before any `src/` change; station landmarks come from the independently pinned law math | Behavioral | PASS |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` | truth 5 | yes | 1 pre-existing `describe.skip` (line 824, 261123-hr5 emboss band — unrelated feature) | no | Behavioral | PASS (WARNING-class: pre-existing skip on an unrelated feature; active tests cover this phase's Reset) |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts` | truth 6 | yes | 0 | no | Value | PASS |
| `app/src/components/physic-paint/view/mediumSelection.test.ts` | truth 5 | yes | 0 | no | Value | PASS |
| `app/src/components/physic-paint/view/brushGroupMedium.test.ts` | truth 5 | yes | 0 | no | Value | PASS |

**Disabled tests on requirements:** 0 new; one pre-existing unrelated `describe.skip` in a phase-linked app test file → WARNING only, other active tests cover the requirement.
**Circular patterns detected:** 0 blocking — the probe's baselines were captured from the pre-change engine commit before any source change (VALID external-oracle provenance), and the station expected values are the law's independently pinned landmarks (PARTIAL for the sweep bars, by design, backed by exact unit pins).
**Insufficient assertions:** 0.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| — | — | No requirement IDs declared (`requirements: []` in the PLAN frontmatter); this is a quick task with no `REQUIREMENTS.md` mapping | N/A | Verified: no `261124-ujb` entry in `.planning/REQUIREMENTS.md`. |

### Decision Coverage

Decision coverage verify (warning): could not parse decisions — possible format mismatch. Check the formatting of the CONTEXT.md decisions block (accepted forms: `- **D-NN:** text`, `- **D4-NN:** text` (phase-prefixed), `- **D-NN — title** body`). The gate returned `could-not-parse` (total 0), so no counts are reported. Manual review: every CONTEXT.md decision is honored — params ride the medium record with 0 / 50 defaults, Reset and re-pick (D-03); falloff direction 0 broad / 50 linear / 100 rim with `edgeFalloffExponent = 2^(2b−1)`; silhouette units `u = clamp(lateral / uFeatherEdge, 0, 1)`; `uEdgeStart = 0.55` silhouette-relative; the beyond-silhouette clamp is stated in the law's comment as intended.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No `TBD` / `FIXME` / `XXX` markers in any of the 20 changed source/test files (grep exit 1); no newly added `describe.skip` / `it.skip` (all skips are pre-existing); no new empty-return stubs; no `g.film` leftovers. |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | None | — | No Step 7 blocker arose that lacked deterministic evidence. |

## Observations (non-blocking)

1. **Probe discrimination margin at adjacent falloff settings (WARNING).** The measured mid stations are 0.3200 (broad), 0.3943 (linear), 0.6316 (rim). Each passes its own 0.12 station bar against its expected landmark, the ordering is correct, and the extremes are separated by 0.3116. But the adjacent broad↔linear separation is 0.0743 — below the 0.12 station tolerance — and the rim margin is thin (0.1184 of 0.12). From a single capture the comparator therefore cannot distinguish a falloff-0 stroke from a falloff-50 stroke; the harness's executed wrong-falloff fixture only proves rejection across the extreme gap. The implementation itself is exact (executed unit tests pin 0.5 / 1 / 2 and the 0.293 / 0.5 / 0.75 landmarks), and the bias is the probe's station calibration/rounding, not a law violation. Surfaced to the artist as an extra human check; not a gap.
2. **Stale pre-revision prose in five comments (WARNING — documentation drift only).** Comments still describe the superseded "whole carried film" law: `params.ts:90-92`, `Engine.ts:134`, `mediums.ts:35-37`, `scattering.test.ts:730-732`, `probe.ts:3213-3217`. The code and the executed pins are correct; these are prose only and carry no debt marker. Suggested follow-up: refresh the five comment blocks to the deposit-weight wording when next touching those files. Not blocking.
3. **Full app suite clean this run.** The pre-existing `physicPaintBridge.test.ts` timing flake recorded in the previous verification did not recur (467 files passed / 2 skipped; 9876 tests passed / 4 skipped / 96 todo; exit 0). Unchanged and untouched by this quick.
4. **Truth 5 wording vs the medium model.** The truth says "the Gouache and Pen medium records"; the model has ONE acrylic medium record (`id: 'acrylic'`, displayed "Gouache") backing both bristle brush responses. Both responses carry the pair through the shared record and both tool contexts render the rows; the operative outcome (canonical params, Reset, re-pick) holds for both.
5. **Decision coverage: not evaluated** — `check.decision-coverage-verify` returned `could-not-parse` (total 0, evidence unreadable; the CONTEXT.md block uses the bullet-list form that the parser does not accept). Manual review confirms every decision is honored (see Decision Coverage above).

## Human Verification Required

1. **UAT row 1** — Gouache, Edge transparency 0, falloff 0 and 100: render byte-identical to before the change (the automated identity gates already prove bit-identity; confirm on screen).
2. **UAT row 2** — Edge transparency 50, falloff 50: core unchanged, rim half-transparent, smooth ramp over the outer half; no banding on a curved S-stroke.
3. **UAT row 3** — Edge transparency 100, falloff 100, plus the rebuilt white-border case: Feather 100 at falloff 0 and 100. The middle band stays ~75 % opaque, the fade hugs the silhouette; the rim is inert (does not erase paint already on the sheet); **the band shows full-strength paint over the underlayer — no white/pale rail** (the artist's 2026-11-24 report).
4. **UAT row 4** — Edge transparency 100, falloff 0: transparency reaches the middle band (~29 % film); soft airbrush look; centreline stays full.
5. **UAT row 5** — Over a committed stroke on a fresh key, amount 100 / falloff 50: the rim reveals the base as a proportional mixture of the underlayer and full-strength paint; **no milky/white halo** (the UAT-reported pale rail is gone).
6. **UAT row 6** — Leave the key, reopen, paint on the restored sheet: documented limitation accepted (the sheet's own paint is replaced under the translucent band, not glazed).
7. **UAT row 7** — Watercolor: rows absent, render identical.
8. **UAT row 8** — Leave/reopen + forced re-render, and Undo/Redo: the bake matches the live view at the same frame.
9. **UAT row 9** — Feather 0 / 85 × falloff 0 / 100: the laws compose; no seam at the stroke caps or along the rim.
10. **Extra (probe margin)** — Paint falloff 0, 50 and 100 side by side at amount 100: confirm the three shapes read visibly distinct, in particular broad (0) versus linear (50) (probe mid stations 0.320 vs 0.394, separation 0.074 below the 0.12 station tolerance; the law's landmarks are 0.293 / 0.5 / 0.75).

## Gaps Summary

No automated gaps. All 8 must-haves are verified against HEAD `1028861ed` under the revised deposit-weight law: both amount-0 captures are byte-identical to the pre-change `d509a886d` baselines (all 12 fields equal), the film multiplies coverage and the cover alpha while cA/cB stay full strength and S rides `a` alone — with probe ink-ratio evidence (1.04–1.09 of the reference, not the film's 0.32–0.63) that the carried colour is no longer diluted — the cover equilibrium still fades with the film so the committed base is retained, relief/touch weights follow coverage, the landmark law is pinned exactly by executed unit tests and matched by the three sweeps within tolerance, both params are canonical with Reset and re-pick coverage, the rows are acrylic-only, the silhouette/threshold block is untouched, and the visible-alpha contract holds in both directions. The revision commit is the only code change since the previous verification and all gates were re-run green. One probe-margin observation (adjacent falloff discrimination) and one documentation-drift observation are recorded above; neither is a phase gap. UAT rows 1-9 (plus the falloff-distinctness check, with rows 3/5 explicitly covering the artist's white-border case) remain the human hand-off, so the status is `human_needed`, not `passed`.

---

_Verified: 2026-11-24T22:49:54Z_
_Verifier: Claude (gsd-verifier)_
