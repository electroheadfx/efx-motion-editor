---
phase: quick-260930-q6t
plan: 260930-q6t
type: tdd
status: complete
tasks: 1
commits: 1
plan_head_before: 0f87a1160161cad41975f4fd35e30d39d7584872
date: 2026-09-30
subsystem: physic-paint
tags: [physics-paint, bake-parity, drying, attribution, tdd, halted]

requires: []
provides:
  - "Pixel-level attribution of the /800 dry transfer vs Beer-Lambert display law (54-sample delta table, RED-EVIDENCE.json)"
  - "drying.parity.test.ts: characterization pins A/B/C + bake-parity target (parity target RED at base)"
affects: [QUICK-260930-Q6T]

actuals:
  tokens: 5300    # chars/4 over the realized diff (21,051 bytes)
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns: ["mock-canvas dual-harness (ImageData fake ctx) pinning display and dry laws in one grid"]

key-files:
  created:
    - packages/efx-physic-paint/src/core/drying.parity.test.ts
    - .planning/quick/260930-q6t-bake-parity-urgent-paint-loses-consisten/260930-q6t-RED-EVIDENCE.json
  modified: []

key-decisions:
  - "HALT at the Task 1 STOP gate: measured dry-side alpha is denser-or-equal than the display at ALL 54 samples (47 denser, 7 equal, 0 lighter) while the plan records the reported symptom as lightening - per the plan's STOP condition the /800-vs-Beer-Lambert mismatch cannot be the loss mechanism for a lightening symptom, so Tasks 2 and 3 did not run"
  - "Perceptual caveat recorded for user direction: denser transferred alpha APPEARS lighter when the paint color is lighter than the substrate - if that is the observed symptom, the attribution flips to proceed and the quick resumes at Task 2 with the RED suite already in place"
  - "Task 3 timing report withheld: the STOP case mandates 'commit nothing beyond the evidence file'"

requirements-completed: []
---

# 260930-q6t SUMMARY — Bake parity (URGENT — paint loses consistency after leave/close)

**Verdict: HALTED at the Task 1 attribution gate — not automated-ready.**
The hard STOP condition fired (measured direction contradicts the reported
symptom direction). Task 1 (RED) landed complete with evidence; Task 2
(unification) and Task 3 (timing) did **not** run. Native UAT pending — but the
quick awaits the user's direction on the attribution first.

## Objective

Make paint survive leave/close looking exactly as it did at end of bake:
attribute in pixels whether the /800 dry-transfer law (core/drying.ts) diverges
from the Beer-Lambert display law (render/compositor.ts wetDisplayAlpha), and
only if the divergence can explain the reported loss, unify the transfer on the
display law. RED first, production edits only after a proven attribution.

## Outcome — HALT (Task 1 complete, STOP gate answered)

| Task | Result |
|------|--------|
| 1 — RED: pin both laws + attribute | **DONE** — 3 characterization pins green, parity target RED (assertion), evidence committed, verdict **halt** |
| 2 — GREEN: unify on wetDisplayAlpha | **NOT RUN** — precondition reads `halt`; no production file edited |
| 3 — Bake timing (measure-only) | **NOT RUN** — STOP case: "commit nothing beyond the evidence file" |

## RED attribution evidence

Command: `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/drying.parity.test.ts`
Result: exit 1 — **4 tests: 3 passed, 1 failed, 0 crashes** (AssertionError on
the parity target, not a crash / not zero-test discovery).

Failing assertion (RED):

```
AssertionError: bake parity broken at base: 44/54 samples differ by more than
1 alpha unit (dry transfer and display disagree) — first mismatches:
alpha=40 op=0.85 ph=1: display=8 dry=11 delta=-3;
alpha=40 op=1 ph=0: display=4 dry=13 delta=-9;
alpha=40 op=1 ph=0.5: display=4 dry=13 delta=-9;
alpha=40 op=1 ph=1: display=4 dry=13 delta=-9;
alpha=120 op=0.4 ph=0.5: display=13 dry=15 delta=-2
: expected [ ...(44) ] to deeply equal []
```

Green at base: pin A (forceDryAll = `round(min(1, alpha/800)*op*255)`, 54/54),
pin B (compositeWetLayer = `round(wetDisplayAlpha(alpha, op, ph))`, 54/54),
pin C (floors: max |delta| 175 ≥ 150, dry-denser 47/54 ≥ 40, >1 unit 44/54 ≥ 30).

### Per-sample delta table (delta = display − dry; negative = dry denser)

| alpha | op | ph | display | dry | delta |
|------:|---:|---:|--------:|----:|------:|
| 40 | 0.4 | 0 | 5 | 5 | 0 |
| 40 | 0.4 | 0.5 | 5 | 5 | 0 |
| 40 | 0.4 | 1 | 4 | 5 | −1 |
| 40 | 0.85 | 0 | 11 | 11 | 0 |
| 40 | 0.85 | 0.5 | 10 | 11 | −1 |
| 40 | 0.85 | 1 | 8 | 11 | −3 |
| 40 | 1.0 | 0 | 4 | 13 | −9 |
| 40 | 1.0 | 0.5 | 4 | 13 | −9 |
| 40 | 1.0 | 1 | 4 | 13 | −9 |
| 120 | 0.4 | 0 | 15 | 15 | 0 |
| 120 | 0.4 | 0.5 | 13 | 15 | −2 |
| 120 | 0.4 | 1 | 12 | 15 | −3 |
| 120 | 0.85 | 0 | 32 | 33 | −1 |
| 120 | 0.85 | 0.5 | 29 | 33 | −4 |
| 120 | 0.85 | 1 | 25 | 33 | −8 |
| 120 | 1.0 | 0 | 12 | 38 | −26 |
| 120 | 1.0 | 0.5 | 12 | 38 | −26 |
| 120 | 1.0 | 1 | 12 | 38 | −26 |
| 300 | 0.4 | 0 | 34 | 38 | −4 |
| 300 | 0.4 | 0.5 | 30 | 38 | −8 |
| 300 | 0.4 | 1 | 27 | 38 | −11 |
| 300 | 0.85 | 0 | 71 | 81 | −10 |
| 300 | 0.85 | 0.5 | 64 | 81 | −17 |
| 300 | 0.85 | 1 | 56 | 81 | −25 |
| 300 | 1.0 | 0 | 30 | 96 | −66 |
| 300 | 1.0 | 0.5 | 30 | 96 | −66 |
| 300 | 1.0 | 1 | 30 | 96 | −66 |
| 800 | 0.4 | 0 | 67 | 102 | −35 |
| 800 | 0.4 | 0.5 | 62 | 102 | −40 |
| 800 | 0.4 | 1 | 57 | 102 | −45 |
| 800 | 0.85 | 0 | 142 | 217 | −75 |
| 800 | 0.85 | 0.5 | 132 | 217 | −85 |
| 800 | 0.85 | 1 | 122 | 217 | −95 |
| 800 | 1.0 | 0 | 80 | 255 | **−175** |
| 800 | 1.0 | 0.5 | 80 | 255 | **−175** |
| 800 | 1.0 | 1 | 80 | 255 | **−175** |
| 1500 | 0.4 | 0 | 88 | 102 | −14 |
| 1500 | 0.4 | 0.5 | 86 | 102 | −16 |
| 1500 | 0.4 | 1 | 84 | 102 | −18 |
| 1500 | 0.85 | 0 | 187 | 217 | −30 |
| 1500 | 0.85 | 0.5 | 182 | 217 | −35 |
| 1500 | 0.85 | 1 | 178 | 217 | −39 |
| 1500 | 1.0 | 0 | 150 | 255 | −105 |
| 1500 | 1.0 | 0.5 | 150 | 255 | −105 |
| 1500 | 1.0 | 1 | 150 | 255 | −105 |
| 2600 | 0.4 | 0 | 99 | 102 | −3 |
| 2600 | 0.4 | 0.5 | 96 | 102 | −6 |
| 2600 | 0.4 | 1 | 94 | 102 | −8 |
| 2600 | 0.85 | 0 | 210 | 217 | −7 |
| 2600 | 0.85 | 0.5 | 205 | 217 | −12 |
| 2600 | 0.85 | 1 | 199 | 217 | −18 |
| 2600 | 1.0 | 0 | 255 | 255 | 0 |
| 2600 | 1.0 | 0.5 | 255 | 255 | 0 |
| 2600 | 1.0 | 1 | 255 | 255 | 0 |

Summary: **dry denser 47/54 · display denser 0/54 · equal 7/54 · max |delta| 175**.
The /800 transfer saturates at alpha=800; the display fast path needs
alpha=2550 to saturate — the dry side is never lighter than the display.

### Attribution verdict: **halt**

- **(i)** Characterization pins green with the numbers above. ✅
- **(ii)** Persistence is the raster-byte path — code trace:
  - Leave: `useRotoPersistenceIntegration.ts:75` `navigateToSyncedFrame` → `:80`
    `flushPendingStrokeFinalizations()` → `:82` `flushFramePublication(sourceFrame)`
    → `:90` `engine.clear()` only after publication returns.
  - Close: `PhysicsPaintStudio.tsx:2014-2015` `runStudioFlush` steps
    `flushPendingStrokeFinalizations` → `rotoPersistence.flushLivePixels`.
  - Flush→transfer: `EfxPaintEngine.ts:2162` (flush def) → `:2385`
    `forceDryAll(..., 'paint-final-force-dry', dryRegionForStroke(...))`
    (also `:1230 :1257 :2559 :2678 :2695`).
  - Capture: `EfxPaintEngine.ts:1584-1596` `exportCompositeCanvas` — flush `:1585`,
    draw dry `:1592`, draw display `:1593` (wet display IS captured); live-pixel
    capture `copyLiveAlphaCanvas` `:1632` draws display at `:1685`. The dry-only
    `getBakedCanvas` (`:1557-1569`) is monitor-overlay-only
    (`PhysicsPaintStudio.tsx:3836`), never publication.
  - Codec: `webpFrameCodec.ts:46-56/:83` — Rust `encode_webp_frame`,
    WebP-lossless; reloaded render is bit-exact, no stroke re-render.
    ✅ raster-byte path confirmed.
- **(iii) Direction check — NOT capable of explaining the reported loss.**
  The plan records the symptom as **lightening** after leave/close; the
  measurement shows the flush transfer only ever **increases** alpha versus what
  the overlay displayed (47/54 denser, 0/54 lighter, worst −175 at
  alpha=800/op=1.0: display 80 → dry 255). A lightening symptom requires the dry
  side to land lighter. **STOP CONDITION triggered** (plan: "dry side denser
  across the sample grid while the live symptom is lightening → the
  /800-vs-Beer-Lambert mismatch is not the loss mechanism").

### Traced candidate causes (for user direction)

1. **Ruled out — capture drops wet display**: both capture paths draw dry THEN
   display (`EfxPaintEngine.ts:1592-1593`, `:1685`); `getBakedCanvas` is not in
   publication.
2. **Ruled out — reload re-renders from strokes**: WebP-lossless byte round-trip
   (`webpFrameCodec.ts:46-56/:83`).
3. **Open — dryStep's divergent paper formula** (`drying.ts:127-135`):
   `clamp(1.4 − ph*0.8, 0.3, 1.4)` → 0.6× at full paper, while the display fast
   path (`compositor.ts:35-36`, op ≥ 0.90) applies **no** paper at all —
   during-bake dry accumulation and displayed wet disagree about paper.
4. **Open — bbox-scoped flush** (`EfxPaintEngine.ts:2385` +
   `dryRegionForStroke`): wet physics-drifted outside the stroke bbox is not
   zeroed by that loop; it stays wet until a differently-bounded forceDryAll
   (`:2559` lastStrokeBounds, `:1257` full frame) or clear — a possible seam.
5. **Perceptual caveat**: denser alpha *appears* lighter when the paint color is
   lighter than the substrate (more of the light paint color). If the reported
   "lightening" is solidification of light paint, the measured delta DOES
   explain it and the verdict flips to **proceed** — per the plan's literal STOP
   condition the executor halts for the user to confirm the observed direction.

## GREEN evidence

**Not reached.** Task 2's precondition (`attribution verdict == "proceed"`)
reads `halt`, so no production file was edited: `drying.ts`, `EfxPaintEngine.ts`
and `compositor.ts` are byte-identical to base. The unified-law anchors,
six-threaded `forceDryAll` call sites and green parity suite described in the
plan remain the Task 2 spec for a fast resume once direction is confirmed
(the RED suite already exists to drive it).

## Timing

Task 3 (measure-only timing report) **did not run** — the STOP case mandates
"commit nothing beyond the evidence file"; no `TIMING.json` was produced. The
verify greps confirm no timing constant changed: `}, 16)` ×1, `drySpeed: 100` ×1
in `EfxPaintEngine.ts` (both untouched).

## Scope-guard diff file list (whole quick commit series)

```
.planning/quick/260930-q6t-bake-parity-urgent-paint-loses-consisten/260930-q6t-RED-EVIDENCE.json
packages/efx-physic-paint/src/core/drying.parity.test.ts
```

Only files from `files_modified`. `render/compositor.ts`, `drying.ts`,
`EfxPaintEngine.ts`, `spreadScale.ts`, `fluids.ts`, `diffusion.ts`,
`package.json`, `pnpm-lock.yaml`, `ROADMAP.md` — all absent from the diff.
Guard battery: not re-run (no production edit; battery files untouched).

## Native UAT rows (user-side — ALL PENDING)

| # | Row | Status |
|---|-----|--------|
| 1 | End-of-bake look is pixel-equal after leave/return and after Studio close | pending (blocked on attribution direction) |
| 2 | Reloaded paint matches the end-of-bake screenshot | pending |
| 3 | Existing painted content re-judged under the unified transfer (accepted look change) | pending (Task 2 not run) |
| 4 | Bake timing report attached with numbers, no behavior change | pending (Task 3 not run) |

**Nothing is declared done before native UAT.**

## Commits

- `6b30fb85` — `test(260930-q6t): pin display vs dry alpha divergence (RED)`
  (drying.parity.test.ts + RED-EVIDENCE.json)

## Deviations from Plan

**1. [Hard STOP] Task 2 and Task 3 not run — attribution verdict `halt`**
- **Found during:** Task 1 attribution gate
- **Issue:** measured dry ≥ display at all 54 samples (dry denser 47, equal 7,
  display lighter 0) while the plan records the reported symptom as lightening —
  the exact STOP antecedent the plan armed
- **Action:** RED test + evidence committed; no production edit; quick halted
  for user direction (plan: "report the actual measured mechanism plus the
  traced candidate causes for the user to direct the follow-up")
- **Commit:** `6b30fb85`

**2. [Constraint conflict] Summary verdict line**
- The dispatch constraint asked the verdict line to read "automated-ready —
  native UAT pending"; the plan's hard STOP (which the dispatch also ordered
  honored literally) requires reporting the halt. The halt verdict is written
  as the outcome; claiming automated-ready with Tasks 2-3 unrun would misreport
  the quick's state.

## Self-Check: PASSED

- FOUND: `packages/efx-physic-paint/src/core/drying.parity.test.ts`
- FOUND: `.planning/quick/260930-q6t-bake-parity-urgent-paint-loses-consisten/260930-q6t-RED-EVIDENCE.json`
- FOUND: commit `6b30fb85` (git log)

---

## Addendum B — mechanism measurement

**Verdict: measure-only complete, PENDING LIVE capture.** The fix (Plan A
Task 2 alpha-model unification) remains gated — nothing is implemented.

Commits: `f7b5677d` (headless proof, RED-first) → `4e064c41`
(instrumentation + MEASURE-EVIDENCE.json). Ordering guard honored: proof
before instrumentation.

### Headless bbox-loss numbers (`drying.bboxLoss.test.ts`, 6/6 green)

Seeded grid 20×10, bounds = cols 6..9 × rows 3..6 (16 inside px @ alpha 400),
drift zone cols 10..11 × rows 3..6 (8 px @ alpha 700, OUTSIDE bounds),
opacity 1:

| Quantity | Value |
|----------|------:|
| Inside transfer per px (`round(min(1,400/800)*1*255)`) | 128 |
| Dry gained total | 2048 |
| Dry gained outside bbox | **0** |
| Wet total alpha before flush | 12000 |
| Wet alpha stranded outside bounds after forceDryAll | **5600 (46.67%)** |
| Would-be outside transfer (full-frame bbox) | 1784 |

Assertions (i)/(ii)/(iii) prove: inside mass transfers and zeroes wet; outside
mass never transfers and stays in the wet buffer at full alpha; dry's gain
equals exactly the inside-bbox transfer. Mechanism: `forceDryAll` is
bbox-clamped (drying.ts:197-240), so physics-drifted wet outside
`dryRegionForStroke` survives the flush in the wet buffer and is destroyed
when the engine clears on leave/close.

### Paper-gap helper unit checks

`bakeParityPaperMods` (pure, exported from EfxPaintEngine) is unit-checked
AGAINST compositor's paperMod through `wetDisplayAlpha` — compositor imported
and read, never edited (3 tests green): slow-path display mod matches the
compositor law to 10 decimals; display mod = 1 at pixelOpacity ≥ 0.90 (fast
path); transfer mod = `clamp(1.4 − ph*0.8, 0.3, 1.4)` (1.4 / 1.0 / 0.6 / 0.3
at ph 0 / 0.5 / 1 / 2, null paper map → 1); forceDryAll mod = 1 everywhere.

### Live capture — pending, field list + route

Route: user runs the app in DEV with `localStorage efx.physicsPaint.profile =
'1'`, paints a medium/dark navy pigment stroke on light paper, then leaves the
painted key or closes Studio → the app writes
`/tmp/efx-bake-parity-capture.json` → Claude reads it from disk. Gated on the
existing profiling surface (`window.__EFX_PHYSICS_PAINT_PROFILE__.enabled()`
+ performance listener); capture runs only at flush/export time.

Pending fields (full list in MEASURE-EVIDENCE.json):
- **flush**: bbox + bboxSource; wet_total/inside/outside (alpha + pixels);
  dry_alpha_before/after (+ outside before/after);
  wet_after_flush_outside_alpha; forceDryAll_ran + transfer_bbox +
  transfer dry before/after (actual :2385/:2678 sites); paper_gap
  (transfer_paper_mod_sum, display_paper_mod_sum, paper_gap_sum =
  display − transfer, forceDryAll_paper_mod_sum = 1.0); captureId, timestamp,
  frameId (null — engine carries no frame identity), paperStrength (mapped
  from `state.embossStrength`), paperGrainKey, paperHeightMapPresent.
- **export** (pairs by captureId, sampled from `exportCompositeCanvas` and
  `copyLiveAlphaCanvas`): export_composite_alpha_in/outside_bbox_region,
  display_alpha_outside_bbox_region, export_composite_includes_outside_mass.
- **top-level**: schema `efx-bake-parity-capture/1`, wet_outside_share_of_total,
  decision_rule.

### Decision rule as applied

**Status: PENDING-LIVE** — the synthetic headless seed strands 46.67% (well
over 5%), but the threshold applies to the LIVE leave/close capture:
- live `wet_outside_alpha ≥ 5%` of `wet_total_alpha` → bbox hypothesis stands
  (report numbers, await direction on the fix — do not implement);
- live `< 5%` → **HALT**, bbox hypothesis refuted, reopen the paper-gap branch
  with the `paper_gap` numbers already in the same capture file.

No fix implemented either way; Plan A Task 2 stays gated.

### Scope-guard diff file list (addendum commits `6c7ec8d3..4e064c41`)

```
.planning/quick/260930-q6t-bake-parity-urgent-paint-loses-consisten/260930-q6t-MEASURE-EVIDENCE.json
app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
packages/efx-physic-paint/src/core/drying.bboxLoss.test.ts
packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
```

Only plan-listed files. `compositor.ts`, `drying.ts` alpha math,
`spreadScale.ts`, `fluids.ts`, `diffusion.ts`, `package.json`,
`pnpm-lock.yaml`, `ROADMAP.md` absent. Guard literals: `}, 16)` ×1,
`drySpeed: 100` ×1 (both untouched). EfxPaintEngine diff is capture-only —
forceDryAll call lines byte-identical. Guard battery green with zero edits.
Full package suite: 286 passed / 1 failed (the failure is Plan A Task 1's
intentional parity RED — pre-existing, gated, not in the battery). Package
`check` and app `typecheck` pass. `drying.parity.test.ts` parity target still
RED at base as designed.

### Addendum B note on the frontmatter verdict

Frontmatter `status: complete` / HALT verdict above describe **Plan A Task 1**.
This addendum is measurement only: the mechanism is now pinned headlessly with
numbers, the live capture is instrumented and awaiting one user paint+leave
round-trip, and the fix remains unimplemented pending that capture.
