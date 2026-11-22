---
phase: 64-medium-engine
reviewed: 2026-11-22T20:04:51Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
  necessity: 1
status: issues_found
---

# Phase 64: Code Review Report — plan 64-31 delta

**Reviewed:** 2026-11-22T20:04:51Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Adversarial deep review of the 64-29/64-31 probe delta since `d21e4b38` (11 commits, +2,862/−280 in the four probe files; the baselines directory is untouched and `git status` is clean). No `<structural_findings>` block was provided, so there is no fallow section.

The coverage-vocabulary rename is consistent end to end (`coverageMean`/`coverageStats`/`coverageSpread` wrappers, every comparator consumer follows the rename, `darkAlphaMean` keeps the darkness claims on the transparent export), and the engine arithmetic behind the display law checks out: mode 2 is `vec4(lit, 1.0)`, mode 4's alpha is `clamp(1 - tMin, 0, 1)`, `min(lit) == tMin`, so `pigment alpha == 255 − min(transparent rgb)` up to rounding whenever `uUnderlayOn == 0` (which every export path guarantees, `shaders.ts:1824`).

Two defects are blockers, both reproduced against the real probe on this tree:

1. The visible-alpha sampler's fixed prime stride collapses into a right-edge lattice at every power-of-two sheet size. On the default 256 sheet the 17 samples never touch the `neutral` stroke, so the probe emits `visibleAlphaMaxDelta: null` / `visibleAlphaSamples: 0` and the comparator fails the capture — including the canonical `neutral-identity` gate, whose three exported digests are byte-identical to the committed baseline. 64-36's re-capture cannot turn this green; only a sampler fix can.
2. Moving the covered-paper-white census's covered set to `exportCoverageCanvas` bypasses the engine's `coverClearFS` coherence closure (`shaders.ts:582-620`, `Engine.ts:2209-2217`, pigment-only). A fresh canonical `white-over-blue` 1080/body-100 capture — its paper/transparent/white digests identical to the committed baseline — now reports `coveredPaperWhitePct 0.01` (3 of 40,579 covered texels) and fails the absolute-zero bar in `--other` mode against itself.

The five remaining warnings cover the 1-in-4093 spot-check being unable to deliver the "single translucent pixel" guarantee the plan claims, the executed synthetics never executing the probe-side checks (131/131 tests pass while the real default capture fails), the 17 stale baselines now failing by design but not pinned as such, a skip-record/reference validation gap in `alphaLawFailures`, and the fact that only one of the five re-specified coverage gates was re-captured after the channel swap. Necessity review (rubric read): one trivial impossible-state fallback, recorded as Info.

Verification executed for this review: `vitest run probe/medium-engine/harness.test.ts` → 131/131 pass; fresh probes `review-neutral-256`, `review-neutral-512`, `review-cover-lift-1080`, `review-cover-advect-1080`, `review-white-over-blue-1080` (default body) and `review-white-over-blue-b100` (body 100); comparator runs in `--other` and baseline modes documented per finding.

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: BLOCKER — the visible-alpha sample lattice never reaches the paint at power-of-two sheet sizes

**File:** `packages/efx-watercolor/probe/medium-engine/probe.ts:376` (`ALPHA_LAW_STRIDE = 4093`), `:449-479` (`visibleAlphaCheck`); `packages/efx-watercolor/probe/medium-engine/compare.mjs:201-206` (non-bristle null failure)
**Severity:** BLOCKER
**Issue:** The stride is fixed at 4093 and the sample positions are `k * 4093` in a linear RGBA index. Because 4093 = 16·256 + 253 = 16·512 + 509 = 2^n·w − 3 for every power-of-two width (256, 512, 1024, 2048), each consecutive sample moves a full number of rows and −3 columns. On the default 256×256 sheet there are exactly 17 samples, occupying columns {0} ∪ [208, 255] and rows {0, 15, 31, …, 255}. The canonical `neutral` stroke spans x ≈ 77..179, rows 97..179 (`STROKE_POINTS` uv 0.30–0.70, `probe.ts:268-273`); no sample lands on it, or near it. The check therefore reports `visibleAlphaMaxDelta: null`, `visibleAlphaSamples: 0`, `visibleAlphaWorstAt: null`, and `alphaLawFailures` fails every non-bristle capture whose delta is null with "the visible-alpha check cannot be skipped for this scenario". This is not theoretical — it reproduces on this tree:

- `node run.mjs --gate review-neutral-256` → `visibleAlphaMaxDelta: null, visibleAlphaSamples: 0`; the capture's `digestPaper`/`digestTransparent`/`digestWhite` (`d2bd637a`/`291d4a11`/`6ba88334`) are byte-identical to the committed `baselines/neutral-identity.json`, so the scene is the baseline scene.
- `node compare.mjs review-neutral-256 --other review-neutral-256` → `RESULT: FAIL — 0 differing field(s), … 1 alpha law failure(s)`.
- `node run.mjs --gate review-neutral-512 --size 512` → still `samples: 0, delta: null` (the 65-sample diagonal stays right of the stroke at the rows the stroke occupies).
- Baseline mode (`compare.mjs neutral-identity` with the fresh 256 capture) → `0 differing fields, 5 missing, 1 alpha law failure`.

The consequence is operational: the expected capture is no longer reproducible, and 64-36 cannot restore a green `neutral-identity` gate by re-capturing — the fresh capture fails its own law check whether or not it is committed. Any non-bristle scene whose paint misses the sampled set (sparse strokes on any size, all sparse scenes at 256) has the same fate. The acceptance evidence only ran `cover-textured` at 512, whose wash happens to cross the lattice (6 painted samples).

**Fix:** make the sample set sheet-aware and guarantee painted coverage. The cheapest correct form is a full scan: three 1080² surfaces measured ~7 ms in Node on this machine versus a 34–134 ms render phase, so the "whole-sheet scan pays for no new evidence" premise is false. If a stride must stay, derive it from the sheet width (`gcd(stride, width) == 1` and not ≡ ±1..±3 mod width) and additionally verify in the probe that the coverage raster proves paint exists while the pigment scan found zero painted samples — in that case fail the probe naming the sheet size instead of emitting a null that the comparator must reject. Keep the comparator's null-failure as the backstop, but add `visibleAlphaSamples === 0` to its condition so a hand-edited `delta: 0, samples: 0` cannot pass.

### CR-02: BLOCKER — the covered-paper-white census reads a channel the engine's coherence clear never touches

**File:** `packages/efx-watercolor/probe/medium-engine/probe.ts:714-761` (`coveredPaperWhiteBox`), `:770-777` (`coveredPaperWhitePct`), `:1088-1089` (white-over-blue calls), `:1234`, `:2894-2896`, `:2917`; `packages/efx-watercolor/probe/medium-engine/compare.mjs:323-327` (white-over-blue bar; plus the identical bars at `:427`, `:468`, `:553`, `:590`)
**Severity:** BLOCKER
**Issue:** 64-31 moved the census's covered set from the pigment export's alpha to `engine.exportCanvas('coverage')`. But the engine closes this census by construction only on the pigment path: `readback` runs `clearPaperWhiteCoverage` for `MODE.pigment` only (`Engine.ts:2209-2217`), zeroing the claim where the final film reads paper-white (`coverClearFS`, `shaders.ts:598-620`: "the census is closed at the capture boundary by coverClearFS"). `exportCoverageCanvas` (`Engine.ts:1571-1589`) reads the raw cover half and applies no clear. The census therefore now counts raw coverage claims, including texels whose finished film is legitimately paper-white, and the absolute-zero bar fails.

Reproduced on unchanged pixels with the canonical invocation at the committed size and body:

- `node run.mjs --gate review-white-over-blue-b100 --scenario white-over-blue --size 1080 --body 100` → `crossCoverage 0.95`, `coveredPaperWhitePct 0.01`, `coveredPaperWhiteBox { covered: 40579, count: 3, box: … }`; `digestPaper 905823e6`, `digestTransparent a5c4ebd6`, `digestWhite 2bf6f14b` — byte-identical to `baselines/white-over-blue.json`.
- `node compare.mjs review-white-over-blue-b100 --other review-white-over-blue-b100` → `INVARIANT coveredPaperWhitePct 0.01 is not 0` / `RESULT: FAIL — 0 differing field(s), … 1 scenario invariant(s) failed`.
- The pre-64-31 capture of the same pixels recorded `coveredPaperWhitePct 0` because the covered set was the pigment export's cleared alpha.

So a correct capture fails against itself, and 64-36's re-capture of `white-over-blue` would commit a baseline that fails its own invariant. The same census feeds `cover-advect`, `cover-lift`, `cover-textured` and `red-over-blue-50`; the freshly captured advect/lift scenes happen to read 0, but the definition is now unclosed for any scenario whose cover pigment can leave paper-white film.

**Fix:** close the census on the channel it reads. Either (a) keep the census's covered set on the pigment export's cleared alpha (the engine's coherence guarantee) and read only `crossCoverage`/`coverageSpread` from the coverage raster, or (b) apply the same film-presence clear to `exportCoverageCanvas` at the export boundary so the raster is coherent by construction — an engine change and a new pass, i.e. a later plan, not this one. Option (a) is the minimal fix that keeps the plan's no-engine-change promise. Whichever is chosen, re-run all five coverage scenarios at their canonical sizes before 64-36; do not lower the zero bar.

### Warnings

### WR-01: BLOCKER-class weakness downgraded to WARNING — 1-in-4093 sampling cannot deliver the "single translucent pixel" guarantee the plan advertises

**File:** `packages/efx-watercolor/probe/medium-engine/probe.ts:369-376`, `:410-424`, `:449-479`; `packages/efx-watercolor/probe/medium-engine/harness.test.ts:1878-1888`
**Severity:** WARNING
**Issue:** `probe.ts:372-374` states "the verdicts are exact at every sampled texel (a single translucent export pixel still fails the opaque check)", and the executed test is titled "fails one translucent pixel". Both are true of the comparator branch with a fabricated `opaqueExportMinAlpha: 254`, and false of the real probe: a single off-law texel has a 1/4093 chance of being sampled, and the accepted 64-31 evidence itself recorded only 6 painted samples on the whole 512 sheet (`/tmp/medium-engine/64-31-law-cover-textured.json`), 19–24 at 1080 in this review's fresh captures, and 0 for `neutral` at 256 and 512. Any regression confined to a stroke or a region can pass the capture check. Separately, the `alpha === 0` skip at `probe.ts:462` is justified by "its RGB is the un-premultiplied zero, not a darkness reading" — but the check reads the pigment alpha against the **transparent** export's RGB (`data = transparent.pixels`), whose alpha is always 255 (`shaders.ts:2002-2009`) and whose RGB at a zero-alpha pigment texel is the lit paper (darkness ≤ 1 on the 8-bit grid), so excluded texels would pass. The skip is a "painted-only" filter, not a correctness requirement, and it is what makes a zero-sample capture possible.

**Fix:** scan every pixel (measured ~7 ms for three 1080² surfaces) or restate the check as a spot-check and drop the single-pixel guarantee; rename the test to "the comparator fails a capture that reports a translucent pixel". Rewrite the skip comment to say it counts painted texels only because blank ones carry no evidence — not because their RGB is corrupt.

### WR-02: WARNING — the executed synthetics never execute the probe-side checks, and the source pins lock the defective stride

**File:** `packages/efx-watercolor/probe/medium-engine/harness.test.ts:425-453`, `:829-860`, `:1855-1957`
**Severity:** WARNING
**Issue:** `opaqueExportCheck`/`visibleAlphaCheck` appear only as `expectContains(PROBE, 'function …(')` source pins. Every executed law test builds its fixture from `baseCapture`, which fabricates `opaqueExportMinAlpha: 255` and `visibleAlphaMaxDelta: 0, visibleAlphaSamples: 1000`; the tests discriminate the **comparator** (and do so well) but nothing exercises the sampler over a real buffer. The pin at `:427` (`const ALPHA_LAW_STRIDE = 4093`) then freezes the exact constant that causes CR-01. Result: 131/131 tests pass while the default-sheet capture fails its own law check. The fixture's `width: 1080` also means no test ever sees the 256 default.

**Fix:** extract the law helpers into a small module imported by `probe.ts` and the harness (or export them), and execute them on synthetic `Uint8ClampedArray` buffers: a 256×256 scene with a stroke-like painted region must yield ≥ 1 painted sample and must find a planted two-step disagreement; a fixture with one alpha-254 texel among 65k must prove whether the check can see it (under the current stride it cannot — that is the point of the test). Parameterize the stride so the lattice argument is testable.

### WR-03: WARNING — all 17 committed baselines now fail five new fields; the expected-red state is not pinned anywhere

**File:** `packages/efx-watercolor/probe/medium-engine/compare.mjs:139`, `:144`, `:1449-1479`; `packages/efx-watercolor/probe/medium-engine/baselines/*.json` (17 files)
**Severity:** WARNING
**Issue:** `FIELDS` gained `opaqueExportMinAlpha`, `opaqueExportMinAlphaSurface`, `visibleAlphaMaxDelta`, `visibleAlphaSamples`, `visibleAlphaWorstAt`; no committed baseline carries any of them (verified by grep), and `REFERENCE_OPTIONAL` still exempts only `digestPigment` on `neutral-identity`. In baseline mode every gate therefore reports 5 `MISSING` lines and exits 1 (reproduced: `compare.mjs neutral-identity` → 5 missing). The plan declares this stale-by-design and forbids touching baselines; the code behaves as declared. The gap is that nothing records the expected red: the harness still pins the single-entry exemption and no executed test asserts the five MISSING lines for a committed baseline, so the next maintainer sees seventeen red gates with no signal that this is intentional and no authority (64-36) attached. And CR-01/CR-02 mean 64-36 cannot make them green yet.

**Fix:** add an executed test that compares one committed baseline against a current-shaped synthetic capture and asserts the five MISSING lines and the by-design message, so the red is documented and cannot be "fixed" by widening bars. Fix CR-01/CR-02 before 64-36 begins.

### WR-04: WARNING — `alphaLawFailures` accepts an incoherent bristle skip and never checks the reference capture

**File:** `packages/efx-watercolor/probe/medium-engine/compare.mjs:191-199`, `:1408`, `:1491`
**Severity:** WARNING
**Issue:** The bristle branch returns as soon as `visibleAlphaSkip` is a non-empty string; it never requires `visibleAlphaMaxDelta === null` and `visibleAlphaSamples === 0`. A bristle capture that reports the skip **and** a violating delta passes the law check. In `--differs-from` mode (digests/dims only) nothing else catches it; in the other modes the field-equality happens to catch it only if the counterpart recorded a different value. Separately, the header and comments claim enforcement "in EVERY mode", but both call sites pass only `actual`; the reference capture of `--other` (always same-session, always current probe) is never law-checked. The fixture "fails a non-bristle capture that opts out" does not cover either case.

**Fix:** in the bristle branch require `data.visibleAlphaMaxDelta === null && data.visibleAlphaSamples === 0` before accepting the skip; call `alphaLawFailures(refData)` in `--other` mode (both sides are same-session captures), keeping baseline/differs exempt only because their reference may predate the block.

### WR-05: WARNING — only one of the five re-specified coverage gates was re-captured after the channel swap

**File:** `.planning/phases/64-medium-engine/64-31-SUMMARY.md:58-96` (verification refs), against `packages/efx-watercolor/probe/medium-engine/probe.ts:1088-1089`, `:1216-1234`, `:2884-2918`
**Severity:** WARNING
**Issue:** 64-31 task 1 changed the source of `whiteOverBlueMetrics`, `coverTexturedMetrics`, `redOverBlueMetrics` and both cover-lifecycle reads (advect, lift), and it moved the covered-paper-white census for all five scenarios. The recorded acceptance evidence re-ran only `cover-textured` at 512 plus `bristle-tip`. This review's fresh captures found `white-over-blue` failing its invariant (CR-02) and `neutral` failing the law (CR-01); `cover-advect` and `cover-lift` at 1080 pass (including the narrow lift margin: `coverCoverageAfterLift 0.56` vs the `0.6 × 0.96 = 0.576` bar). `red-over-blue-50` and the 1080 `cover-textured` scene remain unverified after the swap. The bars are semantic claims about what the channel means, and this delta rewrote the meaning.

**Fix:** re-run each coverage scenario at its canonical size/body (`white-over-blue` 1080/100, plus 60 and 30 same-session; `cover-advect`, `cover-lift`, `cover-textured`, `red-over-blue-50`) and record the readings before the plan claims task 1 verified. Any bar that cannot survive the honest channel reading (CR-02) is a design decision for the plan owner, not a threshold tweak.

### Info

### IN-01: INFO — the coverage raster is exported and discarded on every capture

**File:** `packages/efx-watercolor/probe/medium-engine/probe.ts:2952-2953`, `:3029-3031`
**Severity:** INFO
**Issue:** `engine.exportCanvas('coverage')` runs unconditionally inside the `renderMs` window, but only the five coverage scenarios consume `coverageCanvas`; `neutral`, `cover`, `watercolor-50`, `bristle-edge`, `bristle-wet` and `bristle-tip` compute and discard a full 1080² half-float readback, and `bristle-line` exports coverage a second time for its PNG. The header's "exports + readbacks" now includes a readback most captures never use, and `renderMs` is inflated on all of them.

**Fix:** capture `coverageCanvas` lazily in the branches that read it, and reuse it for the bristle-line PNG.

### IN-02: INFO (necessity) — Impossible-state guard — `opaqueExportCheck`'s empty-surface fallback cannot be reached

**File:** `packages/efx-watercolor/probe/medium-engine/probe.ts:410-423`
**Severity:** INFO
**Category:** necessity
**Issue:** `surfaces.length > 0 ? surfaces[0]!.surface : 'none'` and the `'none'` surface defend against an empty array that no caller can produce: the only call site (`probe.ts:2962-2966`) passes a literal three-element list (`paper`, `white`, `transparent`). The type signature permits any array, so this is judgment rather than type-proven impossibility — hence Info, not Warning.

**Fix:** accept the three digests as a fixed tuple (or drop the guard); no behavioral change.

---

_Reviewed: 2026-11-22T20:04:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
