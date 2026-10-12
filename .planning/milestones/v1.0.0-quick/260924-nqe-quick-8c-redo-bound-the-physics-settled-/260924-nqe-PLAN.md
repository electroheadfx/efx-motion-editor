---
phase: quick-260924-nqe
plan: 260924-nqe
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
  - packages/efx-physic-paint/src/core/wet-layer.ts
  - packages/efx-physic-paint/src/brush/paint.ts    # CONDITIONAL — ribbon-geometry pass-through at the three physics transferToWetLayerClipped call sites ONLY; Normal-mode raster logic must show an empty diff region
  - .planning/quick/260924-nqe-quick-8c-redo-bound-the-physics-settled-/260924-nqe-SUMMARY.md
autonomous: true
requirements: []
estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "Physics mode at default water: the settled stroke silhouette lands on the drawn preview ribbon envelope within antialiasing tolerance (bound 2r + 2px), with pressure taper preserved."
    - "The stroke body deposits exactly as in the reverted base build — body-pixel deposit alpha unmodulated at every water level; no wash-out, marks fully opaque side-by-side against the reverted build."
    - "waterAmount remains the visible geometric spread control: w10/w50/w90 = 6/8/9 strict monotone law stands (tighten to ribbon when water goes down, deliberate feather when it goes up)."
    - "Diffusion keeps its texture job: wet-edge feathering, soft edges, and granulation remain on the settled mark — the bound is geometric, never a hard binary stamp."
    - "Deterministic stop-motion law: identical gesture + params settles to a byte-identical footprint (PIN 3), no boil."
    - "Normal mode raster, brush cursor ring, committed stroke geometry, and the 260924-koa preview ribbon (canvas.ts / strokePreviewRibbon) are unchanged; no new UI, no new dependencies."
  artifacts:
    - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts — restored stage-wise harness extended with PIN 0 (body-alpha floor, whole stroke) alongside PIN 1-3; MUST remain .test.ts
    - packages/efx-physic-paint/src/core/wet-layer.ts — geometric deposit clip inside transferToWetLayerClipped (single seam)
    - .planning/quick/260924-nqe-quick-8c-redo-bound-the-physics-settled-/260924-nqe-SUMMARY.md — RED evidence, before/after widths, body-alpha measurements, gates, STOP evaluation
  key_links:
    - "packages/efx-physic-paint/src/core/wet-layer.ts transferToWetLayerClipped — the guilty seam per m7w verdict (deposit +2px of +3px); the geometric clip lives here"
    - "packages/efx-physic-paint/src/brush/paint.ts physics wet-transfer call sites (~529, ~576, ~642) — where curve+radius/ribbon polygon are already in scope; CONDITIONAL geometry pass-through only"
    - "packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts — harness restored at af621f91, RED at base (2 failed | 2 passed); extend, never rebuild"
    - "Preview law locked by 260924-koa: packages/efx-physic-paint/src/render/canvas.ts + canvas.strokePreviewRibbon.test.ts are read-only for this quick"
---

<objective>
Bound the Physics-mode settled-stroke footprint onto the preview ribbon GEOMETRICALLY — clip the production deposit to the ribbon polygon/radius at the raster stage — while leaving stroke-body deposit alpha byte-for-byte untouched, and close the opacity blind spot that let m7w's alpha-carry GREEN pass all width pins while destroying mark visibility.

Purpose: m7w (260924-m7w, closed UAT-FAILED) proved the diagnosis (cite, do NOT redo): seam (a) deposit `transferToWetLayerClipped` deposits the raster's AA fringe at alpha ≈ 941 ≫ visibility floor 125 → +2px of +3px inflation (W_visible 9 vs ribbon 2r=6); fluid settle +1px; compositor 0. Its GREEN 24f40261 hid the fringe by an ALPHA carry (waterAmount^6) that also crushed stroke-body opacity → quasi-invisible live marks; reverted (1648658b); harness + width pins restored RED-at-base (af621f91) = correct TDD state. This redo adds the missing body-opacity pin FIRST, then bounds extent by clipping deposit geometry — never by scaling deposit alpha.

Output: PIN 0 (body-alpha floor) committed RED-first alongside confirmed RED-at-base pins 1-2, a geometric deposit clip at the single guilty seam, and measurements + gates + STOP evaluation in 260924-nqe-SUMMARY.md.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Carry-over diagnosis (CITE, do not redo) — m7w SUMMARY has the stage-wise width table + mechanism:
@.planning/quick/260924-m7w-quick-8b-physics-stroke-settles-bolder-t/260924-m7w-SUMMARY.md
# m7w plan (harness design reference):
@.planning/quick/260924-m7w-quick-8b-physics-stroke-settles-bolder-t/260924-m7w-PLAN.md

# Proven test invocation (never watch, .test.ts only, no one-off configs):
#   cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts

# Live observation at planning time (mutable-scope authority):
#   wet-layer.ts transferToWetLayerClipped (line 401): deposit loop filters a >= 20, writes (a/255)*3000 — no ribbon geometry available inside the function today.
#   paint.ts physics wet-transfer call sites (~529, ~576, ~642): curve, radius, and the undeformed ribbon polygon (base = ribbon(curve, radius, 0.8, hasPenInput)) are already in scope at each site.
#   Therefore a geometric clip requires threading ribbon geometry from those physics call sites into transferToWetLayerClipped (argument pass-through only). The Normal-mode raster path (basic brush, no wet transfer) must remain untouched — guardrail below checks the diff region.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — PIN 0 body-alpha floor + confirm existing pins RED-at-base (tests-only commit)</name>
  <files>packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts, .planning/quick/260924-nqe-quick-8c-redo-bound-the-physics-settled-/260924-nqe-SUMMARY.md</files>
  <behavior>
    - PIN 0 deposit body floor (PASSES at base — this is the guard whose absence let m7w GREEN pass): for every waterAmount in {10, 50, 90}, paper=null, after the production transfer stage, EVERY raster pixel geometrically inside the ribbon (the solid body rows) has deposited wet.alpha equal to the unmodulated expectation (a/255)*3000 times the harness's known transfer count, within 1% (min ratio in [0.99, 1.01]) — base is exactly the unmodulated formula, so this IS "unchanged vs base"; any carry/scale on body pixels (m7w coreCarry-style, water-dependent, or blanket) fails it
    - PIN 0b body visibility floor (PASSES at base): after K settle ticks, mean wet.alpha (and mean wetDisplayAlpha) over the body rows stays >= 0.95 x the base-calibrated value Task 1 logs for each water — catches opacity destroyed anywhere between deposit and display, not just at deposit
    - Harness raster extension: the current synthetic raster is solid a=255 body + a=80 outside fringe only — m7w's crushed population was partial-alpha pixels INSIDE the stroke (production grain/deform layers accumulate at sub-255 alphas). Add at least one interior body row with partial alpha (e.g. a=180 or 200, still inside the ribbon polygon) so PIN 0 covers the crushed population, and re-confirm the a=255 rows too. Recalibrate/log base measurements for ALL pins after this raster change; PIN 1's bound math (ribbon 2r=6, bound 8) is unchanged — the added row is interior, it does not widen the cross-section
    - PIN 1 (expect FAIL at base, unchanged): default-water W_visible <= 8px
    - PIN 2 (expect FAIL at base, unchanged): width(90) > width(50) > width(10)
    - PIN 3 (expect PASS, control): byte-identical footprints across identical runs
  </behavior>
  <action>Extend the restored m7w harness (physicsSettledFootprint.test.ts at af621f91 — extend it, do NOT rebuild, do NOT re-run the seam diagnosis: verdict seam (a) is settled per m7w SUMMARY, cite it) with PIN 0 as specified in the behavior block. Steps: (1) add the interior partial-alpha body row to the synthetic production-ribbon raster model; (2) implement the deposit body-floor assertion (ratio vs unmodulated expectation, per water, paper=null) and the post-settle body visibility floor, logging the base-calibrated means the floor references; (3) run the file and record RED evidence in a new 260924-nqe-SUMMARY.md: command, per-pin pass/fail, observed base widths (expected: PIN 1 + PIN 2 FAIL, sweep + PIN 0 + PIN 3 PASS — suite exit 1 = RED-at-base, correct TDD state); (4) commit RED with ONLY the test file + SUMMARY — production (wet-layer.ts, paint.ts, canvas.ts) diff must be empty at this commit. GUARDRAILS: zero production edits in this task; canvas.ts / strokePreviewRibbon / paint.ts untouched; never loosen any existing pin bound to make the suite behave — Task 1 changes add coverage only. Note for the record: PIN 0 passing at base is expected and required — it is the floor m7w's alpha-carry GREEN would have failed (that fix scaled body deposit down); it stays green through Task 2 or GREEN is invalid.</action>
  <verify>
    <automated>cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts</automated>
  </verify>
  <done>RED commit exists with test + SUMMARY only (git diff empty for wet-layer.ts, paint.ts, canvas.ts, fluids.ts, compositor.ts); suite exits 1: PIN 1 and PIN 2 failed at base with observed widths in the output, PIN 0 + PIN 3 + sweep passed; PIN 0's body rows include a partial-alpha interior row; base-calibrated body means logged; SUMMARY carries RED evidence and cites the m7w verdict (no re-diagnosis).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — geometric deposit clip at the seam, dual gate (widths AND body alpha), STOP clause</name>
  <files>packages/efx-physic-paint/src/core/wet-layer.ts, packages/efx-physic-paint/src/brush/paint.ts, packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts, .planning/quick/260924-nqe-quick-8c-redo-bound-the-physics-settled-/260924-nqe-SUMMARY.md</files>
  <action>Implement the envelope bound GEOMETRICALLY at the single guilty seam: extend transferToWetLayerClipped (wet-layer.ts) with a ribbon-geometry clip — deposit a pixel only if it lies inside the ribbon polygon (or within centerline distance <= radius + feather margin); pixels outside deposit nothing. For pixels that pass the clip, the deposit math stays exactly as base: depositAlpha = (a/255) * 3000, D-08 paper adsorption, D-10 mixing, Porter-Duff accumulation all untouched — the fix removes pixels by geometry, it never scales, powers, or otherwise modulates any alpha value. Water stays the spread control in RADIUS space: the feather margin beyond the ribbon polygon is a small water-coupled geometric distance (0 extra at w10 so the mark tightens to the ribbon; ~+1px at w50; up to ~+1.5-2px at w90) calibrated so the m7w law w10/w50/w90 = 6/8/9 strict monotone holds after settle — a constant margin at every water fails PIN 2 and is not acceptable. Threading (live-observed scope): the geometry is not available inside wet-layer today, so add a geometry parameter to transferToWetLayerClipped and pass it at the three physics wet-transfer call sites in brush/paint.ts (~529, ~576, ~642) where curve/radius/the undeformed ribbon polygon are already in scope — argument pass-through only; do not restructure the raster generators, and do not change any code path that does not call transferToWetLayerClipped (the Normal-mode basic-brush raster is out of scope and must show an empty diff region). Harness: point PIN 0-3 at the new signature passing the same ribbon envelope the synthetic raster models; no assertion may be weakened to go green (PIN 0 floors, PIN 1 bound 8px, PIN 2 strict monotone, PIN 3 determinism all stay as committed in Task 1). Determinism: no RNG, no time-based branching in the clip. GUARDRAILS: canvas.ts + canvas.strokePreviewRibbon.test.ts untouched (260924-koa law); no new UI, no new dependencies, no backward-compat shims; fluids.ts / compositor.ts untouched (verdict is seam a); preview ribbon, brush cursor, committed stroke geometry unchanged. STOP CLAUSE (mandatory, report — do NOT ship): if the geometric clip cannot hold the envelope (PIN 1/2 green) WITHOUT hurting the wet look — granulation, soft edges, wet-edge feathering visibly degrade beyond what the +2px antialiasing tolerance absorbs — OR if holding it would require any alpha-space trick, then HALT before committing GREEN: leave production reverted-to-base, append a "STOP — geometric clip rejected" section to 260924-nqe-SUMMARY.md describing what broke (with measured widths + which texture died), and return control. Falling back to alpha modulation to pass the width pins is forbidden under every circumstance — that is exactly the m7w failure. After a passing implementation: run the dual GREEN gate (PIN 1 bound AND PIN 0 body floor simultaneously), then the package suite and app suite; append before/after width table per water, body-alpha measurements (deposit ratio + settle visibility vs Task 1 base logs), and gate results to the SUMMARY; final status automated-ready for the user's 6-row native UAT.</action>
  <verify>
    <automated>cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts && ../../app/node_modules/.bin/vitest run && cd ../../app && npx vitest run</automated>
  </verify>
  <done>Dual GREEN gate: PIN 1 (default-water W_visible <= 8), PIN 2 (6/8/9 strict monotone), PIN 3 (determinism), PIN 0 + 0b (body deposit ratio within 1% of unmodulated at every water; post-settle body visibility >= 0.95x base) — all green in one run; package suite green (known pre-existing liveAlphaCache failure remains the only deferred item if still failing at base); app suite green; guardrail diff empty for canvas.ts, canvas.strokePreviewRibbon.test.ts, fluids.ts, compositor.ts; paint.ts diff contains only ribbon-geometry argument pass-through at the three physics transferToWetLayerClipped call sites (no Normal-mode logic changes); the ONLY production logic changed is inside transferToWetLayerClipped; SUMMARY carries before/after widths per water, body-alpha evidence, RED evidence, gates, and the STOP evaluation; no new UI, no new dependencies. Final status: automated-ready — native UAT (6 rows: default-water ribbon match with taper; body fully as opaque as the reverted build side-by-side; Normal unchanged; water up/down spread; two identical strokes held-pose identical footprint; wet edges + granulation + cursor ring) is run by the user after GREEN.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test → production pipeline | The harness drives the real transfer/settle/display code headlessly with synthetic buffers; no user content or network data crosses here |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-nqe-01 | Denial of Service | physicsSettledFootprint.test.ts sim ticks | low | mitigate | Canvas stays 128x64, settle ticks capped at engine-equivalent K; footprint file must run < 60s |
| T-nqe-02 | Tampering | geometric clip in transferToWetLayerClipped | high | mitigate | Dual GREEN gate — width pins AND PIN 0 body-alpha floor must pass in the same run; PIN 0 floors committed RED-first and may never be loosened; texture guard (wet edges/granulation survive) asserted analytically + 6-row native UAT |
| T-nqe-03 | Tampering | geometry pass-through in brush/paint.ts | medium | mitigate | Diff-region guardrail: paint.ts changes limited to argument pass-through at the three physics transfer call sites; Normal-mode path, canvas.ts, strokePreviewRibbon show empty diffs; full app suite must pass |
| T-nqe-04 | Information Disclosure | none | low | accept | No network, auth, file-IO, or schema surface in this quick |
| T-nqe-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this quick; any install attempt is out of scope and must be rejected |
</threat_model>

<verification>
1. RED-first ordering: Task 1 commit contains only test + SUMMARY; production diff empty at RED; suite exits 1 with PIN 1 + PIN 2 failed and PIN 0 + PIN 3 passed.
2. Dual GREEN gate: one run of the footprint file shows width pins AND body-alpha pin green simultaneously — width-only green is not a pass.
3. Guardrail sweep: git diff empty for packages/efx-physic-paint/src/render/canvas.ts, canvas.strokePreviewRibbon.test.ts, src/core/fluids.ts, src/render/compositor.ts; paint.ts diff region limited to transferToWetLayerClipped call-site arguments at the three physics sites.
4. Full gates: footprint file, package suite, app suite — vitest run only, from the proven invocations (never watch, no one-off configs).
5. STOP clause honored: if triggered, no GREEN commit exists, production is base-identical, and the SUMMARY carries the rejection report with measurements.
</verification>

<success_criteria>
Physics default-water settled silhouette lands on the preview ribbon within antialiasing (bound 8px) with taper; stroke body deposit unmodulated (PIN 0) — marks as opaque as the reverted build; w10/w50/w90 = 6/8/9 strict monotone; diffusion texture (wet edges, granulation) still present; deterministic; Normal mode, cursor, and koa preview untouched; SUMMARY carries RED evidence, before/after widths, body-alpha measurements, gates, STOP evaluation. Final status: automated-ready — the user runs the 6-row native UAT live.
</success_criteria>

<output>
Create `.planning/quick/260924-nqe-quick-8c-redo-bound-the-physics-settled-/260924-nqe-SUMMARY.md` when done (Task 1 seeds RED evidence; Task 2 completes measurements, gates, and STOP evaluation).
</output>
