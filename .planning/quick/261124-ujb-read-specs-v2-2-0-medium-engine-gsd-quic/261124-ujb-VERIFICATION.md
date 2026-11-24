---
phase: 261124-ujb
verified: 2026-11-24T22:24:03Z
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
covered_digest: "v4:sha256:b898e0b9569eadb2a3ada1d7e93765462e859e5d4e3cc5f4b9ece1f6e8c69927"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "UAT row 1 — Gouache, Edge transparency 0, falloff 0 and falloff 100, stroke on paper"
    expected: "Render byte-identical to before the change (the automated mode-1 identity gates already prove bit-identity; confirm on screen)"
    why_human: "The artist's eye on the live canvas is the acceptance surface; the automated proxy is the probe's byte-identity against the pre-change baselines."
  - test: "UAT row 2 — Edge transparency 50, falloff 50, stroke on paper and a curved S-stroke"
    expected: "Core unchanged, rim half-transparent, smooth ramp over the outer half; no banding on the curved stroke"
    why_human: "Band quality on a curved stroke is a visual judgment."
  - test: "UAT row 3 — Edge transparency 100, falloff 100"
    expected: "The middle band stays ~75 % opaque, the fade hugs the silhouette; the rim is inert — it does not erase paint already on the sheet"
    why_human: "Inertness (no erase of same-sheet paint) and the ~75 % middle are visual judgments; the automated ink-direction and rim-floor bars are only proxies."
  - test: "UAT row 4 — Edge transparency 100, falloff 0"
    expected: "The transparency reaches the middle band (~29 % film there); soft airbrush look; the centreline stays full"
    why_human: "The soft-airbrush look is a visual judgment."
  - test: "UAT row 5 — Over a committed stroke on a fresh key, amount 100 / falloff 50"
    expected: "The rim reveals the base; no milky/white halo (the S term carries g.film)"
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

# Quick 261124-ujb: Edge transparency and Edge falloff (Spec 10) Verification Report

**Phase Goal:** Implement `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-10-edge-transparency.md` exactly — two bristle-only sliders (Edge transparency = amount, Edge falloff = broad/linear/rim) driving one lateral `edgeFilm` that scales the whole carried film (coverage + cA/cB/alpha via `featherFade`, plus the scatter S through `g.film`); neutral at amount 0 and inert at the rim at 100; canonical params + rows hidden for watercolor; no uniform opacity, no alpha-law change, no Body change. Tests first, probe, UAT rows 1-9.
**Verified:** 2026-11-24T22:24:03Z
**Status:** human_needed
**Re-verification:** No — initial verification (no previous VERIFICATION.md in the task directory)

Verified at HEAD over the range `d509a886d..HEAD` (commits `130fe7ee0`, `1c5a27f4b`, `e08e356f9`, `6dc87a30b`). All evidence below was re-executed in this verification; SUMMARY.md claims were used only as a starting point and every load-bearing number was re-derived from the code and the probe captures.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Edge transparency 0 is inert by construction: the film early-returns 1, and probe captures at (0,0) and (0,100), painted by a live `bristle-round` stroke, are byte-identical to baselines captured from the pre-change engine (UAT row 1). | ✓ VERIFIED | Fresh captures `/tmp/medium-engine/edge-transparency-neutral.json` (amount 0, falloff 0) and `-neutral-broad.json` (0, 100) carry digests `21171475/3ebe1b9d/fb026f34/606376d0`, bit-identical to the committed baselines (provenance `capturedFromCommit: d509a886d`, `capturedAt 2026-11-24T21:47:17Z`, added once in `130fe7ee0`, never edited since). Both mode-1 comparator runs PASS with all 12 compared fields equal. `strokeBrush`/`brush` echo `bristle-round` on every capture, so `gatherBristle` and the film actually ran. The film is causally live, not dead code: the three amount-100 captures produce all-different digests (below). |
| 2 | The film fades the whole carried film together: coverage, cA, cB and alpha all carry `edgeFilm`, and the scatter S term carries `g.film` — so at amount 100 the rim is inert (no deposit, no erase), never an eraser, and no milky white rim appears from Body (UAT rows 3 and 5). | ✓ VERIFIED | `shaders.ts` (HEAD): `float film;` in `Gathered`; `g.film = 1.0;` before both early returns; the lateral block sets `g.film = edgeFilm; featherFade *= edgeFilm;` immediately before `featherFade *= alongFade * trailSupport;`; then `g.coverage = inked * featherFade; g.cA *= featherFade; g.cB *= featherFade; g.alpha *= featherFade;` (the threshold `inked` is computed BEFORE the film — the silhouette does not move). Deposit: `oB = vec4(cB * a, uScatter * a * g.film);` with `a = g.coverage`, so the rim weight `a` carries the film into BOTH blend halves — the attenuation half `oA = vec4(a); oB = vec4(a);` subtracts the same film-scaled weight (inert, not an eraser) and the `a <= 1e-3` discard makes a 100 % rim deposit nothing. All pinned by executed tests in `scattering.test.ts` plus negative pins that the attenuation half, threshold block, and cover/relief/touch programs carry no `uEdge*`. Probe confirmation: every sweep reaches its rim floor `1 - amount`, and the supporting ink direction check (rim ink < core ink) passed on all three sweeps. |
| 3 | film(0) = 1 at every amount and falloff, film(rim) = 1 − amount at every falloff, and the fade midpoint reads 0.293 / 0.5 / 0.75 at amount 1 for falloff 0 / 50 / 100 (the landmark table). | ✓ VERIFIED | `bristles.test.ts` executes `bristleEdgeFilm`: amount-0 inert (exactly 1), core 1 at every (amount, falloff), rim exactly `1 - amount`, mid landmarks 0.5 / 0.292893 / 0.75 at amount 1 (and the monotone sweep + beyond-rim clamp + never-NaN cases). Probe sweeps (independently recomputed from the captures): core 1.0000 on all three; rim station reads exactly `1 - amount` (0.0000 at amount 1); mid 0.3200 / 0.3943 / 0.6316 — each within the 0.12 station bar of its landmark (see truth 4 for the margin). |
| 4 | Falloff 0 reads broad (transparency reaches mid-width), 50 linear, 100 rim (fade hugs the silhouette), and the three points are separated in the probe's lateral profile by more than the tolerance. | ✓ VERIFIED (with a probe-margin warning — see Observations) | Exponent map pinned exactly by executed tests: `edgeFalloffExponent` reads 0.5 / 1 / 2 at bias 0 / 50 / 100 (and the shader's `exp2(2.0 * uEdgeFalloff - 1.0)` mirrors it). Measured mid stations, recomputed from the captures by re-implementing the comparator's calibration: broad 0.3200 vs expected 0.2929 (Δ +0.0271); linear 0.3943 vs 0.5 (Δ −0.1057); rim 0.6316 vs 0.75 (Δ −0.1184). Correctly ordered (broad < linear < rim); extremes separated by 0.3116 > 0.12; the executed harness fixture proves a wrong-falloff profile fails (a broad profile claiming rim misses by 0.457). Caveat: the measured adjacent broad↔linear separation is 0.0743, below the 0.12 station tolerance, so a single probe capture cannot discriminate the adjacent pair; the expected landmarks are separated by 0.2071 / 0.25 (> 0.12), and the plan's own Task 3 done-bar ("mid at the falloff's exponent") passes. Routed to human verification as an extra check. |
| 5 | Both params are canonical: they live inside the Gouache and Pen medium records with 0 / 50, Reset restores 0 / 50, and re-picking a medium resets both like every other medium param (D-03). | ✓ VERIFIED | `aquarelleRecordState.ts`: both keys in `AquarelleGlobalParams` (123-124), in `AQUARELLE_GLOBAL_KEYS` (146-147, 18 keys, so the snapshot loop and selection-write allowlist carry them automatically) and in `DEFAULT_AQUARELLE_PARAMS` (168-169, 0 / 50). `mediums.ts`: `MediumParamKey` includes the pair (54-55); the acrylic record ends `edgeFade: 0, edgeFalloff: 50` (155-156); the watercolor record DERIVES both from `DEFAULT_CANONICAL_PARAMS` (91-92). Executed tests: snapshot round-trip 35/90, allowlist writes 45/80, `applyAquarelleMedium` writes the whole record including 0 / 50, and the `AquarelleGlobalsPanel` Reset test sets 55/5 then asserts the record's 0/50 are restored (size 77 and lift 33 untouched). Model note: there is ONE acrylic medium record backing both bristle responses (Gouache and Pen); both tool contexts render the rows because both are paint tools on the acrylic medium (`aquarelleParamVisibility.test.ts` pins the row table and per-tool visibility). |
| 6 | Both rows are acrylic-only: visible for Gouache, absent for watercolor and the Water tool, so `uEdgeFade` stays 0 for watercolor and its render is identical (UAT row 7). | ✓ VERIFIED | `aquarelleParamVisibility.ts`: both rows carry `paint: BRISTLE_MEDIA` (`['acrylic']`), the Water tool filters on `row.water === true` and the Eraser on `row.lift === true`, so neither sees them. Executed tests assert `brush + acrylic true`, `watercolor / water tool / eraser false` for both keys; the watercolor record's `edgeFade` is 0 (derived), and `bindGather` binds `uEdgeFade = clamp(0, 0, 1)` → the shader's film is exactly 1.0 (identity proven byte-identical by truth 1). |
| 7 | The visible silhouette is unchanged: the paper threshold is untouched, cells beyond the silhouette clamp to the full rim factor so the edge narrows at amount 100 by design, and amount 0 leaves the footprint byte-identical. | ✓ VERIFIED | Shader diff `d509a886d..HEAD` touches only the uniform declarations, the `Gathered.film` member/init, the lateral film block, and the S term; the threshold / `featherShift` / `takeoff` block is untouched and negatively pinned in `scattering.test.ts` (no `uEdge*` anywhere in it). `bristleEdgeFilm` clamps `u = clamp01(lateral)` so beyond-silhouette cells take the full rim factor (executed beyond-rim clamp test), documented as by design. Amount 0: identity digests (truth 1) prove the footprint is bit-identical. |
| 8 | Every capture the probe comparisons run satisfies the visible-alpha contract for its capture type: the live bristle-response `edge-transparency` capture reports the bristle skip with no delta/samples, one shared predicate makes the probe and the comparator agree, a non-bristle capture can never carry a skip, and a bristle capture can never report a delta beside its skip. | ✓ VERIFIED | All five captures report `visibleAlphaSkip` = the bristle film-blur reason, `visibleAlphaMaxDelta: null`, `visibleAlphaSamples: 0`, and `opaqueExportMinAlpha: 255`. `isBristleCapture` is pinned literal-identical in `probe.ts` (3412-3413) and `compare.mjs` (196-198) by executed tests. Three executed direction fixtures in `harness.test.ts`: a non-bristle capture carrying a skip fails, a bristle capture with a delta beside its skip fails, and opaque captures must keep minAlpha 255. |

**Score:** 8/8 truths verified (0 present, behavior-unverified).

### Judged Deviations (requested by the verification brief)

**Deviation 1 — plain arithmetic `1.0 - uEdgeFade * pow(edgeT, edgeExp)` instead of the plan's ternary guard.** Proven equivalent to the law at amount 0, and strictly stronger than the plan's wording: with `uEdgeFade = 0` the product is exactly zero for every finite `pow` result, so `edgeFilm` is exactly 1.0 and the pre-change program renders bit-identically — both fresh amount-0 captures reproduce the `d509a886d` baselines' digests exactly (`21171475/3ebe1b9d/fb026f34/606376d0`), with all 12 comparator fields equal. NaN/inf is unreachable: `edgeU` is clamped [0,1], `edgeT` is clamped [0,1], `edgeExp = exp2(2*uEdgeFalloff - 1)` lies in [0.5, 2] because the uniform is clamped [0,1] in `bindGather` (Engine.ts:3640), `pow(0, e>0) = 0`, and the uniforms arrive only through `toEngineParams`' `num()` + `clamp01` sanitisation (params.ts:230-231) from the only two writers (`AquarelleCanvasLayer.tsx:358`, `engineAdapter.ts:423`); `setAquarelleParam` additionally rejects non-finite values. The SUMMARY's stated reason (a guarded ternary measured a whole-export ULP drift) is consistent with the identity-gate requirement being met only by the arithmetic form.

**Deviation 2 — the probe comparator calibrates the station domain from the film's own rim floor (1 − amount) at amount > 0 instead of the reference's 2 %-of-peak rim.** Proven law-preserving and fail-closed. At amount 0 the identity path still uses `edgeSilhouettePx(reference)` — the reference's 2 %-of-peak rim, min of both sides, guarded to ≥ 8 px. At amount > 0 the reference's rim cannot locate the engine's silhouette (it lies outside the mark's drawn silhouette), so the comparator derives the domain from the film's own floor, averaged over both sides and guarded to ≥ 8 px; the `EDGE_FLOOR_EPS = 1e-3` tail test and the per-station bars remain the law checks. Fail-closed proof executed: five doctored captures (blank profile; missing `edgeAcross`; missing `edgeTiling.enclosed`; an unfaded film that never reaches its rim floor; a null `edgeAmount`) each FAIL with the correct named invariant, so a degenerate, blank, or unfitted profile can never pass vacuously. The identity path is untouched by the calibration swap.

### Deferred Items

None. This is a quick task with no later phase in a milestone; UAT rows 1-9 are the human hand-off, not deferred scope.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json` | Pre-change identity baseline (0,0) | ✓ VERIFIED | Exists, 281 offsets, `capturedFromCommit: d509a886d`, digests match the fresh capture exactly; added once, never edited. |
| `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json` | Pre-change identity baseline (0,100) | ✓ VERIFIED | Same provenance; digests identical to the (0,0) baseline and to the fresh capture. |
| `packages/efx-watercolor/src/playground/bristles.ts` | Tested twin `bristleEdgeFilm` + `edgeFalloffExponent` + three constants | ✓ VERIFIED | Constants at 278/280/282 (`BRISTLE_EDGE_START = 0.55`, exp min 0.5, max 2); twin at 441-448; exponent map at 423-426; non-finite guards; JSDoc documents silhouette units and the beyond-rim clamp by design. |
| `packages/efx-watercolor/src/playground/shaders.ts` | The ONE lateral film in `BRISTLE_GATHER` + the S term | ✓ VERIFIED | Uniforms at 967-972; `float film;` and neutral init; film block at 1321-1326; `featherFade *= edgeFilm;`; S term at 1422. The diff against `d509a886d` contains exactly these changes (no threshold, cover, relief, or touch edits). |
| `packages/efx-watercolor/src/playground/Engine.ts` | Params, defaults, unconditional binding | ✓ VERIFIED | Params 134-135, `DEFAULT_PARAMS` 0 / 0.5 (152-153), `bindGather` binds `uEdgeStart = BRISTLE_EDGE_START`, `uEdgeFade` and `uEdgeFalloff` (clamped 0..1) at 3639-3640; `bindGather` is called at all four consumers (3191, 3226, 3739, 3769). |
| `packages/efx-watercolor/src/playground/params.ts` | Canonical 0..100 keys mapped to 0..1 | ✓ VERIFIED | `CanonicalParams` keys 96/102, defaults 0/50 (122-123), `toEngineParams` emits `clamp01(num(p.edgeFade, d.edgeFade) / 100)` and the same for falloff (230-231). |
| `packages/efx-watercolor/src/playground/mediums.ts` | Both records carry 0 / 50; keys in `MediumParamKey` | ✓ VERIFIED | `MediumParamKey` 54-55; watercolor derives both (91-92); acrylic literal 0 / 50 (155-156); executed key-pin and record-literal tests. |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Keys in interface, defaults, key list | ✓ VERIFIED | 123-124, 146-147, 168-169; the snapshot loop over `AQUARELLE_GLOBAL_KEYS` and the selection allowlist carry them with no new code. |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | Two acrylic-only rows | ✓ VERIFIED | Rows `edgeFade` / `edgeFalloff` immediately after Feather (180-181), `paint: BRISTLE_MEDIA`, labels "Edge transparency" / "Edge falloff", edge group; `isAquarelleParamRowVisible` is the ONE shared selector. |

All nine artifacts pass levels 1 (exists), 2 (substantive), 3 (wired) and 4 (data flows — see below).

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `aquarelleParamVisibility.ts` | `aquarelleRecordState.ts` | Row keys must exist in `AQUARELLE_GLOBAL_KEYS` / `DEFAULT_AQUARELLE_PARAMS` | ✓ WIRED | Both keys present; snapshot loop and allowlist iterate the list; executed tests round-trip them. |
| `aquarelleRecordState.ts` | `mediums.ts` | Both keys in the medium records for Reset / re-pick | ✓ WIRED | Acrylic literal 0/50; watercolor derived 0/50; `applyAquarelleMedium` writes the whole record; the panel Reset iterates the record. |
| `mediums.ts` | `params.ts` | Record bag feeds the canonical params; pair maps through `toEngineParams` | ✓ WIRED | `MediumParamKey` extended; `toEngineParams` maps both with the non-finite sanitiser and `/100` normalisation. |
| `params.ts` | `Engine.ts` | Normalised 0..1 values into `Params`, consumed by `bindGather` | ✓ WIRED | `Params` members and defaults; `toEngineParams` → `engine.setParams` at both writers (`AquarelleCanvasLayer.tsx:358`, `engineAdapter.ts:423`). |
| `Engine.ts` | `shaders.ts` | `bindGather` binds `uEdgeStart` / `uEdgeFade` / `uEdgeFalloff` for every consumer | ✓ WIRED | Bindings at 3639-3640 plus `uEdgeStart`; `bindGather` called at 3191, 3226, 3739, 3769; uniform declarations pinned by executed source tests. |
| `shaders.ts` | `bristles.ts` | The shader's exponent map mirrors the tested twin; the gather uses the silhouette constant chain | ✓ WIRED | Shader `exp2(2.0 * uEdgeFalloff - 1.0)` ≡ twin `2 ** (2b - 1)`; `uEdgeStart` bound from `BRISTLE_EDGE_START`; the shader's `lateral / uFeatherEdge` matches the twin's silhouette-units contract. |
| `probe.ts` | `brushes.ts` | The scenario's own `brushId: 'bristle-round'` | ✓ WIRED | Literal pinned in `probe.ts` and `run.mjs`; `resolvedBrush` chain includes the scenario; the comparator fails any capture whose `strokeBrush` is not `bristle-round` (executed fixture). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AquarelleGlobalsPanel.tsx` slider rows | `params[row.key]` (edgeFade / edgeFalloff) | `aquarelleParams` signal (0..100), written by `setAquarelleParam` | Yes — `AquarelleCanvasLayer.tsx:358` → `toEngineParams` → `engine.setParams` | ✓ FLOWING |
| `Engine.ts` uniforms | `this.params.edgeFade` / `.edgeFalloff` | `toEngineParams` normalisation of the live bag / the medium record (Reset, re-pick) | Yes — bound per gather call, no static fallback | ✓ FLOWING |
| `shaders.ts` film | `edgeFilm` | `lateral`, `uFeatherEdge`, `uEdgeStart`, `uEdgeFade`, `uEdgeFalloff` | Yes — scales `featherFade`, hence `g.coverage/cA/cB/alpha`, and `g.film` feeds the S term; the probe measures the rendered result | ✓ FLOWING |
| Probe capture | `edgeAcross { offsets, cover, ink }` / `edgeTiling.enclosed` | Live headless-Chrome WebGL render of the real `bristle-round` stroke | Yes — 281 offsets of real rendered coverage/ink; blank profiles fail | ✓ FLOWING |

No value in the chain ends in a hardcoded literal or a mock; the only constants are the declared neutral defaults (0 / 50 canonical, 0 / 0.5 engine) which are the law's neutral point.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package test suite (incl. the 147-test probe harness, twin, params, records, shader pins) | `pnpm --dir packages/efx-watercolor exec vitest run` | 1057 passed, 8 skipped, 0 failed | ✓ PASS |
| Package typecheck | `pnpm --dir packages/efx-watercolor exec tsc --noEmit` | exit 0, clean | ✓ PASS |
| Phase-touched app test files | `pnpm --dir app exec vitest run src/components/physic-paint/view/{AquarelleGlobalsPanel,aquarelleParamVisibility,brushGroupMedium,mediumSelection}.test.ts` | 4 files, 95 passed, 3 skipped (pre-existing skips) | ✓ PASS |
| App typecheck | `pnpm --dir app exec tsc --noEmit` | exit 0, clean | ✓ PASS |
| Full app suite | `pnpm --dir app exec vitest run` | fails in `app/src/lib/physicPaintBridge.test.ts` — run 1: "answers success when the catalog publish rejects after the mutation landed (WR-04)" + one unhandled `unregisterListener` rejection; run 2: "removes its one-shot listener when no receiver answers (bounded wait)" 20 s timeout. Different test fails per run; the file passes in isolation (186 passed, 1 skipped) and the timing test passes alone. | ⚠️ PRE-EXISTING FLAKE — not a gap (see Observations) |

### Probe Execution

The phase's probe is the headless-Chrome medium-engine harness (`run.mjs` capture + `compare.mjs` evaluation), not a `scripts/*/tests/probe-*.sh` script. Every gate below was executed in this verification; captures are in `/tmp/medium-engine/`, baselines in `packages/efx-watercolor/probe/medium-engine/baselines/`.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Identity (0,0) | `node .../run.mjs --gate edge-transparency-neutral --scenario edge-transparency --edge 0 --falloff 0 --size 1080` then `node .../compare.mjs edge-transparency-neutral` | PASS — digests `21171475/3ebe1b9d/fb026f34/606376d0` equal the `d509a886d` baseline; all 12 compared fields equal | PASS |
| Identity (0,100) | same with `--gate edge-transparency-neutral-broad --falloff 100` | PASS — same four digests; all 12 fields equal | PASS |
| Sweep broad (100,0) | `run.mjs --gate edge-transparency-broad --edge 100 --falloff 0` then `compare.mjs edge-transparency-broad --differs-from edge-transparency-neutral` | PASS — all four digests differ; core 1.0000; mid 0.3200 (expected 0.2929, Δ +0.0271); rim 0.0000 = 1 − amount; ink rim < core; enclosure bars hold | PASS |
| Sweep linear (100,50) | same with `--gate edge-transparency-linear --falloff 50` | PASS — all four digests differ; mid 0.3943 (expected 0.5, Δ −0.1057); rim 0.0000; ink direction holds | PASS |
| Sweep rim (100,100) | same with `--gate edge-transparency-rim --falloff 100` | PASS — all four digests differ; mid 0.6316 (expected 0.75, Δ −0.1184); rim 0.0000; ink direction holds | PASS |
| Negative doctored captures (fail-closed proof) | five doctored captures (`ujb-doctor-{blank,missing,notiling,unfaded,nan}`) through `compare.mjs <gate> --differs-from edge-transparency-neutral` | All FAIL with the correct named invariant: blank coverage profile; missing `edgeAcross`; missing `edgeTiling.enclosed`; film never reaches its rim floor; `edgeAmount` null | PASS (rejection works) |
| Probe source/harness pins | included in the package suite (`probe/medium-engine/harness.test.ts`) | 147 tests green, including the executed comparator fixtures and the three alpha-law direction pins | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| — | — | No requirement IDs declared (`requirements: []` in the PLAN frontmatter); this is a quick task with no `REQUIREMENTS.md` mapping | N/A | Verified: no `261124-ujb` entry in `.planning/REQUIREMENTS.md`. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` markers in any of the 22 changed files; no newly added `describe.skip` / `it.skip` (the 8 package and 3 app skips are pre-existing and untouched); no new empty-return stubs. |

## Observations (non-blocking)

1. **Probe discrimination margin at adjacent falloff settings (WARNING).** The measured mid stations are 0.3200 (broad), 0.3943 (linear), 0.6316 (rim). Each passes its own 0.12 station bar against its expected landmark, the ordering is correct, and the extremes are separated by 0.3116. But the adjacent broad↔linear separation is 0.0743 — below the 0.12 station tolerance — and the rim margin is thin (0.1184 of 0.12). Consequence: from a single capture, the comparator cannot distinguish a falloff-0 stroke from a falloff-50 stroke; the harness's executed wrong-falloff fixture only proves rejection across the extreme gap (broad profile claimed as rim, miss 0.457). The implementation itself is exact (executed unit tests pin 0.5 / 1 / 2 and the 0.293 / 0.5 / 0.75 landmarks), and the systematic measurement bias is the probe's station calibration/rounding, not a law violation — the plan's own Task 3 done-bar and the spec's probe requirement (core unchanged, rim monotone, neutral byte-identical) both pass. Surfaced to the artist as an extra human check (compare 0 / 50 / 100 side by side); not a gap.
2. **Full app suite flake in an untouched file.** `app/src/lib/physicPaintBridge.test.ts` failed in two consecutive full-app runs with a different failing test each time (an unhandled `unregisterListener` rejection, then a 20 s timeout in the bounded-wait test). The file passes in isolation (186 passed, 1 skipped) and the timing test passes alone via `-t`; `git log d509a886d..HEAD -- app/src/lib/` is empty, so this quick did not touch it. Pre-existing timing sensitivity under parallel load; not attributable to this phase and not a gap.
3. **Truth 5 wording vs the medium model.** The truth says "the Gouache and Pen medium records"; the model has ONE acrylic medium record (`id: 'acrylic'`, displayed "Gouache") that backs both bristle brush responses (Gouache and Pen). Both responses carry the pair through the shared record and both tool contexts render the rows; the operative outcome (canonical params, Reset, re-pick) holds for both.
4. **Decision coverage: not evaluated** — the `check.decision-coverage-verify` query returned `could-not-parse` (total 0, evidence unreadable), so no counts are reported. Manual review: every CONTEXT.md decision is honored — D-01 (params ride the medium record; no per-stroke schema change), D-03 (re-pick resets via `applyAquarelleMedium`), falloff direction 0 = broad / 100 = rim, silhouette-unit normalisation `u = clamp(lateral / uFeatherEdge, 0, 1)`, `uEdgeStart = 0.55` silhouette-relative, and the beyond-silhouette clamp by design.

## Human Verification Required

1. **UAT row 1** — Gouache, Edge transparency 0, falloff 0 and 100: render byte-identical to before the change (the automated identity gates already prove bit-identity; confirm on screen).
2. **UAT row 2** — Edge transparency 50, falloff 50: core unchanged, rim half-transparent, smooth ramp over the outer half; no banding on a curved S-stroke.
3. **UAT row 3** — Edge transparency 100, falloff 100: the middle band stays ~75 % opaque, the fade hugs the silhouette; the rim is inert (does not erase paint already on the sheet).
4. **UAT row 4** — Edge transparency 100, falloff 0: transparency reaches the middle band (~29 % film); soft airbrush look; centreline stays full.
5. **UAT row 5** — Over a committed stroke on a fresh key, amount 100 / falloff 50: the rim reveals the base; no milky/white halo.
6. **UAT row 6** — Leave the key, reopen, paint on the restored sheet: documented limitation accepted (the sheet's own paint is replaced under the translucent band, not glazed).
7. **UAT row 7** — Watercolor: rows absent, render identical.
8. **UAT row 8** — Leave/reopen + forced re-render, and Undo/Redo: the bake matches the live view at the same frame.
9. **UAT row 9** — Feather 0 / 85 × falloff 0 / 100: the laws compose; no seam at the stroke caps or along the rim.
10. **Extra (probe margin)** — Paint falloff 0, 50 and 100 side by side at amount 100: confirm the three shapes read visibly distinct, in particular broad (0) versus linear (50) (probe mid stations 0.320 vs 0.394, separation 0.074 below the 0.12 station tolerance; the law's landmarks are 0.293 / 0.5 / 0.75).

## Gaps Summary

No automated gaps. All 8 must-haves are verified against HEAD: the amount-0 render is byte-identical to the pre-change engine (digests match the `d509a886d` baselines exactly), the film scales the whole carried film (coverage, cA, cB, alpha) and the S term rides `g.film`, the landmark law is pinned exactly by executed unit tests and matched by the probe sweeps within tolerance, both params are canonical across the records with Reset and re-pick coverage, the rows are acrylic-only, the silhouette/threshold block is untouched, and the visible-alpha contract holds in both directions with a shared predicate. Both documented deviations were judged against the law and hold (the arithmetic form is bit-identical at amount 0 with no NaN path; the film-domain calibration is fail-closed on five doctored captures and leaves the identity path on the reference rim). One probe-margin observation (adjacent falloff discrimination) and one pre-existing app-suite flake are recorded above; neither is a phase gap. UAT rows 1-9 (plus the falloff-distinctness check) remain the human hand-off, so the status is `human_needed`, not `passed`.

---

_Verified: 2026-11-24T22:24:03Z_
_Verifier: Claude (gsd-verifier)_
