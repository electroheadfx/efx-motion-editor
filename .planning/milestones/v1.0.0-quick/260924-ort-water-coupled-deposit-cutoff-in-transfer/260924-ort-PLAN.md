---
phase: quick-260924-ort
plan: 260924-ort
type: tdd
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
  - packages/efx-physic-paint/src/core/wet-layer.ts
autonomous: false
requirements: [QUICK-260924-ORT]
estimate:
  tokens: 40000
  raw_tokens: 25000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "Physics stroke at default water settles within the preview ribbon envelope (W_visible ≤ 2r + 2px, bound 8) while body pixels keep exact base deposit alpha (PIN 0 ratio ∈ [0.99, 1.01])"
    - "Water amount strictly modulates settled footprint width: W(90) > W(50) > W(10) on the graduated harness AND on the production transfer path"
    - "Stroke body post-settle opacity (alpha AND display) stays ≥ 0.95× the graduated-raster base means (PIN 0b) — no wash-out, no quasi-invisible marks"
    - "At default water the fluid settle still softens the edge: d(b) = W_settle − W_deposit ≥ 1 (wet-edge feather survives; cutoff is not a hard stamp)"
    - "Two identical strokes in a held pose produce byte-identical footprints (PIN 3, no boil)"
    - "Normal mode, preview ribbon, brush cursor, and stroke geometry are untouched"
  artifacts:
    - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
    - packages/efx-physic-paint/src/core/wet-layer.ts
  key_links:
    - "transferToWetLayerClipped water-coupled keep-threshold selects WHICH pixels deposit; deposited pixels use unchanged math (a/255)*3000"
    - "harness raster graduated fringe rows feed the real transferToWetLayerClipped (production math measured, not reimplemented)"
---

<objective>
Bound the Physics settled-stroke footprint onto the preview ribbon via a water-coupled pixel CUTOFF at the deposit gate in `transferToWetLayerClipped` — pixels are either deposited at full base alpha or excluded entirely. Never alpha modulation.

Purpose: close the m7w regression loop (seam (a): raster AA fringe deposits at alpha ≈ 941 ≫ floor 125, +2px of +3px inflation) with a geometric include/exclude mechanism. The nqe two-valued {6,9} structural proof applied only to the binary harness raster; graduating the fringe makes intermediate widths measurable and the dual gate (PIN 1 envelope ∧ PIN 2 monotone) reachable without touching alpha.

Output: graduated-harness test file with re-calibrated PIN 0b bases (RED at base for PIN 1/2), and a water-coupled cutoff in `wet-layer.ts` making all six pins GREEN while d(b) ≥ 1 at default water.

Carry-over (cite, do not redo): m7w verdict — guilty seam (a) = `transferToWetLayerClipped`, +2px of +3px; fluid settle +1px; compositor 0; ALPHA carry GREEN 24f40261 reverted 1648658b (user UAT-FAIL, quasi-invisible body). nqe STOP structural proof + texture evaluation documented in nqe SUMMARY — the binary-raster clauses are superseded by scope item 1 (graduated fringe), not refuted for production's continuous AA.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/quick/260924-m7w-quick-8b-physics-stroke-settles-bolder-t/260924-m7w-SUMMARY.md
@.planning/quick/260924-nqe-quick-8c-redo-bound-the-physics-settled-/260924-nqe-SUMMARY.md
@packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
@packages/efx-physic-paint/src/core/wet-layer.ts
</context>

<tasks>

<task type="tdd">
  <name>Task 1: Graduate the harness raster — multi-row AA fringe, re-pin PIN 0b at new base, confirm RED/GREEN split</name>
  <files>packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts</files>
  <behavior>
    - Raster: solid body rows 29..34 unchanged (incl. PARTIAL_ALPHA row 31 = 240); replace the single 1px AA fringe (alpha 80 at rows 28/35) with a graduated ramp — 3 fringe rows per side with strictly decreasing alpha toward the edge (e.g. inner→outer: 160, 110, 60 at rows 27/28/29-adjacent and mirrored 36/35/34-adjacent — exact literals chosen by the executor so the ramp is continuous, strictly monotone, and all fringe alphas ≥ 20 so the existing transfer keep-gate admits them at base). Bounds height grows to cover the new fringe rows.
    - PIN 0b re-calibration: run at base (zero production edits), record new BASE_BODY_MEAN_ALPHA / BASE_BODY_MEAN_DISPLAY literals from the graduated raster's own base measurements (paper=null, dense, per water {10,50,90}); floors remain 0.95× those NEW bases. Do NOT loosen the 0.95 factor and do NOT keep old-raster literals.
    - Expected suite state at base after Task 1 (production untouched): PIN 1 FAIL (W_visible > 8 at default water — graduated fringe deposits fully), PIN 2 FAIL (all waters equal — no coupling yet), PIN 0 PASS (body rows still exact (a/255)*3000), PIN 0b PASS (base measured = base floors), PIN 3 PASS (deterministic raster, no RNG), sweep PASS (24 cells measurable).
    - Sweep table must show intermediate-width headroom: W_deposit at base reflects body+all-fringe (wider than binary 8), proving the width space is no longer two-valued.
  </behavior>
  <action>Replace the binary fringe in `makeRasterImageData` with a 3-rows-per-side graduated AA ramp (strictly decreasing alpha, all ≥ 20); update `makeRasterBounds` height and any row-range comments. Re-run the suite at base with zero production edits, read the PIN 0b console output, and overwrite BASE_BODY_MEAN_ALPHA / BASE_BODY_MEAN_DISPLAY with the new measured literals (comment must state they are the graduated-raster base of 260924-ort). Do not touch wet-layer.ts, fluids.ts, compositor.ts, canvas.ts, or paint.ts in this task. Commit tests-only: `test(260924-ort): RED — graduated AA fringe raster, PIN 0b re-pinned at new base`.</action>
  <verify>
    <automated>cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts</automated>
  </verify>
  <done>Graduated raster in place; suite exits 1 with exactly PIN 1 + PIN 2 failed and PIN 0, PIN 0b, PIN 3, sweep passed; new PIN 0b base literals recorded in the test file; git diff empty for wet-layer.ts, fluids.ts, compositor.ts, canvas.ts, paint.ts; tests-only commit exists.</done>
  <reversibility rating="reversible">Test-file-only change; production untouched.</reversibility>
</task>

<task type="tdd">
  <name>Task 2: Water-coupled deposit CUTOFF in transferToWetLayerClipped — include/exclude pixels, all pins GREEN, texture + STOP gates</name>
  <files>packages/efx-physic-paint/src/core/wet-layer.ts, packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts</files>
  <behavior>
    - Cutoff gate: in transferToWetLayerClipped, replace the fixed `a < 20` keep with a water-coupled keep-threshold keepThreshold(waterAmount) (monotone non-increasing in water): low water → strict (fringe rows excluded, tight to ribbon body); default water → envelope bound holds (PIN 1: W_visible ≤ 8, both papers); high water → looser (more fringe rows included, strictly wider). Alternative permitted by the locked contract: centerline-distance feather — either way the gate decides WHICH pixels deposit.
    - Deposited pixels keep exact base math: depositAlpha = (a / 255) * 3000 with existing paper/subtractive/Porter-Duff/wetness writes byte-identical to base for any pixel that passes the gate. Zero alpha scaling anywhere.
    - PIN 1 GREEN: default-water W_visible ≤ 2r+2 (bound 8) on paper null AND synthetic.
    - PIN 2 GREEN: W(90) > W(50) > W(10) strictly on the graduated harness (production transfer path, dense, paper null).
    - PIN 0 GREEN: every body pixel ratio ∈ [0.99, 1.01] at every water (body rows never near the threshold at any water in {10,50,90}).
    - PIN 0b GREEN against the Task-1 re-calibrated literals (floors 0.95× graduated base) — if the cutoff moves these, it is alpha-adjacent and must STOP (see STOP clause).
    - PIN 3 GREEN: no RNG in the threshold law → deterministic digests.
    - Texture gate (hard): at default water d(b) = W_settle − W_deposit ≥ 1. Assert this explicitly in the test file (add to PIN 1 or a dedicated line) BEFORE going green.
  </behavior>
  <action>First add the d(b) ≥ 1 texture assertion to the test file and confirm the full suite still shows only PIN 1 + PIN 2 red (texture assertion is red-compatible at base because base d(b) = +1 already). Then edit ONLY `transferToWetLayerClipped` in wet-layer.ts: compute a water-coupled keep threshold and `continue` (skip the pixel entirely — no deposit, no wetness write) when `a` falls below it; body rows must pass at all tested waters. Never multiply depositAlpha by any water term (m7w failure mode — forbidden). Respect the STOP clauses below: HALT before any GREEN commit if (i) PIN 0 or PIN 0b fails at any water, (ii) the envelope cannot hold at default water while d(b) ≥ 1 (hard-stamp outcome), or (iii) PIN 2 cannot go strict without alpha tricks. On STOP: revert wet-layer.ts to Task-1 base, leave suite RED (PIN 1+2 failed), report the measured outcome table — do not ship. On full pass: commit `feat(260924-ort): water-coupled pixel cutoff at transfer deposit gate`.</action>
  <verify>
    <automated>cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts</automated>
  </verify>
  <done>Suite exits 0 — all pins green incl. explicit d(b) ≥ 1 at default water; guardrail `git diff` empty for canvas.ts, strokePreviewRibbon-related files, brush/paint.ts, fluids.ts, compositor.ts; diff in wet-layer.ts touches only transferToWetLayerClipped; no alpha-scaling term on depositAlpha; package suite baseline not regressed (`cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run` — sole pre-existing failure liveAlphaCache tolerated); GREEN commit exists (or STOP report if a STOP clause fired).</done>
  <reversibility rating="costly">Production deposit-gate change; guarded by 6 pins + texture gate + revert path in STOP clause.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Pure arithmetic branch inside an existing buffer write path; no network, auth, file-IO, schema, or package installs |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ort-01 | Tampering | wet-layer.ts transferToWetLayerClipped | low | accept | Threshold is a pure function of waterAmount + raster alpha; determinism pinned by PIN 3; no untrusted input crosses this path |
| T-ort-02 | Information Disclosure | — | low | accept | No new surface |
| T-ort-SC | Tampering | npm installs | high | mitigate | No package installs in this quick — gate not triggered |
</threat_model>

<verification>
- Harness command (all gates): `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts` — RED state after Task 1 (2 failed | rest passed), all green after Task 2.
- Package suite: `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run` — no new failures vs baseline (liveAlphaCache pre-existing).
- Guardrail diff: `git diff` empty for `canvas.ts`, `strokePreviewRibbon` tests, `brush/paint.ts`, `fluids.ts`, `compositor.ts`.
- Alpha-modulation scan: grep transferToWetLayerClipped body — depositAlpha assignment remains exactly `(a / 255) * 3000` with no water multiplier.
</verification>

<success_criteria>
1. Task 1 RED evidence: graduated raster committed tests-only; PIN 1 + PIN 2 red at base; PIN 0/0b/3 green with re-pinned graduated-base literals.
2. Task 2 GREEN: all six contract lines pass (PIN 0, 0b, 1, 2, 3, texture d(b) ≥ 1); only wet-layer.ts changed among production files; or an explicit STOP report with measured outcome table and production reverted.
3. Native UAT 6 rows left for the user (SUMMARY must list): (1) Physics default water — settled stroke matches preview ribbon side-by-side, taper visible; (2) stroke body FULLY as opaque as before, side-by-side with reverted build (no wash-out); (3) Normal mode unchanged; (4) water up spreads / water down tightens to ribbon; (5) two identical strokes in held pose → identical footprint (no boil); (6) wet edges + granulation present, cursor ring unchanged.
4. Executor does NOT commit docs; orchestrator owns the docs commit.
</success_criteria>

<output>
Create `.planning/quick/260924-ort-water-coupled-deposit-cutoff-in-transfer/260924-ort-SUMMARY.md` when done
</output>
