---
phase: quick-260927-ton
plan: 260927-ton
type: tdd
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/brush/paint.edgeDetailWidthScale.test.ts
  - packages/efx-physic-paint/src/brush/stroke.ts
  - packages/efx-physic-paint/src/brush/paint.ts
  - packages/efx-physic-paint/src/brush/erase.ts
  - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts
  - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
  - .planning/quick/260927-ton-quick-8f-shape-detail-must-scale-with-lo/260927-ton-SUMMARY.md
autonomous: true
requirements: [QUICK-260927-TON]

estimate:
  tokens: 45000
  raw_tokens: 30000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Shape-detail deform amplitude follows local ribbon width: for the same gesture the maximum polygon-boundary deviation in a hairline region (p=0.1) is at most 0.30 of the maximum deviation in a thick-body region (p=1) — pinned RED at base where the ratio measures exactly 1.000, GREEN after wiring"
    - "Thick-body organic deformation is preserved, not uniformly reduced: the thick-region maximum deviation stays within [0.95, 3.0] x the today-formula variance (1.5 + sqrt(radius) * 0.9) * edgeMul under the constant-gauss stub — this control is green at base AND after GREEN, proving the slider's natural edge is untouched at full width"
    - "The taper ends deforms less than the body: near-start taper-region maximum deviation is at most 0.80 of the thick-body maximum (base = 1.000, RED) — tapers keep their clean silhouette"
    - "Every production deform site threads the local-width scale: paint pickup-less path, paint pickup segment path, paint single-color path, and erase all build the ribbon with the one shared scale-aware seam; the legacy uniform deform helpers are deleted with zero remaining call sites (scoped, comment-filtered grep)"
    - "Erase gets the same treatment (explicit decision recorded in Task 2): the erase mask follows the local-width law so a hairline erase cannot clear a full-variance wobble band outside the painted silhouette — Normal and Physics erase stay consistent with paint geometry"
    - "Regression laws hold: PIN 0 body opacity ratio 1.0000 and PIN 0b floors (m7w), the 260924-stb thickness field in fluids.ts and DEPOSIT_KEEP_TIER = 70, the 260925-b7c spreadCurveFor law, the 260925-dso no-grain/no-emboss pins, and the 260924-koa preview ribbon all show empty diffs or stay green — this is geometry deformation only, depositAlpha / strokeOpacity / body coverage are never scaled"
    - "Harness parity: both production-geometry substrates (physicsWidthScaling, productionAaSettleMeasurement) drive the SAME scale-aware seam as production, and every stb/b7c law gate passes at its EXISTING pre-calibrated bound — no bound is recalibrated in this quick; a failing law gate STOPs the plan with a measured report"
  artifacts:
    - packages/efx-physic-paint/src/brush/paint.edgeDetailWidthScale.test.ts (RED-first production-path amplitude pins)
    - packages/efx-physic-paint/src/brush/stroke.ts (ribbon scale channel + scale-aware deform seam)
    - .planning/quick/260927-ton-quick-8f-shape-detail-must-scale-with-lo/260927-ton-SUMMARY.md (status automated-ready, native UAT rows)
  key_links:
    - "ribbonWithScales (the ONE scale computation: s = max(0.1, pressure x endTaper) per curve point, mirrored exactly from ribbon's own w math) -> all four deform call sites (no divergent inline scale math)"
    - "the RED pin (measured amplitude ratio through renderPaintStroke) <-> GREEN wiring (the pin is the sole acceptance oracle for the law; nothing else measures amplitude)"
    - "production seam <-> the two engine-mirrored harness substrates (parity is what keeps the stb law gates proving production behavior)"
---

<objective>
Scale the Shape detail (`edgeDetail`) deformation amplitude by the local pressure/width along the stroke instead of applying the base-brush-radius variance uniformly to every ribbon vertex.

Purpose: today `variance = (1.5 + sqrt(radius) * 0.9) * edgeMul` is computed from the BASE brush size and `deformN` applies it identically at every vertex, so a 2px hairline is wobbled as hard as a 20px body — high slider values destroy thin strokes, low values read as pixel noise on them. The amplitude must follow the local width the same way 260924-stb made physics intensity follow local thickness: thick parts keep the natural organic edge, thin parts and tapers keep their silhouette, and one gesture shows the gradient.

Output: a production-path RED pin (hairline amplitude a small fraction of thick-body amplitude, thick-body amplitude unchanged) -> a scale channel in stroke.ts wired through all four deform sites (paint x3, erase x1) -> harness parity + full regression battery -> SUMMARY status automated-ready with native UAT rows. Geometry only: no opacity, no physics, no UI, no installs, no push.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-SUMMARY.md
@.planning/quick/260925-b7c-quick-8d-recalibrate-the-spread-scale-so/260925-b7c-SUMMARY.md

Key code anchors (read before editing):
- packages/efx-physic-paint/src/brush/stroke.ts — `ribbon()` (per-point `w = halfWidth * Math.max(0.1, pr)` with `pr = (hasPenInput ? p : 1) * endTaper`, polygon `[...L, ...R.reverse()]`), `deform(poly, variance)` (per-edge midpoint + `gauss(0, variance)` on x and y), `deformN(poly, depth, variance)` (pass d uses `variance / (1 + d * 0.65)`).
- packages/efx-physic-paint/src/brush/paint.ts — the three variance sites (~358 pickup-less, ~398 pickup segments, ~453 single-color), each: `ribbon(...)` -> `deformN(base, 4, variance)` -> per-layer `deform(baseD, variance * 0.2)` and `deform(baseD, variance * 0.5)` -> `fillFlat`. Entry funnel: `createPaintStrokeRasterContinuationFromCurve`.
- packages/efx-physic-paint/src/brush/erase.ts — same ribbon + deformN + deform shape (~54-76), mask fill `#fff`.
- packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts (`buildProfileFor` ~263) and productionAaSettleMeasurement.test.ts (~294) — both MIRROR production geometry (ribbon -> deformN depth 4 -> layer schedule) with an LCG stub on Math.random; their header comments claim "production ribbon()/deformN()/deform() geometry". Law gates W1..W7 bounds are calibrated pre-RED and must never be recalibrated.
- packages/efx-physic-paint/src/brush/paint.continuation.test.ts — the canvasFactory + document-stub + LCG precedent for the new test; its ribbon pin `polygon[1] == [10, 3]` guards ribbon output identity across the Task 2 refactor.
- packages/efx-physic-paint/src/util/math.ts — `gauss(mean, stddev)` reads Math.random twice; stubbing Math.random to the constant 0.5 makes every `gauss(0, s)` evaluate to exactly `-1.17741 * s` (sqrt(-2*ln0.5) * cos(pi)), which turns amplitude measurements deterministic and region-comparable.
- Read-only proving UI needs no edit: app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx:663 (Shape detail slider), app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts (edgeDetail default).
</context>

<tasks>

<task type="tdd">
  <name>Task 1: RED — production-path pin: deform amplitude must scale with local width</name>
  <files>packages/efx-physic-paint/src/brush/paint.edgeDetailWidthScale.test.ts</files>
  <behavior>
  - Test 1 (hairline pin, MUST FAIL at base): one straight horizontal pressure gesture through `renderPaintStroke` (hasPenInput=true, size 10, edgeDetail 50, pickup 0, Math.random stubbed to the constant 0.5): the maximum deviation of any captured fill-polygon vertex from the undeformed ribbon boundary, taken over a hairline x-window (curve points with p <= 0.1001 and t in [0.68, 0.88]), is at most 0.30 x the same maximum over a thick-body window (p >= 0.999 and t in [0.30, 0.40]). At base the two maxima are equal (ratio 1.000) -> RED.
  - Test 2 (thick-body preservation control, green at base and required green after GREEN): thick-body maximum >= 0.95 * variance and <= 3.0 * variance, where variance = (1.5 + Math.sqrt(10) * 0.9) * 1 — the organic amplitude on the body is exactly today's law, not uniformly reduced.
  - Test 3 (taper pin, MUST FAIL at base): taper-window maximum (p >= 0.999 and t in [0.06, 0.14]) <= 0.80 x thick-body maximum (base = 1.000).
  - Test 4 (substrate-validity control, green at base): the undeformed ribbon width measured inside the hairline window is <= 3.0 px (proves the measured region really is a ~2px hairline, so the pin cannot pass vacuously).
  - Test 5 (determinism control, green at base): two runs under the same constant stub produce byte-identical captured fill paths.
  Control expectation: at base tests 2, 4, 5 pass; tests 1 and 3 fail with the measured ratio printed — those failures ARE the RED evidence.
  </behavior>
  <action>TDD RED step — test only, zero production edits in this task. Create packages/efx-physic-paint/src/brush/paint.edgeDetailWidthScale.test.ts, harness style copied from paint.continuation.test.ts (canvasFactory log capturing moveTo/lineTo coordinates per path, fill snapshot on each fill op, document.createElement stub, wet() buffers, vi.restoreAllMocks/vi.unstubAllGlobals in afterEach). Gesture recipe: 11 raw points from (4, 32) to (104, 32), step 10 in x is too coarse — use step 10 for the first 6 points then adapt, or simply step 4: p = 1 for x <= 50, p = 0.1 for x >= 60 (the smooth/resample prelude lerps the transition), tx/ty/tw = 0, spd = 0, opts = { size: 10, opacity: 100, pressure: 100, waterAmount: 50, dryAmount: 50, edgeDetail: 50, pickup: 0, eraseStrength: 50, antiAlias: 0 }, canvas 128x64, hasPenInput = true, paperHeight = null, waterAmount 0.5, sampleH -> 0.5. Stub Math.random to ALWAYS return 0.5 (constant, not an LCG — the constant is what makes gauss magnitudes identical everywhere so the region ratio isolates the scale factor; document this in the test header: gauss(0, s) becomes exactly -1.17741*s, every displacement vector is a constant per generation, and because the deform pass structure is periodic along the stroke, the multiset of boundary deviations is identical in any window spanning >= 3 resample spacings, so region MAX differences can only come from a local scale factor). Replicate the production geometry prelude with the exported pure helpers (smooth(rawPts, 3), resample(sm, Math.max(3, radius * 0.25)), ribbon(curve, radius, 0.8, true)) to build the undeformed boundary polygon B; derive the three region x-windows FROM that replicated curve (select curve indices by the p/t predicates in the behavior block, window = [minX, maxX] of the selected indices). Measurement: capture the FIRST fill path (layers[0] of the pickup-less branch); for each captured vertex compute the point-to-polyline distance to the CLOSED boundary B (point-segment distance, min over all segments); region max = max over vertices whose x lies in the window (apply no other filter). Compute the three maxima, the ratio prints, and assert the predicates in the behavior block. Also assert the expected post-fix scale arithmetic in a comment (hairline s = 0.1 * endTaper(t) in [0.062, 0.091], thick s = endTaper(t) in [0.891, 0.972], predicted ratio about 0.07-0.10, threshold 0.30 gives headroom; taper predicted about 0.61-0.73, threshold 0.80). Run the file: tests 1 and 3 must fail with measured ratio 1.000 (assertions, NOT import errors — the test only uses APIs that exist at base), tests 2/4/5 green. Record the RED output (test names + expected/actual numbers) for the SUMMARY. Commit: test(260927-ton): RED — shape-detail deform amplitude must scale with local width. Do NOT touch stroke.ts, paint.ts, erase.ts in this task.
  </action>
  <verify>
  <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/brush/paint.edgeDetailWidthScale.test.ts</automated>
  </verify>
  <done>The new test file runs with tests 1 and 3 FAILING on the amplitude-ratio assertions (measured ratio 1.000 printed) and tests 2, 4, 5 PASSING; git status shows the test file as the ONLY change; RED evidence (failing test names + actual numbers) captured for the SUMMARY.</done>
</task>

<task type="tdd">
  <name>Task 2: GREEN — local-width scale channel in stroke.ts, wired through paint and erase</name>
  <files>packages/efx-physic-paint/src/brush/stroke.ts, packages/efx-physic-paint/src/brush/paint.ts, packages/efx-physic-paint/src/brush/erase.ts</files>
  <behavior>
  - Test 1 (hairline pin) flips GREEN: hairline max <= 0.30 x thick max (expected measured ratio 0.07-0.10).
  - Test 2 thick-body preservation stays GREEN unchanged: thick max still in [0.95, 3.0] x variance — the fix scales by local width, it never shrinks the body amplitude.
  - Test 3 taper pin flips GREEN: taper max <= 0.80 x thick max.
  - Tests 4/5 (substrate validity, determinism) stay GREEN.
  - paint.continuation.test.ts parity pins (pixels + RNG call order + canvas op order, pickup 0 and 60) stay GREEN — the refactor changes displacement magnitudes identically on both the sequential and resumable paths, and the gauss call COUNT per polygon is unchanged.
  - paint.grainRemoval.test.ts (260925-dso) stays GREEN; the ribbon identity pin polygon[1] == [10, 3] in paint.continuation.test.ts stays GREEN (ribbon's polygon output is byte-identical after the refactor-by-delegation).
  </behavior>
  <action>GREEN step — implement the law, then wire every site. (1) stroke.ts: add `ribbonWithScales(curve, halfWidth, tPow, hasPenInput)` returning { poly, scales } where per curve point s = Math.max(0.1, (hasPenInput ? curve[i].p : 1) * endTaper) — computed from the SAME expressions ribbon already uses (this s IS ribbon's w divided by halfWidth; refactor ribbon to derive its w from this helper so the two can never diverge) — and the polygon-aligned scales array follows the existing vertex order: vertex k < n maps to scales[k], vertex k >= n maps to scales[2n - 1 - k] (R was reversed). ribbon keeps its exact signature and return type (delegate to ribbonWithScales and return only poly). (2) stroke.ts: add `deformScaled(poly, scales, variance)` returning { poly, scales } — same algorithm as deform (for each edge push the original vertex then the displaced midpoint, gauss(0, variance) on x and y) except the midpoint is displaced by gauss(0, variance * sMid) where sMid = (sA + sB) / 2, and the output scales array carries [sA, sMid] per edge. Add `deformNScaled(poly, scales, depth, variance)` looping exactly like deformN with pass divisor (1 + d * 0.65), threading the scales through. Keep deform/deformN untouched in this task (the two harnesses still call them until Task 3). (3) paint.ts: at ALL THREE variance sites (pickup-less ~358, pickup segments ~398, single-color ~453) replace ribbon + deformN + per-layer deform with ribbonWithScales + deformNScaled + deformScaled, consuming only the poly for fillFlat and letting the returned scales flow into the next deformScaled call (the 0.2 and 0.5 layer loops included). variance, edgeMul, layers, lAlpha, curveBounds margin, bristles, and transfer stay byte-for-byte as they are. (4) erase.ts: SAME treatment at its one site (~54-76) — this is the explicit erase decision: YES, erase gets the same local-width law, because erase shares the ribbon+edgeDetail geometry and a hairline erase under uniform variance would clear a full-variance wobble band outside the painted silhouette, desyncing erase from paint; record this decision and its rationale in the commit message. (5) Guardrail while wiring: depositAlpha / strokeOpacity / body coverage arithmetic, fluids.ts, wet-layer.ts, the layer alphas, and the UI are all out of scope — this task only changes WHICH polygon vertices are displaced and by how much. Run the pin file: all five tests GREEN. Then run the brush suites and the full package suite + tsc. Commit: feat(260927-ton): scale edgeDetail deform amplitude by local ribbon width (paint + erase) — the erase decision noted in the body.
  </action>
  <verify>
  <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/brush/paint.edgeDetailWidthScale.test.ts src/brush/paint.continuation.test.ts src/brush/paint.grainRemoval.test.ts && ../../app/node_modules/.bin/vitest run && npm run check</automated>
  </verify>
  <done>All five pin tests green (ratio in the predicted 0.07-0.10 band, thick-body band unchanged, taper under 0.80); paint.continuation parity + ribbon identity pin + dso grain-removal pins green; full package suite matches base (sole failure remains the pre-existing EfxPaintEngine.liveAlphaCache, ledger 74); tsc clean; git diff for this task touches only stroke.ts, paint.ts, erase.ts; the erase same-treatment decision is recorded in the commit message.</done>
</task>

<task type="auto">
  <name>Task 3: Harness parity, regression battery, guardrails, SUMMARY</name>
  <files>packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts, packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts, .planning/quick/260927-ton-quick-8f-shape-detail-must-scale-with-lo/260927-ton-SUMMARY.md</files>
  <action>Restore the production-geometry parity contract in both mirrors, then prove the regression battery. (1) physicsWidthScaling.test.ts `buildProfileFor` and productionAaSettleMeasurement.test.ts build the deposit substrate with ribbon -> deformN(4) -> per-layer deform(0.2/0.5); migrate exactly that block to ribbonWithScales + deformNScaled + deformScaled (same variance, same layer schedule, same LCG stub — only the geometry call chain changes), and update the header/comment lines that name the old helpers so the comments describe the scale-aware chain (comment hygiene; the parity claim in the header stays true). Law-gate bounds W1..W7 (and every b7c-recalibrated texture gate) are NOT touched — they were calibrated pre-RED and this quick has no recalibration authority. (2) Decision tree on the migrated harness runs: (a) all gates green -> proceed; (b) any gate fails -> STOP immediately, commit nothing further beyond what is already committed, and report the failing gate with measured before/after numbers for a user decision (the quick's stop clause — do not weaken a bound, do not recalibrate, do not touch fluids.ts / wet-layer.ts / spreadScale.ts to force a pass). Expected direction of movement: hairline-region wobble shrinks (helps W1 <= drawn+3.0 and W3 thin<=thick), thick and uniform-production interiors keep scale 1.0 (W6/W7 texture unchanged); sub-pixel movement at tapered columns is the only realistic risk. (3) After the harnesses are migrated and green (or STOPped per (b)): delete the now-dead legacy `deform` and `deformN` exports from stroke.ts (clean-break law — package-internal only, index.ts never exported them) and fix any leftover comment references. (4) Regression battery: the four law files (physicsWidthScaling, physicsSettledFootprint, productionAaSettleMeasurement, plus the new pin file), the brush suites, full package vitest (only the pre-existing liveAlphaCache failure allowed), app suite (cd /Users/lmarques/Dev/efx-motion-editor/app && ./node_modules/.bin/vitest run — must match its base results incl. the known deferred chunk-budget failure), package tsc (npm run check). (5) Scope gate via diff: record and export BASE_SHA = git rev-parse HEAD before the Task 1 commit (the quick's plan base — the verify command consumes it; if the session shell was reset, recover it as the parent of the quick's first `260927-ton` commit), then git diff --name-only BASE_SHA..HEAD must list ONLY the seven planned files, and must be EMPTY for packages/efx-physic-paint/src/core/fluids.ts, packages/efx-physic-paint/src/core/wet-layer.ts, packages/efx-physic-paint/src/core/spreadScale.ts, packages/efx-physic-paint/src/render/canvas.ts, packages/efx-physic-paint/src/render/compositor.ts, app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts, any package.json, and pnpm-lock.yaml (no installs, no push). Plus the legacy-helper removal gate: a scoped grep for the bare legacy helper identifier over packages/efx-physic-paint/src (include *.ts, exclude comment lines beginning with // or *) must report 0 hits once Task 3's deletion lands — the scaled helper name must not match (word-boundary pattern, not a substring check). (6) Write 260927-ton-SUMMARY.md: status automated-ready, the RED evidence (ratio 1.000 at base), the GREEN numbers (measured hairline/thick ratio, taper ratio, thick band), the recorded erase decision, the parity outcome, and these native UAT rows for the user: (1) one pressure gesture at a HIGH Shape detail value — thick body keeps the organic natural edge, hairline and tapers stay clean and un-wobbled; (2) same gesture at a LOW value — no pixel-noise breakup of thin parts, body still reads slightly textured; (3) the gradient is visible along ONE stroke (thick end organic, thin end clean); (4) regression: 260924-stb pressure-physics base gesture unchanged (thickness field intact); (5) regression: 260925-b7c Spread default still preview-matched; (6) regression: 260925-dso edges clean, no grain/emboss reappearing; (7) Normal-mode erase at hairline width removes only along the thin line (erase got the same law). Leave the SUMMARY uncommitted for the orchestrator docs commit (260925-b7c precedent).
  </action>
  <verify>
  <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsWidthScaling.test.ts src/core/physicsSettledFootprint.test.ts src/core/productionAaSettleMeasurement.test.ts src/brush/paint.edgeDetailWidthScale.test.ts src/brush/paint.continuation.test.ts src/brush/paint.grainRemoval.test.ts && ../../app/node_modules/.bin/vitest run && npm run check && cd /Users/lmarques/Dev/efx-motion-editor && git diff --name-only "$BASE_SHA"..HEAD</automated>
  </verify>
  <done>All six suites green at their existing bounds (no bound recalibrated — or the plan STOPped with a measured gate report and no further commits); full package suite shows only the pre-existing liveAlphaCache failure; app suite matches base; tsc clean; git diff --name-only BASE_SHA..HEAD lists only the seven planned files with the locked-surface list empty; legacy uniform deform helpers deleted with a comment-filtered scoped grep reporting 0 remaining call sites; SUMMARY exists with status automated-ready and the 7 native UAT rows.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Pure local geometry math inside the brush layer; no new external input, no parsing, no network, no auth, no file format change |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260927-ton-01 | Repudiation | silent physics/opacity regression disguised as a geometry fix | high | mitigate | Task 3 scope gate: fluids.ts, wet-layer.ts, spreadScale.ts, compositor.ts, canvas.ts (preview ribbon), both UI files, package.json and pnpm-lock.yaml must show empty diffs; PIN 0/0b, W1-W7 and dso gates run at existing bounds |
| T-260927-ton-02 | Tampering | weakening a calibrated law gate when a harness moves after substrate migration | high | mitigate | Decision tree (b): NO recalibration authority in this quick — a failing law gate STOPs with a measured report for a user decision instead of an edited bound |
| T-260927-ton-03 | Tampering | erase diverging from paint geometry (mask wobble outside the painted silhouette) | medium | mitigate | Explicit erase same-treatment decision in Task 2; one shared scale computation (ribbonWithScales) feeds both paint and erase — no inline scale math at any call site |
| T-260927-ton-04 | Elevation of Privilege | package installs during execution | high | mitigate | No installs in scope; Task 3 diff gate proves no package.json / pnpm-lock.yaml changes (T-260927-ton-SC) |
| T-260927-ton-05 | Information Disclosure | none — local vitest runs, no network, no auth, no user data | low | accept | External I/O out of scope |
</threat_model>

<verification>
- RED gate: `cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/brush/paint.edgeDetailWidthScale.test.ts` exits non-zero at Task 1 with the hairline and taper ratio assertions failing at measured ratio 1.000, while the thick-body, substrate-validity and determinism controls pass; git status shows the test file as the only change.
- GREEN gate: the same command exits 0 after Task 2 with the hairline ratio in the predicted 0.07-0.10 band and the thick-body band [0.95, 3.0] x variance unchanged; brush parity + dso pins green; full package vitest matches base; `npm run check` clean.
- Parity gate: both engine-mirrored substrates drive ribbonWithScales/deformNScaled/deformScaled (no legacy uniform deform call sites remain — comment-filtered scoped grep reports 0); every stb/b7c law gate green at its existing bound, or the plan STOPped with a measured report.
- Scope gate: with BASE_SHA captured before the Task 1 commit, `git diff --name-only BASE_SHA..HEAD` lists only the seven planned files; empty for fluids.ts, wet-layer.ts, spreadScale.ts, render/canvas.ts, render/compositor.ts, PhysicsPaintRightPanel.tsx, physicsPaintStudioSettings.ts, package.json, pnpm-lock.yaml; app suite at base results; no UI change (slider 0-100, label "Shape detail", defaults untouched); no installs, no push.
</verification>

<success_criteria>
The RED pin measured equal amplitude (1.000) at base and now measures hairline/thick <= 0.30 with the thick-body band unchanged; all four production deform sites run through the single local-width seam and the legacy uniform helpers are gone; erase carries the recorded same-treatment decision; every regression law (m7w opacity, stb thickness field + keep tier, b7c spread curve, dso clean edges, koa preview ribbon) is intact with locked-surface diffs empty; full package + app suites at base results with tsc clean; SUMMARY status automated-ready with the 7 native UAT rows pending the user's live check (no done claim before native UAT).
</success_criteria>

<output>
Create `.planning/quick/260927-ton-quick-8f-shape-detail-must-scale-with-lo/260927-ton-SUMMARY.md` when done (uncommitted per the 260925-b7c precedent; orchestrator owns the docs commit)
</output>
