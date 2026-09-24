---
phase: quick-260924-pyp
plan: 260924-pyp
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
autonomous: false
requirements: [QUICK-260924-PYP]
estimate:
  tokens: 45000
  raw_tokens: 30000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "A complete outcome table (water 10/50/90 × tiers 20/200/130/70, per paper) with W_deposit, W_settle, W_visible, d(b), PIN 0 ratio, PIN 0b body means, and envelope check (W_visible ≤ 8) exists in SUMMARY.md BEFORE any decision is proposed"
    - "The measured substrate is production's real continuous AA fringe profile derived from production ribbon/deform geometry — the synthetic graduated 160/110/60 ramp is NOT the substrate; which substrate path was used is documented"
    - "PIN 0 (ratio ∈ [0.99, 1.01]) and PIN 0b (0.95× visibility floor) are reported for every measured cell; any config that moves either is recorded as a STOP finding for that config, pin bounds never loosen"
    - "Production is byte-identical at finish: git diff empty for wet-layer.ts, fluids.ts, compositor.ts, canvas.ts, paint.ts; strokePreviewRibbon untouched"
    - "The existing physicsSettledFootprint.test.ts suite still exits with 3 failed (PIN 1, PIN 2, texture) | 4 passed — base RED preserved, not fixed"
    - "SUMMARY.md carries status: incomplete and a STOP for the user decision (option 1 fluids.ts coupling vs land-the-ort-cutoff); no GREEN production commit exists"
  artifacts:
    - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
    - .planning/quick/260924-pyp-measure-production-s-continuous-aa-raste/260924-pyp-SUMMARY.md (written, left uncommitted — orchestrator owns docs commit)
  key_links:
    - "production ribbon()/deform geometry (brush/stroke.ts, seeded RNG) → analytic coverage AA profile → real transferToWetLayerClipped → real localFluidPhysicsStep (K=3) → real wetDisplayAlpha widths"
    - "in-harness tier filter (zero profile alpha < tier before transfer) ≡ raising transferToWetLayerClipped's keep-gate — nqe geometric include/exclude precedent, exact because `a` is only read after the gate for deposit math and wetness"
---

<objective>
Measure production's continuous AA raster settle end-to-end and produce the full outcome table — measurement only, then STOP for the user decision (fluids.ts coupling vs land-the-ort-cutoff).

Purpose: ort's cutoff outcome table was measured on the synthetic graduated ramp (rows 160/110/60); nqe's structural proof was measured on the binary harness raster. Neither answers how a cutoff behaves on the AA fringe profile the real rasterizer actually produces. This quick fills that evidence gap with zero production risk.

Output: a new sibling measurement .test.ts (production AA substrate + base/tier sweep + per-cell PIN 0/0b/envelope columns), a SUMMARY.md with the complete outcome table and status: incomplete (STOP). No production code change ships; no GREEN commit.

Substrate path decision (planning-time observation, mutable-scope authority): driving paint.ts's real Canvas2D fill headlessly is impractical in this environment — node exposes no OffscreenCanvas, no node-canvas/skia-canvas exists in node_modules, jsdom cannot rasterize without the canvas package, and the project precedent (paint.continuation.test.ts) stubs document.createElement with zeroed ImageData. Installing a canvas implementation is FORBIDDEN (no research phase, no Package Legitimacy Audit table → installs fall under the SC gate with no audit). Therefore constraint 4's documented fallback is authorized: reproduce production's actual AA fringe alpha profile from the real rasterizer's own inputs — production ribbon/deform geometry imported from brush/stroke.ts, production layer-accumulation schedule mirrored from createPaintStrokeRasterContinuationFromCurve — with only the Canvas2D fill primitive replaced by analytic sub-pixel polygon coverage. The path used MUST be documented in the harness header and SUMMARY. Never the synthetic 160/110/60 graduated ramp as substrate.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/quick/260924-ort-water-coupled-deposit-cutoff-in-transfer/260924-ort-SUMMARY.md
@.planning/quick/260924-nqe-quick-8c-redo-bound-the-physics-settled-/260924-nqe-SUMMARY.md
@.planning/quick/260924-m7w-quick-8b-physics-stroke-settles-bolder-t/260924-m7w-SUMMARY.md
@packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
@packages/efx-physic-paint/src/core/wet-layer.ts
@packages/efx-physic-paint/src/brush/paint.ts
@packages/efx-physic-paint/src/brush/stroke.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Production-AA substrate harness + base-tier (keep-gate 20) measurement</name>
  <files>packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts</files>
  <action>Create a NEW sibling test file (vitest collects only .test.ts). Do NOT modify physicsSettledFootprint.test.ts — its 3-failed | 4-passed base RED is constraint 9 and must survive untouched. Build the substrate: a straight dense stroke (x 16..112 step 3, y 32) through production `ribbon(curve, 3, 0.8, false)` and `deformN`/`deform` imported from brush/stroke.ts, with Math.random stubbed by an LCG seed (precedent: paint.continuation.test.ts run()) for PIN 3 determinism; mirror the layer accumulation schedule read from `createPaintStrokeRasterContinuationFromCurve` in paint.ts (pickup 0 branch: layers = round((22+15)/speedDeplete), lAlpha = min(0.08, 3/layers), the extra round(layers*0.2) soft passes at lAlpha*0.25; bristle traces excluded — document that choice in the header) — per layer compute analytic sub-pixel polygon coverage (supersample the deformed polygon; this replaces ONLY the ctx.fill() primitive, which is what Canvas2D antialiasing approximates) and source-over composite alpha onto an ImageData-like buffer, giving production's continuous AA fringe ramp at the polygon edges. Header comment must state the substrate path: "production geometry + production layer schedule + analytic coverage fill (real Canvas2D unavailable headless — no OffscreenCanvas/node-canvas; installs forbidden)" — plus "260924-pyp". Wire the profile through the REAL pipeline: fakeOffCtx.getImageData returns the profile → real `transferToWetLayerClipped` (base keep-gate 20, unchanged) → copy buffers → real `localFluidPhysicsStep` K=3 ticks with engineLocalBbox → widths via widthFromAlpha / widthVisible / wetDisplayAlpha at MID_X. Copy the small helpers (makeCurve-style points, makeSyntheticPaper, widthFromAlpha, widthVisible, engineLocalBbox, body-mean readers) into this file — do NOT import from physicsSettledFootprint.test.ts (importing registers its suites in this run). Body rows for PIN 0/0b = pixels at MID_X whose PROFILE alpha marks polygon interior (coverage-saturated, e.g. ≥ 245) — derive from the profile, never hardcode rows; PIN 0 expectation per body pixel = (profileAlpha/255)*3000 × transferCount, ratio ∈ [0.99, 1.01]. PIN 0b: measure post-settle body meanAlpha and meanDisplay per water; establish this substrate's base-tier (gate 20) means as BASE literals in-file (floors = 0.95×, factor never loosened, comment states they are the 260924-pyp production-AA base). Measure base tier × waters {10, 50, 90} × papers {null, synthetic} (dense), log a table with W_deposit, W_settle, W_visible, d(b), PIN 0 min/max ratio, PIN 0b means, envelope ≤ 8 check per cell. Add a determinism check: two identical runs → identical profile and settled alpha digests (PIN 3 equivalent). Sanity: profile must show a continuous multi-value AA fringe at the edges (several distinct sub-255 alpha levels per side) — if the profile comes out binary, the coverage supersampling is wrong; fix it before proceeding.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/productionAaSettleMeasurement.test.ts</automated>
  </verify>
  <done>New test file exists and passes with the base-tier table logged for all 6 cells (3 waters × 2 papers); profile shows a continuous AA ramp (not binary, not the 160/110/60 literals); PIN 0 ratios within [0.99, 1.01] on body pixels at every water; PIN 0b base literals recorded in-file; substrate path documented in header; git diff empty for wet-layer.ts, fluids.ts, compositor.ts, canvas.ts, paint.ts; tests-only commit `test(260924-pyp): production-AA substrate harness — base-tier outcome table`.</done>
  <precondition>Working tree clean at planning base; physicsSettledFootprint.test.ts reports 3 failed | 4 passed before any edit.</precondition>
  <reversibility rating="reversible">New test file only; zero production edits by design (in-harness measurement, no probe needed).</reversibility>
</task>

<task type="auto">
  <name>Task 2: Cutoff tier sweep 200/130/70 — in-harness include/exclude, full matrix with per-cell PIN 0/0b</name>
  <files>packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts</files>
  <action>Extend the Task-1 harness with tier filtering: before feeding the profile to transferToWetLayerClipped, zero every pixel whose profile alpha < tier (tiers: 20 = base, 200, 130, 70 applied to the production profile's OWN alpha ramp). This is exactly equivalent to raising transferToWetLayerClipped's keep-gate because `a` is read only after the gate for deposit math `(a/255)*3000` and the wetness write — included pixels keep byte-identical base math, excluded pixels never run (nqe precedent: geometric include/exclude ≡ threshold probe). Choose this in-harness equivalent over a temporary wet-layer.ts probe: it makes the byte-identical-at-finish constraint hold by construction with nothing to revert; if a deviation ever introduces a production probe anyway, it must be fully reverted before Task 3. Run the full matrix: waters {10, 50, 90} × tiers {20, 200, 130, 70}, paper=null dense as the mandatory minimum, paper=synthetic added if cheap (helpers already exist — expected cheap, include it). Per cell log/record: W_deposit, W_settle, W_visible, d(b) = W_settle − W_deposit, PIN 0 body ratio min/max, PIN 0b post-settle body meanAlpha + meanDisplay vs 0.95× floors, envelope check W_visible ≤ 2r+2px = 8. PIN 0 and PIN 0b are HARD gates in every cell: a tier×water config that moves either (ratio out of [0.99, 1.01], or means below floors) is recorded in the log as `STOP finding: tier=<t> water=<w> <pin> moved (<values>)` — never loosen a bound to make a cell pass. The texture metric stays d(b) as defined (redefining it as edge-softness is refused scope). Assert harness sanity (all cells measurable, widths > 0) so the run exits with a stable state; do not assert the envelope/monotone pins as pass/fail for GREEN — this quick produces the table, not a fix. Log the complete matrix as one marked table block `[260924-pyp] OUTCOME TABLE` for direct lift into SUMMARY.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/productionAaSettleMeasurement.test.ts</automated>
  </verify>
  <done>Run prints the `[260924-pyp] OUTCOME TABLE` with 12 cells (24 if synthetic included), every cell carrying all 7 required columns; any PIN 0/0b violations appear as `STOP finding` lines; determinism check still passes; git diff still empty for wet-layer.ts, fluids.ts, compositor.ts, canvas.ts, paint.ts; tests-only commit `test(260924-pyp): cutoff tier sweep on production AA profile — full outcome matrix`.</done>
  <reversibility rating="reversible">Test-file-only extension; tier filter lives in the harness, production untouched.</reversibility>
</task>

<task type="auto">
  <name>Task 3: Verification gates + SUMMARY outcome table + STOP for user decision</name>
  <files>.planning/quick/260924-pyp-measure-production-s-continuous-aa-raste/260924-pyp-SUMMARY.md</files>
  <action>Run the final verification battery: (1) the new measurement suite — capture the full OUTCOME TABLE output; (2) the existing suite `src/core/physicsSettledFootprint.test.ts` — must still report exactly 3 failed (PIN 1, PIN 2, texture) | 4 passed, exit 1 (base RED preserved, NOT fixed by this quick); (3) `git diff --name-only` over wet-layer.ts, fluids.ts, compositor.ts, canvas.ts, paint.ts (and canvas.strokePreviewRibbon.test.ts / strokePreviewRibbon as preview guardrail) — must be empty; if any temporary production probe was introduced despite Task 2's design, revert it now and re-verify empty before writing the SUMMARY. Then write SUMMARY.md (frontmatter: phase quick-260924-pyp, status: incomplete, metrics with tasks/commits counts) containing: carry-over citations (m7w seam (a) verdict + alpha-modulation failure 24f40261/1648658b, nqe two-valued proof scope, ort synthetic-ramp STOP clause ii), the substrate path used and why real Canvas2D was impractical headless, the COMPLETE outcome table lifted from the `[260924-pyp] OUTCOME TABLE` block (all cells, all columns, both papers if run), per-cell PIN 0/0b gate results with every STOP finding listed, d(b) values per cell (metric as-defined, no redefinition), and a `## STOP for user decision` section presenting exactly the two options: option 1 = water coupling inside fluids.ts (solver-level, previously out of scope) vs land-the-ort-cutoff (apply the include/exclude cutoff on production's real ramp, given what the table shows about d(b)/envelope texture). The SUMMARY must present the table BEFORE the decision section. Leave SUMMARY uncommitted (orchestrator owns the docs commit). Do not create any GREEN/production commit; do not push.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/productionAaSettleMeasurement.test.ts src/core/physicsSettledFootprint.test.ts; git diff --name-only -- packages/efx-physic-paint/src/core/wet-layer.ts packages/efx-physic-paint/src/core/fluids.ts packages/efx-physic-paint/src/render/compositor.ts packages/efx-physic-paint/src/render/canvas.ts packages/efx-physic-paint/src/brush/paint.ts</automated>
  </verify>
  <done>SUMMARY.md exists with status: incomplete, the full outcome table before the STOP section, both decision options listed, substrate path documented, all STOP findings (if any) enumerated; verification run shows existing suite 3 failed | 4 passed and empty production git diff; production byte-identical; no GREEN commit; SUMMARY left uncommitted.</done>
  <reversibility rating="reversible">Docs-only write plus read-only verification commands.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test harness → production modules | the new .test.ts imports and drives transferToWetLayerClipped / localFluidPhysicsStep / wetDisplayAlpha with harness-built buffers — inputs are locally generated, untrusted-network-free |
| package installs → supply chain | any attempt to add a canvas rasterizer (node-canvas, skia-canvas) crosses the install boundary with no Package Legitimacy Audit available |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-pyp-01 | Tampering | productionAaSettleMeasurement.test.ts → wet-layer/paint/fluids/compositor/canvas | high | mitigate | tier cutoff implemented as in-harness include/exclude only — no production probe by design; Task 3 gates on empty `git diff --name-only` for all five production files before SUMMARY is written |
| T-pyp-02 | Tampering | PIN 0 / PIN 0b bounds drift during calibration | medium | mitigate | floors fixed at 0.95× the substrate's own base-tier literals; ratio bounds fixed at [0.99, 1.01]; violations recorded as `STOP finding` lines, bounds never edited to pass |
| T-pyp-03 | Repudiation | substrate fidelity (table could be measured on the wrong ramp) | medium | mitigate | substrate derives from production ribbon()/deform + production layer schedule; header and SUMMARY document the exact path; Task 1 sanity requires a continuous multi-value AA fringe (rejects binary or literal 160/110/60 profiles) |
| T-pyp-04 | Denial of Service | supersampled coverage raster over 24 cells | low | accept | canvas is 128×64, profile built once per run and reused across tier cells; run stays well under 60s |
| T-pyp-05 | Information Disclosure | none — local measurement, no network, no auth, no user data | low | accept | no external I/O in scope |
| T-pyp-SC | Tampering | npm/pip/cargo installs | high | mitigate | no new packages permitted (research disabled, audit table absent); canvas implementations forbidden — substrate fallback uses analytic coverage in-harness instead; any install attempt is a hard stop for the user |
</threat_model>

<verification>
- New suite: `cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/productionAaSettleMeasurement.test.ts` prints `[260924-pyp] OUTCOME TABLE` with every required column per cell.
- Existing suite unchanged: same binary against `src/core/physicsSettledFootprint.test.ts` → 3 failed (PIN 1, PIN 2, texture) | 4 passed, exit 1.
- Production byte-identical: `git diff --name-only` empty for wet-layer.ts, fluids.ts, compositor.ts, canvas.ts, paint.ts; preview guardrail (strokePreviewRibbon) untouched.
- No GREEN production commit exists; only tests-only commits; SUMMARY uncommitted.
</verification>

<success_criteria>
- Outcome table complete (waters × tiers, per paper) with W_deposit / W_settle / W_visible / d(b) / PIN 0 / PIN 0b / envelope ≤ 8 before any decision text.
- PIN 0 and PIN 0b reported per cell; violations enumerated as STOP findings; no bound loosened.
- SUMMARY status: incomplete with STOP section offering fluids.ts coupling vs land-the-ort-cutoff.
- Production files byte-identical; base RED suite preserved; no alpha-modulated bound anywhere; substrate documented as production-derived.
</success_criteria>

<output>
Create `.planning/quick/260924-pyp-measure-production-s-continuous-aa-raste/260924-pyp-SUMMARY.md` when done (uncommitted — orchestrator owns the docs commit)
</output>
