---
phase: quick-261002-fpi
plan: 261002-fpi
type: tdd
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/brush/paint.blendingContinuity.test.ts
  - packages/efx-physic-paint/src/brush/paint.ts
  - packages/efx-physic-paint/src/core/lookLawDigest.test.ts
  - .planning/quick/261002-fpi-quick-8e-for-color-blending-pattern-repe/261002-fpi-SUMMARY.md
autonomous: true
requirements: [QUICK-261002-FPI]

estimate:
  tokens: 42000
  raw_tokens: 36000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "ONE PIPELINE (look-continuity law): the stroke raster has exactly ONE rendering family at every Blending/pickup value — a single continuous drawBristleFootprint over the whole curve and a single transferToWetLayerClipped deposit. The old two-family threshold (fresh path below 0.01, segmented stamps above) is gone; the pipeline shape (offscreen count, footprint count, transfer count) is identical for pickup 0, 0.5, 1, 60, 100"
    - "CONTINUOUS COLOUR: at pickup > 0 the colour applied along the stroke is the continuous buildCarriedColors series (per-arc/per-sample), never a flat colour stamped per fixed segment — the autocorrelation of the applied-colour first-difference has no significant peak at the legacy segment-step lag (threshold pinned in the RED test), and no single-sample colour jump exceeds the pinned continuity threshold on a ramp surface"
    - "MONOTONE AMPLITUDE: deviation of the applied colour from the pure picker colour grows strictly with pickup across 0/25/50/75/100 on a fixed surface ramp; pickup 0 applies the pure picker colour at every sample (identical pipeline, constant colour input)"
    - "ALPHA/COVERAGE LAW UNTOUCHED: the footprint fill alpha stays the single whitelist law (STREAK_ALPHA x opac with opac = 1 inside the footprint, transfer-time userOpacity unchanged); the recolour pass never modifies alpha (source-atop colour-only); git diff on wet-layer.ts, spreadScale.ts, stroke.ts, footprintLanes.ts, paper.ts is EMPTY and depositRoom / spreadCurveFor / physicsTicks / shape-detail deform behaviour is asserted unchanged by the existing battery"
    - "EXISTING GATES GREEN: bristleSeed single-fill law, depositSourceShape G1-G6, whiteSeamSourcePin offscreen-clip, gestureStall S3 snapshot scoping, continuation sequential-vs-resumable parity (pickup 0 and 60), full package suite + typecheck"
  artifacts:
    - packages/efx-physic-paint/src/brush/paint.blendingContinuity.test.ts (RED pins: pipeline-shape equality across pickup values, applied-colour autocorrelation/continuity, monotone deviation, pure-picker at 0)
    - packages/efx-physic-paint/src/brush/paint.ts (single rasterize() path: one footprint + carried-colour recolour before transfer; segment slicing loop and the 0.01 family threshold removed)
    - packages/efx-physic-paint/src/core/lookLawDigest.test.ts (branch-count amendment: the unified path drops one transferToWetLayerClipped site — minimal assertion edit only)
    - .planning/quick/261002-fpi-quick-8e-for-color-blending-pattern-repe/261002-fpi-SUMMARY.md
  key_links:
    - "Recolour-before-transfer ordering: the source-atop carried-colour pass must run on the offscreen AFTER drawBristleFootprint and BEFORE transferToWetLayerClipped reads it back — reversed order silently deposits the un-coloured silhouette and the whole feature disappears while every structural pin stays green"
    - "Patch-coverage link: each per-sample recolour patch must cover the full local silhouette half-width (ribbon scale + deformed contour + margin) — under-coverage leaves picker-coloured streaks inside the stroke that only native UAT can see; the test pins patch half-width >= the footprint's own per-sample lateral reach"
    - "Opacity-unification link: the footprint opac argument is fixed at 1 (the fresh-path law) on the unified path; passing the stroke opac into the footprint as the old segmented path did re-creates the opac-squared deposit and breaks monotonicity / blending-0 identity"
    - "Gate-amendment link: lookLawDigest's transfer-site count assertion must be amended to the new honest count in the SAME commit as the merge — amending it in a separate commit leaves a red suite between commits; amending it beyond the minimum count change weakens a look-law gate (forbidden)"
---

<objective>
QUICK 8e (color blending pattern repeat) — user GO, root cause located, scope locked. The beaded repeating motif at Blending > 0 is NOT a deliberate stamp: paint.ts's rasterize() inherits a v3.html-era loop that slices the curve into fixed-step segments (step = segLen - 30% overlap) and stamps each as an INDEPENDENT footprint with ONE flat colour taken from the segment midpoint of carriedColors. That periodic per-segment stamp IS the beaded chain, and the `pickupAmt < 0.01` branch is a second rendering family (look-continuity violation). Verdict recorded, proceeding with removal (per the constraint, if execution finds evidence the stamp was deliberate, execution STOPs and asks instead).

SCOPE (locked, implement exactly):
1. Kill the segmentation — ONE continuous drawBristleFootprint over the whole curve, same as the no-pickup path.
2. Keep buildCarriedColors (surface sampling + subtractive mix IS the feature). Apply it as continuous per-arc colour (per-sample colour keyed to arc), not a per-segment flat midpoint colour.
3. Remove the family switch — pickup 0 is the SAME pipeline with a constant pure-picker colour input. The slider is a monotone amplitude of one process, never a different rendering.

Implementation shape (mandated): the unified rasterize() keeps the fresh path's single offscreen + single footprint (opac 1) + single transfer; at pickup > 0 it computes the scoped snapshot + carriedColors (existing measurePrimitive stages kept) and applies them as a colour-only source-atop recolour pass over the footprint silhouette BEFORE the transfer (alpha never touched). At pickup exactly 0 the carried series is provably constant pure picker, so the snapshot/recolour data pass may be skipped — that is a constant-colour input shortcut, NOT a rendering family: pipeline shape tests must prove footprint/offscreen/transfer counts identical across all pickup values. drawBristleFootprint itself stays byte-untouched (all footprint gates stay green).

Guardrails (hard): no change to depositRoom / spreadCurveFor / physicsTicks / shape-detail deform (R8/R9/R10) — spreadScale.ts, stroke.ts, footprintLanes.ts, wet-layer.ts, paper.ts diff EMPTY. Never scale depositAlpha or body coverage. RED first: pin the beaded periodicity at the segment step (autocorrelation of the applied-colour first-difference at blending > 0) and pin the family switch at the 0.01 threshold, then GREEN on one continuous pipeline.

Purpose: one continuous, colour-modulated pipeline so Blending is a monotone look knob (look-continuity law) instead of a periodic stamp artifact.
Output: RED pins -> unified pipeline (GREEN) -> full package suite + typecheck + scope guard -> SUMMARY automated-ready with the four native UAT rows pending. No installs, no push, no ROADMAP edits.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@packages/efx-physic-paint/src/brush/paint.ts
@packages/efx-physic-paint/src/brush/paint.continuation.test.ts
</context>

<tasks>

<task type="tdd">
  <name>Task 1 (RED): pin the segmented family + beaded periodicity, and the target invariants</name>
  <files>packages/efx-physic-paint/src/brush/paint.blendingContinuity.test.ts</files>
  <behavior>
  - Pipeline-shape characterization (teeth, passes at RED): at pickup 60 the run creates >1 offscreen / >1 footprint / >1 transfer, while at pickup 0 it creates exactly 1 of each — proving the probe detects the two-family split.
  - Target: pipeline shape (offscreen, footprint, transfer counts) is exactly (1,1,1) for pickup in {0, 0.5, 1, 60, 100} — FAILS at RED (pickup 1 and 60 are segmented; the 0.01 threshold shows as a shape change between 0.5 and 1).
  - Target: on a straight horizontal stroke over a mock surface returning a linear colour ramp, the applied-colour series (expanded per curve sample from the logged fillStyle values along the run) has a first-difference autocorrelation with NO peak at the predicted legacy step lag (segment step = segLen - floor(segLen*0.3), segLen computed exactly as production for the chosen curve length; normalized autocorr at that lag < 0.5 and no single-sample colour jump exceeds 12/255 luminance) — FAILS at RED (piecewise-flat segment colours produce spikes at exactly that period).
  - Target: deviation of applied colour from pure picker grows strictly with pickup across {0, 25, 50, 75, 100} on the fixed ramp surface; at pickup 0 every sample's applied colour equals the pure picker colour — FAILS at RED only if family-split artifacts break it; record which targets fail.
  </behavior>
  <action>Create the RED contract test using the paint.continuation.test.ts harness pattern (vi.stubGlobal document.createElement canvas factory with fillStyle/getImageData logging, wet() buffers, createPaintStrokeRasterContinuation for the resumable run). Instrument: offscreen creation count (document.createElement calls), transfer calls (count logged transfer-side getImageData/putImageData or count offscreen readbacks), and the ordered fillStyle series per offscreen. Provide a mock main-canvas getImageData that returns a linear RGB ramp (e.g. r = 30 + x) so buildCarriedColors has a real surface to mix. Compute the legacy segment step the SAME way production does for the fixed test curve (reproduce the segLen/overlap arithmetic locally in the test as an oracle of the pin, not an import) and assert: (RED characterization block, passes now, DELETED in Task 2) the autocorrelation of the applied-colour first-difference peaks at that lag and the pipeline shape differs across the 0.01 boundary; (target block, fails now) the invariants in the behavior block above. Do NOT touch paint.ts in this task. Run the test and record exactly which target assertions fail (the RED evidence for the commit message).
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/brush/paint.blendingContinuity.test.ts</automated>
  </verify>
  <done>Test file exists; the characterization block passes (probe has teeth — periodic peak at the legacy step lag is detected at pickup 60) and at least the pipeline-shape and autocorrelation target assertions FAIL against current paint.ts, with the failing assertion names recorded for the RED commit; commit as test(261002-fpi): RED pins for blending periodicity + family switch.</done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2 (GREEN): one continuous pipeline with per-arc carried colour</name>
  <files>packages/efx-physic-paint/src/brush/paint.ts, packages/efx-physic-paint/src/core/lookLawDigest.test.ts</files>
  <behavior>
  - rasterize() has ONE code path: single bounds/offscreen, single drawBristleFootprint(curve, { ..., opac: 1 }) over the whole curve, single transferToWetLayerClipped(..., opac) — for every pickup value.
  - pickup > 0: the existing scoped snapshot + measurePrimitive('paint-pickup-canvas-snap'/'paint-pickup-carried-colors') + buildCarriedColors run as today, then a source-atop recolour pass paints the carried colour per curve sample onto the footprint silhouette before transfer; the colour series equals rgbHex(carriedColors[i]) per sample (continuity + monotone pins turn green).
  - pickup exactly 0: snapshot/recolour skipped (constant pure-picker input), footprint + transfer byte-equivalent to today's fresh path.
  - drawBristleFootprint body unchanged: bristleSeed single-fillStyle/single-alpha gates and depositSourceShape G1-G6 stay green without edits.
  - lookLawDigest transfer-site count assertion amended to the new honest branch count in the same commit, message updated to say the unified raster branch.
  </behavior>
  <action>Merge the two branches in createPaintStrokeRasterContinuationFromCurve's rasterize(): delete the family threshold and the segment slicing loop entirely (the whole segLen/overlap/per-segment-footprint block). Keep the fresh path structure (bounds, one offscreen, one footprint with opac 1, yield, one transfer with the stroke opac). For pickup > 0, before the footprint is drawn compute the existing scoped canvasSnap + carriedColors (keep both measurePrimitive stage names verbatim — gestureStall S3 pins them), draw the footprint, then apply the recolour: for each curve sample i, fill a per-sample patch with globalCompositeOperation 'source-atop' and fillStyle rgbHex(carriedColors[i]), where the patch is a quad/disc centred on the sample with half-width >= the footprint's local lateral reach (ribbonWithScales scale x radius + max(abs(leftOff), abs(rightOff)) deformed displacement + gauge margin + 4px) so the whole silhouette is covered; patches run in curve order so colour evolves continuously along arc. Alpha must never be written by the recolour (source-atop with opaque colour preserves destination alpha — this is the depositAlpha/body-coverage guardrail). Do NOT pass the stroke opac into the footprint (opac 1 is the unified law; transfer keeps opac). Then yield and transfer exactly once. For pickup exactly 0 skip snapshot + recolour (constant colour input, same pipeline). Re-run Task 1's characterization block is deleted; target block must pass. If lookLawDigest's transfer-site count assertion fails because the merge legitimately removed one deposit site, amend ONLY that count (and its message) in the same commit; every other battery/gate file stays byte-untouched — any OTHER red test is a STOP-and-report, never a gate edit.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/brush/paint.blendingContinuity.test.ts src/brush/paint.continuation.test.ts src/brush/paint.bristleSeed.test.ts src/brush/paint.depositSourceShape.test.ts src/core/whiteSeamSourcePin.test.ts src/core/gestureStallMeasurement.test.ts src/core/lookLawDigest.test.ts</automated>
  </verify>
  <done>All Task 1 target assertions green (single pipeline shape across pickup values, no periodic colour peak at the legacy step lag, monotone deviation, pure picker at 0); the seven listed existing suites green; drawBristleFootprint body unchanged; commit as feat(261002-fpi): one continuous pipeline with per-arc carried colour.</done>
</task>

<task type="auto">
  <name>Task 3: full-suite gate, guardrail scope proof, SUMMARY</name>
  <files>.planning/quick/261002-fpi-quick-8e-for-color-blending-pattern-repe/261002-fpi-SUMMARY.md</files>
  <action>Run the full package suite and typecheck, then prove the guardrail scope: git diff --name-only against the pre-quick base must list ONLY the two brush files, lookLawDigest.test.ts, the new test, and the SUMMARY — spreadScale.ts, stroke.ts, footprintLanes.ts, wet-layer.ts, paper.ts, EfxPaintEngine.ts and all other battery files untouched (diff EMPTY). Re-run the depositSourceShape six-gate file explicitly as the R8/R9/R10 guardian. Write the SUMMARY with status automated-ready, the RED evidence (which pins failed and the measured legacy periodicity), the exact green commands, and the four native UAT rows verbatim as pending: (a) Blending raised smoothly mixes stroke and surface color — no periodic beads along the stroke. (b) Result is irregular/natural, not a repeating stamp. (c) Blending 0 to 100 is monotone: more mixing, never a different artifact. (d) Blending 0 = identical to today clean single-color look. Never push. Commit: docs(261002-fpi): quick summary.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run && cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-physic-paint run check && FILES=$(git diff --name-only main...HEAD) && printf '%s\n' "$FILES" | grep -v '^\.planning/' | grep -cv 'brush/paint\|lookLawDigest' | grep -qx 0</automated>
  </verify>
  <done>Full package suite green, typecheck clean, scope proof shows no file outside the paint stroke-rendering path + the required test amendments changed, SUMMARY written with automated-ready status and the four pending native UAT rows.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Pure renderer-internal change in TypeScript brush code — no external input, network, storage, or package installs |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-8e-01 | Tampering | look-law gates (lookLawDigest, depositSourceShape, bristleSeed) | medium | mitigate | Only the one legitimately-obsolete branch-count assertion may be amended, in the same commit as the merge; every other gate file diff must be EMPTY (scope proof in Task 3) |
| T-8e-02 | Tampering | depositAlpha / body coverage (wet-layer.ts) | high | mitigate | Recolour is source-atop colour-only (alpha preserved by construction); wet-layer.ts / spreadScale.ts / stroke.ts / footprintLanes.ts / paper.ts diff EMPTY enforced by the Task 3 scope command |
| T-8e-03 | Repudiation | "it works" claims on a visual artifact | medium | mitigate | RED characterization block records the measured legacy periodicity before the fix; verdict stays automated-ready, native UAT rows (a)-(d) pending in SUMMARY (never claim done before UAT) |
| T-8e-SC | Tampering | npm/pip/cargo installs | high | mitigate | no installs in this quick — package-legitimacy gate not applicable |
</threat_model>

<verification>
- RED evidence: characterization block showed the autocorrelation peak at the legacy segment-step lag and the shape change at the 0.01 boundary (recorded in commit/SUMMARY).
- Target pins green: pipeline shape (1,1,1) across pickup {0, 0.5, 1, 60, 100}; no periodic colour peak; monotone deviation; pure picker at 0.
- Existing gates: bristleSeed, depositSourceShape G1-G6, whiteSeamSourcePin, gestureStall S3, continuation parity (pickup 0 and 60), lookLawDigest — green.
- Test commands (prior_verify_commands, reuse verbatim): package — cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run <paths>; typecheck — cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-physic-paint run check. NEVER watch mode; no dev server (CLAUDE.md); pnpm only; never push.
- Native UAT (pending, recorded in SUMMARY): (a) Blending raised smoothly mixes stroke and surface color — no periodic beads along the stroke. (b) Result is irregular/natural, not a repeating stamp. (c) Blending 0 to 100 is monotone: more mixing, never a different artifact. (d) Blending 0 = identical to today clean single-color look.
</verification>

<success_criteria>
All Task 1 target pins green on one continuous pipeline; full package suite + typecheck green; guardrail diff EMPTY on spreadScale.ts / stroke.ts / footprintLanes.ts / wet-layer.ts / paper.ts; SUMMARY automated-ready with the four native UAT rows pending; commits: RED test, GREEN feat, docs summary.
</success_criteria>

<output>
Create `.planning/quick/261002-fpi-quick-8e-for-color-blending-pattern-repe/261002-fpi-SUMMARY.md` when done
</output>
