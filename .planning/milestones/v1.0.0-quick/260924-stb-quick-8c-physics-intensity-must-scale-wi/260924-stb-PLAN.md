---
phase: quick-260924-stb
plan: 260924-stb
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-VERDICT.md
  - .planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-SUMMARY.md
  - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts
  - packages/efx-physic-paint/src/core/wet-layer.ts
  - packages/efx-physic-paint/src/core/fluids.ts
  - packages/efx-physic-paint/src/brush/paint.ts
  - packages/efx-physic-paint/src/types.ts
autonomous: true
requirements: [QUICK-260924-STB]
estimate:
  tokens: 42000
  raw_tokens: 28000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "A pressure gesture (thin→thick→thin) settles following the gesture: hairlines and taper ends stay within a tight calibrated tolerance of their drawn width and are not speckled mush; thick parts keep the Physics identity (wet edges, granulation, spread present) — asserted by the new width-contract pins, GREEN only after the verdict lands"
    - "Physics activity is monotone with local width along ONE stroke: absolute spread may grow with width, but relative inflation of the hairline cross-section never exceeds that of the thick cross-section (the brief's penalty law) — the base state fails this pin"
    - "PIN 0 / PIN 0b opacity law holds in EVERY cell of the new width pins (thin and thick regions, every water, both papers): deposit ratio ∈ [0.99, 1.01], post-settle body means ≥ 0.95× base — body visibility is never the lever (m7w 24f40261 failure class absent)"
    - "Two identical gestures settle to byte-identical footprints (W5 determinism pin) — no RNG, no wall-clock input in the width-scaling path (stop-motion law)"
    - "The VERDICT file exists with a named carrier, the quantities that scale, a joint-satisfiability argument for the proposed pin bounds, the STOP-clause verdict, and the locked-file list; if the verdict is 'requires re-architecting the Stam pipeline' then packages/ production files are untouched and the plan halts with a report"
    - "Locked surfaces intact at finish: DEPOSIT_KEEP_TIER stays 70 with include/exclude gate semantics; preview-ribbon test file, brush/stroke.ts, render/canvas.ts, render/compositor.ts, and the Normal-mode raster named in VERDICT all show empty git diffs; SUMMARY status is automated-ready with the native UAT rows listed — no claim of done before live UAT"
  artifacts:
    - .planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-VERDICT.md (Task 1 diagnosis verdict)
    - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts (new width→physics contract pins, RED at base)
    - .planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-SUMMARY.md (written, left uncommitted — orchestrator owns docs commit)
  key_links:
    - "VERDICT carrier decision → the new physicsWidthScaling.test.ts pin substrate (the RED→GREEN wire: bounds proposed in VERDICT, encoded in Task 2, made reachable by Task 3)"
    - "ribbon() per-point width law (stroke.ts:117-119) → whichever carrier carries local thickness past the raster seam (transferToWetLayerClipped sees only bitmap alpha today)"
    - "localFluidPhysicsStep velocity sources (fluids.ts height-equalization + edge-darkening read wet.alpha) → the quantity that actually scales spread — VERDICT must name it with line evidence"
    - "PIN 0 / PIN 0b hard gates → every cell of the new pins AND both pre-existing harnesses (any body-pixel movement halts GREEN)"
---

<objective>
Scale physics intensity with LOCAL stroke thickness so the calligraphic gesture survives settling: thin sections get minimal physics (the mark stays clean and as drawn), thick sections keep full paint behaviour — while body opacity, the preview ribbon, Normal mode, and the 260924-rm2 keep-gate stay untouched.

Purpose: user decision 2026-09-24 — the pen pressure IS the gesture. Today the transfer writes wetness uniformly per pixel (`core/wet-layer.ts`) and diffusion spreads in absolute pixels, so a 2px hairline and a 20px downstroke get the same fuel and the hairline dies. This quick is diagnosis-first: Task 1 decides HOW local thickness is carried past the raster and WHICH quantities scale (STOP if the Stam pipeline must be re-architectured), Task 2 pins the width→physics contract RED, Task 3 lands the verdict GREEN under TDD.

Output: a VERDICT note in the plan directory, a new physicsWidthScaling.test.ts contract-pin suite (RED at base → GREEN after fix), the verdict's carrier + scaling landed in the physics core, and a SUMMARY with status automated-ready (native UAT rows for the user). No installs, no push, no UI.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/quick/260924-m7w-quick-8b-physics-stroke-settles-bolder-t/260924-m7w-SUMMARY.md
@.planning/quick/260924-nqe-quick-8c-redo-bound-the-physics-settled-/260924-nqe-SUMMARY.md
@.planning/quick/260924-pyp-measure-production-s-continuous-aa-raste/260924-pyp-SUMMARY.md
@.planning/quick/260924-rm2-land-the-deposit-cutoff-in-transfertowet/260924-rm2-SUMMARY.md
@packages/efx-physic-paint/src/core/wet-layer.ts
@packages/efx-physic-paint/src/core/fluids.ts
@packages/efx-physic-paint/src/brush/paint.ts
@packages/efx-physic-paint/src/brush/stroke.ts
@packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
@packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnosis — carrier + quantity verdict, no production code</name>
  <files>.planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-VERDICT.md</files>
  <action>DIAGNOSIS ONLY — zero code changes to production paths and zero test changes before the verdict exists. Write the verdict into `260924-stb-VERDICT.md` in this plan directory, with these required sections:

(1) `## Carrier verdict` — decide HOW local stroke thickness reaches the physics. The width law exists per-point (`ribbon()` in brush/stroke.ts: `w = halfWidth * max(0.1, pr)` with `pr = pressure * endTaper`) but dies at the raster: the three `transferToWetLayerClipped` call sites in brush/paint.ts hand the transfer only the offscreen bitmap, whose alpha is coverage, not width. Evaluate the four briefed options with line-level evidence: (a) per-point deposit path (note: `depositToWetLayer` exists but is the dead plan-prescribed reference — 5/5/5, no inflation, per m7w); (b) companion width mask/field built at the raster seam (paint.ts has `curve` + `radius` at all three call sites — where would the field live, who owns its lifecycle: new buffer on WetBuffers vs per-transfer argument); (c) distance/erosion field derived from the raster alpha inside the transfer or at settle time (deterministic, no caller change — what is the cost class, is it bounded to the stroke bounds); (d) weighting wetness/granulation writes by local ribbon radius (which requires a curve→pixel mapping). Name ONE winner, name the rejected options with the reason each lost, and state which production files the winner touches (this names the Task 3 edit set).

(2) `## Quantities that scale` — decide which quantities follow local width: the wetness write (spread fuel) in `transferToWetLayerClipped`; diffusion strength/iterations in `core/fluids.ts`; granulation/emboss strength. CRITICAL evidence to verify live (do not assume — read the code): `localFluidPhysicsStep` builds its velocity sources from `wet.alpha` (height equalization `waterHeight[...] = wet.alpha[...]` and edge darkening `wetMask` from `alpha > 20`), and wetness is only copied in/out via advection — nqe's structural proof says the local path has no water→settle coupling and wetness never feeds back. If spread is driven by the alpha field rather than wetness, state explicitly whether scaling the wetness write ALONE changes the settle at all (falsify or confirm with a scratch measurement — scratch files live in /tmp and are NEVER committed). Then name the quantity (or quantities) whose modulation actually moves the settle, the monotone deterministic scaling function f(localWidth), and how granulation/emboss is treated (in-scope or explicitly out — note D-08/D-09 paper adsorption multiplies depositAlpha, which the PIN 0 pins assert unmodulated at full opacity, so any granulation scaling must keep PIN 0/0b green in every cell).

(3) `## Pin bounds proposal` — the proposed bounds for the Task-2 contract pins so they are calibrated BEFORE any RED runs: W1 hairline absolute tolerance (tight — calibrated from a base measurement of the settled/drawn ratio on a thin cross-section vs a thick cross-section, which the brief says is much worse on thin today), W2 thick-still-spreads floor, W3 the monotone law (relative inflation of the thin cross-section ≤ relative inflation of the thick cross-section; absolute spread may grow with width). Prove JOINT SATISFIABILITY: show the proposed W1 tolerance implies W3 given the proposed W2 floor — if the pair cannot hold simultaneously under the proposed mechanism, re-calibrate now, not during GREEN. Base-state prediction per pin (which fail at base = the RED).

(4) `## STOP clause` — explicit verdict line. If carrying local thickness would require re-architecting the Stam pipeline (replacing the solver structure, per-region solver grids, changing grid topology or the velStep/advect contract itself — as opposed to modulating the velocity SOURCES feeding the existing solver), write `VERDICT: STOP — re-architecture required`, stop, and report without any further tasks. Modulating velocity-source strength (height-equalization/edge-darkening inputs) or deposit-time fuel while keeping the solver intact is NOT re-architecture. If STOP: Tasks 2 and 3 are skipped, no code exists, the report goes back to the user.

(5) `## Locked files` — the always-locked list for this quick: `render/canvas.strokePreviewRibbon.test.ts` + the preview ribbon law (260924-koa), `DEPOSIT_KEEP_TIER = 70` and its include/exclude gate semantics in wet-layer.ts, depositAlpha/strokeOpacity/strokeOpacity arithmetic (PIN 0 law), `brush/stroke.ts` committed ribbon geometry, `render/canvas.ts`, `render/compositor.ts`, plus the Normal-mode raster files — identify the Normal-mode raster path by reading the mode split (PhysicsMode in types.ts / EfxPaintEngine) and name its files here so Task 3 can diff-gate them.

(6) `## Live-scope authorizations` — any file outside the Task-1 edit-set guess that the diagnosis discovers is needed (MUTABLE-SCOPE #3786: scope only from this live observation), each with its evidence line.

Scratch measurement is allowed (uncommitted, /tmp only). Commit only the VERDICT file: `docs(260924-stb): diagnosis verdict — carrier + quantity + pin bounds`.</action>
  <verify>
    <automated>test -f /Users/lmarques/Dev/efx-motion-editor/.planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-VERDICT.md && grep -c '^## ' /Users/lmarques/Dev/efx-motion-editor/.planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-VERDICT.md && test -z "$(git -C /Users/lmarques/Dev/efx-motion-editor diff --name-only -- packages/)"</automated>
  </verify>
  <done>VERDICT.md exists with all 6 sections; it names one carrier with line-level evidence, the quantities that scale with the wetness-vs-alpha driver question explicitly answered, jointly satisfiable pin bounds with base-fail predictions, an explicit START-or-STOP verdict line, and the locked-file list including the Normal-mode raster files; `git diff --name-only -- packages/` is empty (zero production/test edits before the verdict).</done>
  <precondition>Working tree clean at 319b14f9; package suite has only the pre-existing EfxPaintEngine.liveAlphaCache.test.ts failure.</precondition>
  <reversibility rating="reversible">Read-only diagnosis plus one docs file.</reversibility>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RED — width→physics contract pins (tests only)</name>
  <files>packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts</files>
  <behavior>
    - W1 hairline: at the thin cross-section of a pressure gesture, settled visible width ≤ drawn width + VERDICT W1 tolerance — FAILS at base (thin strokes inflate far more than thick ones)
    - W3 monotone: relative inflation (W_visible/W_drawn − 1) at the thin cross-section ≤ relative inflation at the thick cross-section — FAILS at base (thin penalized harder than thick)
    - W2 thick physics: at the thick cross-section the mark still spreads and textures (absolute spread ≥ VERDICT W2 floor / texture d(b) present at default water) — PASSES at base (control: physics not disabled)
    - W4 PIN 0: body deposit ratio ∈ [0.99, 1.01] of (a/255)*3000 at body pixels of BOTH thin and thick regions, every water {10,50,90}, both papers; PIN 0b post-settle body meanAlpha AND meanDisplay ≥ 0.95× base-calibrated literals for both regions — PASSES at base (controls; must hold post-GREEN)
    - W5 determinism: two identical gesture runs → byte-identical deposit AND settled alpha digests — PASSES at base (control)
  </behavior>
  <action>TDD RED step — tests only, one new file, zero production edits. Create `packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts` (vitest collects `.test.ts` only — never `.test.tsx`).

Substrate: a pressure-varying gesture (thin→thick→thin along x) whose DRAWN width profile is known. Preferred: production geometry — build the curve with varying PenPoint.p, run it through `ribbon(curve, radius, 0.8, hasPenInput=true)` + the pyp analytic coverage-fill idiom (productionAaSettleMeasurement.test.ts shows the pattern: real Canvas2D is unavailable headless, ONLY the fill primitive is replaced). Self-contained: do NOT import helpers from the other test files. Drive the real production deposit (`transferToWetLayerClipped` with the keep-gate 70 as landed) and the real settle (`localFluidPhysicsStep`, engine-mirrored defaults: K_TICKS from localSpreadStrength 50, FLUID_CONFIG viscosity 0.0001 / omega_h 0.06 / darkening 0.1) and the real visibility gate (`wetDisplayAlpha`), exactly as the two existing harnesses do. Measure per-cross-section widths (W_drawn from the ribbon geometry, W_deposit, W_settle, W_visible via the ALPHA_FLOOR/VISIBLE_THRESH idiom) at a thin column and a thick column of the SAME stroke.

Encode exactly five pins using the VERDICT's proposed bounds (calibrated before RED — never re-calibrate after this commit): W1 (hairline tight tolerance), W2 (thick still spreads/textures — control), W3 (thin relative inflation ≤ thick relative inflation), W4 (PIN 0/0b body-opacity floors over BOTH regions × WATERS × PAPERS, mirroring the established ratio/bases-literals pattern), W5 (byte-identical digests across two runs). Every pin message carries the law text from the quick brief so the contract stays readable as the contract. Also run and assert the PRE-EXISTING suites stay green from this file's run context: physicsSettledFootprint PIN 0/0b/3 and the pyp production-path pins.

Record honest RED: run the new file and expect exactly the base-fail pins RED (W1 + W3 per VERDICT prediction) with every control green in the same run. If a predicted-RED pin is unexpectedly green at base, record `PINS_GREEN_AT_BIRTH` honestly with the measured numbers and report — never manufacture red or move a bound to engineer a failure.

Commit tests-only: `test(260924-stb): RED — width→physics contract pins (hairline tolerance, monotone inflation, PIN 0/0b, determinism)`.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsWidthScaling.test.ts; ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts src/core/productionAaSettleMeasurement.test.ts</automated>
  </verify>
  <done>New suite exits 1 with ONLY the predicted base-fail pins RED (W1 hairline tolerance, W3 monotone inflation — per VERDICT base predictions) and every control (W2, W4, W5) green in the same run; the two pre-existing harnesses unchanged and in their recorded base state; production untouched (`git diff --name-only -- packages/efx-physic-paint/src/core/wet-layer.ts packages/efx-physic-paint/src/core/fluids.ts packages/efx-physic-paint/src/brush/paint.ts` empty); tests-only RED commit exists.</done>
  <precondition>VERDICT committed with verdict ≠ STOP and pin bounds proposed; tree otherwise clean.</precondition>
  <reversibility rating="reversible">Tests-only commit; zero production edits by design.</reversibility>
</task>

<task type="auto" tdd="true">
  <name>Task 3: GREEN — land the verdict + verification battery + SUMMARY</name>
  <files>packages/efx-physic-paint/src/core/wet-layer.ts, packages/efx-physic-paint/src/core/fluids.ts, packages/efx-physic-paint/src/brush/paint.ts, packages/efx-physic-paint/src/types.ts, .planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-SUMMARY.md</files>
  <action>GREEN step — implement the VERDICT's carrier + quantity scaling exactly, then measure, then write the SUMMARY.

(1) Implement ONLY what the VERDICT names: the carrier (how local thickness reaches the transfer/settle) and the quantity modulation f(localWidth). The files listed above are the maximum edit set — any additional production file requires a VERDICT `## Live-scope authorizations` citation (MUTABLE-SCOPE #3786); an out-of-verdict production file in the diff is a STOP. Hard invariants while implementing: `DEPOSIT_KEEP_TIER = 70` and its include/exclude gate line stay semantically untouched; the deposit math `(a / 255) * 3000`, the strokeOpacity accumulation, and the D-08/D-09/D-10 deposit arithmetic keep their base expressions (PIN 0 law — m7w 24f40261 / revert 1648658b: the 260924-m7w failure was an alpha-carry that crushed body visibility while width pins stayed blind); the new path is deterministic — no Math.random, no Date/performance-clock input into any scaling decision (stop-motion law); any field computation is bounded to the stroke bounds / local bbox (same clip idiom as the transfer bounds) so settle cost stays in the existing envelope.

(2) Run the new suite — the Task-2 pins ARE the acceptance measurement. GREEN requires W1, W3, W2, W4, W5 all green together. STOP clauses (halt before any GREEN commit and report): PIN 0 ratio leaves [0.99, 1.01] or PIN 0b drops below 0.95× floors in ANY cell (body pixels moved); W2 turns red (physics disabled on thick strokes); W5 turns red (footprints diverge); the legacy pyp production-path pins or physicsSettledFootprint PIN 0/0b/3 regress; any locked file from the VERDICT list appears in the diff; determinism or keep-gate semantics moved.

(3) Run the full battery: (a) new width suite GREEN; (b) both pre-existing harnesses in their coherent state (pyp production-path pins green; legacy suite per its recorded deferred/dispositioned state — zero unexplained RED); (c) package-wide `cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run` — the ONLY acceptable failure is the pre-existing `EfxPaintEngine.liveAlphaCache.test.ts` (failing at base, deferred since 260924-koa), anything else → investigate, and if it traces to this fix → STOP before the SUMMARY; (d) guardrail diffs: `git diff --name-only` empty for the VERDICT locked list (preview ribbon test + canvas.ts + compositor.ts + brush/stroke.ts + Normal-mode raster files), wet-layer.ts diff free of keep-gate/deposit-arith changes unless the VERDICT carrier names wet-layer.ts for a different line, no package.json/pnpm-lock changes, no UI files.

(4) Commit GREEN atomically: `fix(260924-stb): scale physics activity with local stroke width per VERDICT` — production files named by the verdict + the new test file only, then the battery re-run green on the committed tree.

(5) Write `260924-stb-SUMMARY.md` (frontmatter: phase quick-260924-stb, plan 260924-stb, status: automated-ready, subsystem, metrics) containing: the VERDICT carry-over (carrier chosen, quantities that scale, why the rejected options lost, joint-satisfiability of bounds, STOP-clause verdict = not triggered with the reason); the mechanism actually shipped with line evidence; base→GREEN measurements per pin (W1/W3 RED numbers → green numbers; W2/W4/W5 controls); the PIN 0/0b zero-movement evidence across every cell; guardrail diff results; battery results incl. the pre-existing liveAlphaCache failure; citations to m7w (alpha-carry failure law), nqe (alpha-driven velocity structural evidence), pyp/rm2 (production-raster oracle + keep-gate 70 unchanged); and the native UAT rows verbatim below — with an explicit note that status is automated-ready, GREEN shipped, native UAT pending, no live UAT claimed. SUMMARY left uncommitted (orchestrator owns the docs commit); no push.

Native UAT rows (copy VERBATIM into SUMMARY):
1. Pressure gesture (thin→thick→thin): settled silhouette follows the gesture — hairlines and taper ends thin and clean, thick parts paint-like; side by side with the preview ribbon the silhouette reads the same gesture
2. Thin parts are not speckled mush and are not inflated up to some constant minimum width
3. Thick parts keep the Physics identity — wet edges, granulation, spread still present (physics not disabled)
4. One continuous stroke shows the gradient: physics follows local width ALONG the stroke, not a per-stroke average
5. Determinism: the same gesture produces the same footprint, pose after pose (no boil)
6. Body opacity unchanged — the stroke body is exactly as opaque as the pre-fix build (no wash-out; PIN 0 law)
7. Normal mode unchanged; water behaves as before (water is still not a width control — the PIN 2 deferral stays)</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsWidthScaling.test.ts src/core/productionAaSettleMeasurement.test.ts src/core/physicsSettledFootprint.test.ts; git diff --name-only -- packages/efx-physic-paint/src/render/canvas.ts packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts packages/efx-physic-paint/src/render/compositor.ts packages/efx-physic-paint/src/brush/stroke.ts</automated>
  </verify>
  <done>All three suites green (new width pins incl. W1/W3 + PIN 0/0b/5 controls; pyp production-path pins; legacy coherent state with zero unexplained RED); package suite shows only the pre-existing liveAlphaCache failure; locked-file diff output empty; keep-gate still tier 70 with base deposit arithmetic; GREEN commit contains only verdict-named production files + the new test; SUMMARY exists with status automated-ready, VERDICT carry-over, base→GREEN measurements, guardrail/battery results, and the 7 UAT rows verbatim; SUMMARY left uncommitted; no push; no claim of done before live UAT.</done>
  <precondition>Task 2 RED pins committed; VERDICT ≠ STOP; pin bounds never re-calibrated after RED.</precondition>
  <reversibility rating="costly">Changes physics settle behaviour — user-visible rendering change gated by native UAT; revertable by reverting the GREEN commit, but only live UAT proves the gesture survives.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test harness → physics core modules | the new width harness and the two existing harnesses drive `transferToWetLayerClipped` / `localFluidPhysicsStep` with locally generated buffers — no network, no untrusted input |
| executor edit surface → locked production files | the only sanctioned production edits are the VERDICT-named carrier/quantity files; preview ribbon, Normal-mode raster, keep-gate semantics, stroke geometry, canvas/compositor must stay out of every diff |
| package manager → supply chain | any install attempt crosses the legitimacy boundary with no Package Legitimacy Audit table present for this quick |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-stb-01 | Tampering | width scaling achieved by modulating deposit alpha / strokeOpacity / body coverage (m7w 24f40261 failure class) | high | mitigate | PIN 0 (ratio ∈ [0.99, 1.01]) and PIN 0b (≥ 0.95× floors) are hard asserted gates over BOTH regions × every water × both papers in the new pins and stay green in the pre-existing harnesses; any body movement is a Task-3 STOP before GREEN |
| T-stb-02 | Tampering | scope creep into locked surfaces (preview ribbon 260924-koa, Normal-mode raster, DEPOSIT_KEEP_TIER 70 gate, committed ribbon geometry) | high | mitigate | VERDICT names the edit set and the locked list (incl. Normal-mode files) before any edit; Task 2/3 gate on `git diff --name-only` over that list; an out-of-verdict production file in a diff halts the plan |
| T-stb-03 | Repudiation | contract pins reshaped after RED — W1 tolerance raised or W3 law restated to engineer green | medium | mitigate | bounds calibrated once in VERDICT before RED, never re-calibrated (Task precondition); law text from the quick brief preserved in pin messages; SUMMARY enumerates base→GREEN numbers per pin |
| T-stb-04 | Tampering | package installs without a legitimacy audit (T-stb-SC) | high | mitigate | no installs in scope; Task 3 verifies no package.json / pnpm-lock changes |
| T-stb-05 | Tampering | non-deterministic input (RNG, wall-clock) entering the scaling path → boil across poses, breaking the stop-motion law | medium | mitigate | scaling decision must be a pure function of local width + existing deterministic fields; W5 byte-identical footprint pin runs twice per battery and is a STOP gate |
| T-stb-06 | Denial of Service | unbounded per-pixel field computation (e.g., distance/erosion pass) inflating settle time on large strokes | medium | mitigate | any field computation bounded to the stroke bounds / local bbox (existing clip idiom); package suite runtime stays in the existing envelope (battery compares against base) |
| T-stb-07 | Information Disclosure | none — local vitest runs, no network, no auth, no user data | low | accept | no external I/O in scope |
</threat_model>

<verification>
- RED gate: `cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsWidthScaling.test.ts` exits 1 with W1 + W3 RED (base) and W2/W4/W5 controls green; pre-existing harnesses in recorded base state; production diff empty after Task 2.
- GREEN gate: same command plus both existing harnesses exits 0 — all five width pins green together, pyp production-path pins green, legacy coherent (zero unexplained RED).
- Package regression: `../../app/node_modules/.bin/vitest run` — only pre-existing `EfxPaintEngine.liveAlphaCache.test.ts` fails.
- Guardrails: `git diff --name-only` empty for canvas.ts, canvas.strokePreviewRibbon.test.ts, compositor.ts, brush/stroke.ts, and the VERDICT-named Normal-mode raster files; keep-gate still 70 with base deposit arithmetic; no installs; no push.
</verification>

<success_criteria>
- VERDICT answers both diagnosis questions (carrier; quantities) with line evidence, proves the pin bounds jointly satisfiable, and does not trigger the STOP clause (or halts the plan cleanly if it does).
- Width contract pins GREEN: hairline within tight tolerance of drawn width, thick strokes still spread and texture, monotone inflation law holds, PIN 0/0b hold in every cell, byte-identical determinism.
- Locked surfaces untouched; keep-gate 70 semantics intact; body opacity provably unchanged in both regions.
- SUMMARY status automated-ready with VERDICT carry-over, base→GREEN measurements, and the 7 native UAT rows verbatim; no done claim before live UAT.
</success_criteria>

<output>
Create `.planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-SUMMARY.md` when done (uncommitted — orchestrator owns the docs commit)
</output>
