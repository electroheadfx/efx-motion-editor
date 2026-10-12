---
phase: quick-261003-hpi
plan: 261003-hpi
type: tdd
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts
  - packages/efx-physic-paint/src/brush/erase.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - .planning/quick/261003-hpi-quick-erase-contract-fresh-whole-stroke-/261003-hpi-SUMMARY.md
autonomous: true
requirements: [QUICK-261003-HPI]

estimate:
  tokens: 48000
  raw_tokens: 40000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "WET = WHOLE STROKE: an erase gesture whose path intersects a recorded paint stroke that still has wet deposit (wet.alpha >= 1 under the intersection) removes that stroke WHOLLY in one gesture — mutationId gone from getStrokes()/getStrokeCount()/the serialized strokes list, deposit gone from wet + savedWet + the rebuilt dry canvas — regardless of force magnitude (any force >= 1); force 0 leaves the eraser inert everywhere"
    - "DRY = REAL PIXEL ERASER: on baked-only paint (no wet under the gesture) the eraser removes pixels for real — at full mask coverage, per-pass removal >= force/100 of remaining alpha (100 clears in 1 pass, 50 in <= 8, 25 in <= 21), strictly monotone in the existing 0-100 force value, 0 removes nothing; the thousands-of-passes lightness is gone"
    - "WET x PIXEL NEVER: the erase path never scales wet buffers in place — after any erase gesture, wet.alpha/savedWet.alpha OUTSIDE the removed strokes' footprints is byte-identical to before, and wet stays wet for the NEXT gesture (the blanket erase-final force-dry that baked every fresh stroke after each erase is gone), so later fresh strokes still get the whole-stroke cell"
    - "DRY x STROKE NEVER: a gesture touching only baked paint mutates no stroke entry and no history counter (getStrokeCount and getHistoryAvailability unchanged by the pixel cell)"
    - "CONTAINMENT + R4: strokes the gesture did not intersect keep their entries AND their deposit (neighbor region byte-identical across the rebuild); the erase deform draws only from the seededRng(hashMutationId, 'erase-shape') stream so the erased pattern never aligns with the painted mark; frozen knobs asserted literal: DEPOSIT_KEEP_TIER 40, DEPOSIT_DENSITY_SCALE 4500, PAPER_ADSORPTION_GAMMA 0.5; compositor.ts + drying.ts + wet-layer.ts (the one look law / wetDisplayAlpha) diff EMPTY; app/** diff EMPTY — the single force control already exists (physics-erase-strength slider), no new UI"
    - "EXISTING GATES GREEN with zero gate edits: shapeDetail (R4 family), cooperativeFinalization FIFO (paint + erase jobs), pointerInput, redrawAllQueuedFinalizations, lookLawDigest, depositSourceShape, bristleSeed, full package suite + tsc clean"
  artifacts:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts (the truth table: wet/dry x stroke/pixel x force as executable cells + knob literal pins + R4 anti-alignment pin)
    - packages/efx-physic-paint/src/brush/erase.ts (dry-only pixel eraser with linear force curve; zero wet-buffer writes; 'erase-shape' stream kept)
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts (erase finalize: wet-target detection -> entry removal -> engine replay rebuild; no blanket erase force-dry; live-only whole-stroke detection)
    - .planning/quick/261003-hpi-quick-erase-contract-fresh-whole-stroke-/261003-hpi-SUMMARY.md
  key_links:
    - "Detection-before-settle link: wet-target detection and entry removal must run BEFORE anything dries or rebuilds the erase result — today applyEraseStroke is followed by a blanket forceDryAll('erase-final-force-dry') that bakes ALL wet (whole-frame wet scan), which would both destroy untouched fresh strokes' wet state and make every later gesture read as dry; leaving either in place silently collapses the wet cell to a one-shot"
    - "Rebuild-not-footprint link: deposit removal MUST go through the engine's own replay (splice entries from allActions + the redrawAll/resetReplaySurface machinery) — clearing pixels inside a footprint cannot attribute wet/dry pixels to a stroke and leaves baked residue of the removed stroke plus collateral holes in overlapping neighbors"
    - "Live-only link: whole-stroke detection runs ONLY on the live finalize path (explicit marker in StrokeApplicationOptions); every replay path (redrawAll, renderPartialStrokes, AnimationPlayer, load+render) defaults to pixel-only erase, or replay would delete entries it re-walks — this default keeps AnimationPlayer/cooperativeFinalization/redrawAll pins green"
    - "History-coherence link: a removed mutationId must leave allActions AND undoStack/historyEntries together — a dangling undo entry makes getHistoryAvailability drift and undo() hit its findIndex<0 early-return; the erase gesture's own entry stays (it carries the dry pixel effect and replays)"
---

<objective>
QUICK hpi (erase contract) — user GO, truth-table first, scope locked. TODAY: the erase brush pixel-lightens BOTH the wet layer and the dry canvas with a cubic strength curve (erase.ts strMul = eraseStr^3*5 + eraseStr*0.3 over a ~0.5-coverage mask), while wet alpha is density-scaled (deposit x4500, saturating wetDisplayAlpha) so cutting it by keep is visually near-inert — erase on fresh paint reads as "so light it takes thousands of passes"; every erase finalize then runs a blanket forceDryAll('erase-final-force-dry') that bakes ALL wet (fresh strokes turn dry as a side effect); recorded stroke entries in allActions are never touched, so nothing is ever actually removed. TARGET (locked): wet = whole-stroke, dry = pixel eraser with force.

THE TRUTH TABLE (wet/dry x stroke/pixel x force) — pin every cell in Task 1, implement in Task 2:

| # | State under the gesture | Semantics | Force (eraseStrength, existing slider) |
|---|---|---|---|
| W-S | WET: gesture path intersects a recorded paint stroke's ribbon AND wet.alpha >= 1 at the intersection | STROKE — remove the whole intersecting stroke(s): entry out of getStrokes()/serializeProject/history, deposit gone everywhere (wet, savedWet, rebuilt dry) | force 0 = eraser inert (no cell runs); force >= 1 = full removal, magnitude NEVER modulates the outcome |
| W-P | WET | NEVER — pixel-granular lightening of wet buffers is forbidden | all forces |
| D-P | DRY (baked only; wet empty under the gesture) | PIXEL — per-pixel removal on the dry canvas under the erase mask, dry canvas only | 0 = none; per-pass removal >= force/100 of remaining alpha at full mask coverage (100 -> 1 pass, 50 -> <= 8, 25 -> <= 21), strictly monotone; contract measured at full pressure (pMod = 1) |
| D-S | DRY | NEVER — no allActions/undo/history mutation from the pixel cell | all forces |

Mixed gesture: both cells apply per region in the same gesture (wet parts whole-stroke, dry parts pixel). Orphan wet with no intersecting recorded entry: leave untouched (fail-safe, no pixel path on wet). Redo/history: the erase gesture's own entry remains; removed entries leave undoStack/historyEntries with it.

SCOPE (locked, implement exactly):
1. erase.ts becomes the DRY pixel eraser only: zero writes to wetBuffers; new force curve satisfying the D-P per-pass law (existing strMul replaced; mask rendering, bounds math, bg-mode handling kept); 'erase-shape' seeded stream kept verbatim (R4).
2. EfxPaintEngine.ts erase branch: (a) detect wet targets (live-only), splice primary + its zero-point continuation entries from allActions AND undoStack/historyEntries, rebuild via the engine's replay machinery so every surviving stroke re-deposits exactly; (b) run the dry pixel path on the dry canvas; (c) DELETE the blanket forceDryAll('erase-final-force-dry') so untouched wet survives byte-identical.
3. No UI, no app/** changes: the single force control (PanelSlider "physics-erase-strength", PhysicsPaintRightPanel) already exists and stays the only control.

Guardrails (hard): NEVER touch wetDisplayAlpha or the one look law — compositor.ts, drying.ts, wet-layer.ts, types.ts diff EMPTY; frozen knobs literal (DEPOSIT_KEEP_TIER 40, DEPOSIT_DENSITY_SCALE 4500, PAPER_ADSORPTION_GAMMA 0.5) asserted in the contract test; paint.ts / stroke.ts / footprintLanes.ts / spreadScale.ts / paper.ts untouched (R8/R9/R10); zero edits to ANY existing test file — if an existing gate goes red for a reason other than a legitimate erase-path topology change you can prove with the diff, STOP and report instead of editing the gate. No installs, no push, no ROADMAP edits, never run the dev server.

Purpose: erase becomes trustworthy — fresh paint dies as a whole stroke instantly, baked paint erases for real with the existing force knob, and the frozen look law is provably untouched.
Output: RED truth table -> GREEN contract -> full suite + scope proof -> SUMMARY automated-ready with native UAT rows pending.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@packages/efx-physic-paint/src/brush/erase.ts
@packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
@packages/efx-physic-paint/src/engine/EfxPaintEngine.pointerInput.test.ts
</context>

<tasks>

<task type="tdd">
  <name>Task 1 (RED): the full erase-contract truth table as executable cells</name>
  <files>packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts</files>
  <behavior>
  - W-S (wet x stroke, force 50 and 100): after an erase gesture whose path crosses a recorded stroke with wet deposit, that stroke's mutationId is absent from getStrokes() AND from the serialized strokes list, wet.alpha and savedWet.alpha under its ribbon are 0, and a post-rebuild dry-canvas sample at its centerline reads background (transparent mode alpha < 2) — FAILS at RED (today: entry kept, wet merely scaled).
  - W-S force 0: identical setup with eraseStrength 0 removes nothing (entry still present, wet unchanged) — pin both directions of the force-0 cell.
  - W-P never-cell: the erase gesture leaves wet.alpha/savedWet byte-identical OUTSIDE removed footprints, and wet under a NON-crossed fresh stroke stays wet (alpha unchanged) so a subsequent gesture still whole-stroke-removes it — FAILS at RED (today: in-place wet scaling + blanket erase-final force-dry zeroes it).
  - D-P force law (dry-only setup, hasPenInput false): one identical-path erase pass at force 100 clears centerline alpha to < 2 in 1 pass; at 50 within 8 passes; at 25 within 21; per-pass removal at full mask coverage >= force/100 of remaining alpha (strictly monotone across 0/25/50/75/100); force 0 = zero removal — FAILS at RED at least at 50/25 (today's cubic + ~0.5 mask coverage); record which cells fail.
  - D-S never-cell: gesture over baked-only paint leaves getStrokeCount() and getHistoryAvailability() unchanged — guard pin (passes today, must stay green forever).
  - R4 anti-alignment: erase masks built from two different mutationIds differ (mutation-keyed stream), and under a constant Math.random stub the erase mask byte pattern differs from the paint deform pattern for the same curve (no alignment); erase.ts sources contain 'erase-shape' and zero 'Math.random()'.
  - Frozen knobs literal: DEPOSIT_KEEP_TIER === 40, DEPOSIT_DENSITY_SCALE === 4500, PAPER_ADSORPTION_GAMMA === 0.5 (import from core/wet-layer.ts).
  - History coherence: after W-S removal, getHistoryAvailability().undo counts only still-present mutations, and a subsequent engine.undo() neither crashes nor resurrects the removed stroke.
  </behavior>
  <action>Create the contract test using the EfxPaintEngine.pointerInput.test.ts harness pattern (Object.create(EfxPaintEngine.prototype) + Object.assign of the engine internals, stubbed dryCtx with a real in-memory getImageData/putImageData backing store, Float32 wet/savedWet buffers, dualCanvas + state.brushOpts). Header comment: the truth table markdown from the objective, verbatim, as the file's contract of record. Setup helpers: paintStroke(engine, points) driving acceptStroke/applyStrokeToEngine with physicsMode 'local' so the deposit stays wet (fresh cell), and bakeStroke(...) forcing the dry cell; eraseGesture(engine, points, force) calling setEraseStrength + the erase finalize path. Cell assertions exactly as the behavior block; on run, RECORD which target cells fail today (the RED evidence). Do NOT modify any production file in this task. If the harness cannot reach the erase finalize path through existing public/private seams, expose nothing new — drive it the same way the pointer tests drive onPointerUp plus the finalization flush the pointer/redraw tests already use.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/engine/EfxPaintEngine.eraseContract.test.ts</automated>
  </verify>
  <done>Contract test exists covering every cell of the table; W-S, W-P, D-P (50/25) target assertions FAIL against current code with the failing cell names recorded; D-S, R4, and knob-literal guard pins pass at base (probe has teeth); commit as test(261003-hpi): RED truth table for the erase contract.</done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2 (GREEN): dry-only pixel eraser + live whole-stroke removal with replay rebuild</name>
  <files>packages/efx-physic-paint/src/brush/erase.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.ts</files>
  <behavior>
  - erase.ts has ZERO writes to wetBuffers (the wet multiply/zero block at the current lines 114-120 is gone); the dry-canvas loop keeps bgMode transparent/non-transparent handling and bounds clamping.
  - D-P law holds: at full mask coverage, per-pass removal >= force/100 of remaining alpha; the existing cubic strMul is replaced by a curve that satisfies it (e.g. eraseMask = maskAlpha-scaled coverage x force/100 shaped so the centerline meets the bound at 0/25/50/75/100); mask rendering, ribbonWithScales + deformNScaled('erase-shape') seed flow, and measurePrimitive stage names kept.
  - W-S holds: the erase branch in applyStrokeToEngine (tool === 'erase') detects intersected recorded paint strokes with wet deposit BEFORE any drying, splices each target primary + its zero-point continuation entries out of allActions and out of undoStack/historyEntries together, then rebuilds surviving paint through the engine's own replay machinery (resetReplaySurface + replay of allActions, i.e. the redrawAll path) so survivor deposits re-deposit exactly; the rebuild runs only on the live finalize path — replay/render/animation callers of applyStrokeToEngine get pixel-only erase (explicit StrokeApplicationOptions marker; default = pixel-only).
  - W-P holds: the blanket forceDryAll('erase-final-force-dry') call is deleted (or provably reduced to nothing that reads/writes wet outside removed footprints) — untouched wet survives byte-identical across the gesture.
  - D-S holds: no entry/history mutation happens in the pixel path.
  - The erase gesture's own entry remains in allActions (replayable pixel effect); FIFO ordering of the finalization drain untouched.
  </behavior>
  <action>Implement the contract in two seams. In erase.ts: strip every wetBuffers write (the wet cell moves to the engine); replace strMul with the force-law curve; keep the mask raster, the 'erase-shape' seed, bg restore, and measurePrimitive stages. In EfxPaintEngine.ts applyStrokeToEngine's erase branch: (1) compute the gesture path + erase ribbon bounds; (2) when the call carries the live marker, iterate allActions newest-first, select tool 'paint' strokes whose ribbon (points expanded by brushRenderRadius(params) + variance margin) intersects the gesture path AND whose footprint has wet.alpha >= 1 at the intersection — for each, splice its primary and adjacent zero-point continuation entries from allActions and drop the matching undoStack/historyEntries records in the same operation (keep history indices/availability coherent); (3) if any target was removed, rebuild the surface via the existing redrawAll machinery instead of pixel surgery — NEVER hand-clear pixels per footprint (attribution is impossible and baked residue survives); (4) run the dry pixel eraser (applyEraseStroke) on the dry canvas; (5) drop the blanket forceDryAll('erase-final-force-dry'). Add the live marker to StrokeApplicationOptions and set it ONLY at the live finalize call site (applyFinalizedStroke/finishActiveStrokeSynchronously chain) — every other caller keeps pixel-only semantics so redrawAll, renderPartialStrokes, AnimationPlayer and load+render can never delete entries. If rebuild inside the drain proves unsafe (queued-finalization interaction), you may defer it to immediately after the drain turn PROVIDED all W-S observables hold once the erase mutation completes; if NEITHER placement can satisfy the contract without breaking the FIFO pins, STOP and report rather than weakening a cell. Run Task 1; every target cell must turn green with NO edits to Task 1 assertions.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/engine/EfxPaintEngine.eraseContract.test.ts src/brush/shapeDetail.test.ts src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts src/engine/EfxPaintEngine.redrawAllQueuedFinalizations.test.ts src/engine/EfxPaintEngine.pointerInput.test.ts src/core/lookLawDigest.test.ts src/brush/paint.depositSourceShape.test.ts src/brush/paint.bristleSeed.test.ts</automated>
  </verify>
  <done>All truth-table target cells green; the eight listed existing suites green with zero edits to any of them; erase.ts has zero wet-buffer writes and keeps 'erase-shape' + zero Math.random; commit as feat(261003-hpi): erase contract — wet removes the whole stroke, dry erases with force.</done>
</task>

<task type="auto">
  <name>Task 3: full-suite gate, guardrail scope proof, SUMMARY</name>
  <files>.planning/quick/261003-hpi-quick-erase-contract-fresh-whole-stroke-/261003-hpi-SUMMARY.md</files>
  <action>Run the full package suite and typecheck, then prove the guardrail scope against the quick base (HEAD recorded before the first commit — record it in the SUMMARY): the changed-file list must contain ONLY the new contract test, erase.ts, EfxPaintEngine.ts and the SUMMARY (plus nothing under app/, compositor.ts, drying.ts, wet-layer.ts, types.ts, paint.ts, stroke.ts, footprintLanes.ts, spreadScale.ts, paper.ts — these must show an EMPTY diff in the same `<quick-base>...HEAD` range). Re-run the knob literal pins and the R4 anti-alignment cell explicitly as guardrail evidence. Write the SUMMARY with status automated-ready, the RED evidence (which truth-table cells failed today and the measured pass-counts), the exact green commands, and these native UAT rows verbatim as pending: (a) One erase swipe over still-wet paint makes the whole stroke vanish at once — no ghosting — and it stays gone after save/reload. (b) On dry paint the eraser really erases: full force clears in one pass, 50 in a few passes, the force slider visibly changes speed — no more endless lightness. (c) A swipe never damages or prematurely dries neighboring strokes it did not cross; those fresh strokes still whole-stroke-erase on a later swipe. (d) The erased edge keeps the brush's torn texture that never lines up with the painted mark, and painting looks completely unchanged (deposit/paper look law frozen). (e) Undo stays coherent after an erase: no crashes, no resurrected strokes, counters honest. Never push. Commit as docs(261003-hpi): quick summary.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run && cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-physic-paint run check && FILES=$(git diff --name-only <quick-base>...HEAD) && printf '%s\n' "$FILES" | grep -v '^\.planning/' | grep -cv 'brush/erase\.ts\|engine/EfxPaintEngine\.ts\|eraseContract\.test\.ts' | grep -qx 0</automated>
  </verify>
  <done>Full package suite green, typecheck clean, scope proof shows only the three source files changed (zero app/** and zero look-law/frozen-knob file diffs), SUMMARY written with automated-ready status and the five pending native UAT rows.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Renderer-internal TypeScript contract change — no external input, network, storage, or package installs |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|----------------|
| T-hpi-01 | Tampering | one look law + frozen knobs (compositor.ts wetDisplayAlpha, drying.ts, wet-layer.ts literals 40/4500/0.5) | high | mitigate | those files diff EMPTY (Task 3 scope proof) + knob literal assertions in the contract test; erase never imports or reimplements a transfer alpha |
| T-hpi-02 | Tampering | stroke history structures (allActions / undoStack / historyEntries) during whole-stroke removal | high | mitigate | contract cells pin entry removal as an atomic group operation, history-coherence cell (availability + no-crash, no-resurrect undo), and the cooperativeFinalization/pointerInput/redrawAll suites must pass with zero edits |
| T-hpi-03 | Repudiation | "it works" claims on erase feel | medium | mitigate | verdict stays automated-ready; five native UAT rows recorded pending in the SUMMARY (never claim done before live UAT) |
| T-hpi-SC | Tampering | npm/pip/cargo installs | high | mitigate | no installs in this quick — package-legitimacy gate not applicable |
</threat_model>

<verification>
- RED evidence: which truth-table cells failed against the pre-change engine (recorded in commit + SUMMARY).
- Target cells green: W-S (force 50/100 + force-0 inert), W-P byte-identical-outside + wet-stays-wet, D-P pass law (100->1, 50->8, 25->21, monotone, 0->none), D-S unchanged counts, R4 anti-alignment, knob literals 40/4500/0.5.
- Existing gates with zero edits: shapeDetail, cooperativeFinalization, redrawAllQueuedFinalizations, pointerInput, lookLawDigest, depositSourceShape, bristleSeed — full suite + tsc.
- Test commands (prior_verify_commands, reuse verbatim): package — cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run <paths>; typecheck — cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-physic-paint run check. NEVER watch mode; no dev server (CLAUDE.md); pnpm only; never push.
- Scope proof: changed files limited to erase.ts, EfxPaintEngine.ts, the new contract test (+ .planning SUMMARY); app/**, compositor.ts, drying.ts, wet-layer.ts, types.ts, paint.ts, stroke.ts, footprintLanes.ts, spreadScale.ts, paper.ts EMPTY diff.
- Native UAT (pending, recorded in SUMMARY): the five rows (a)-(e) in Task 3.
</verification>

<success_criteria>
All truth-table cells green on one contract implementation; full package suite + typecheck green with zero existing-test edits; guardrail diff EMPTY on app/** and every look-law/frozen-knob file; SUMMARY automated-ready with five native UAT rows pending; commits: RED test, GREEN feat, docs summary.
</success_criteria>

<output>
Create `.planning/quick/261003-hpi-quick-erase-contract-fresh-whole-stroke-/261003-hpi-SUMMARY.md` when done
</output>
