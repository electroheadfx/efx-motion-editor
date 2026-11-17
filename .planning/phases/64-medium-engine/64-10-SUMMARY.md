---
phase: 64-medium-engine
plan: 10
subsystem: rendering
tags: [watercolor, webgl2, kubelka-munk, scattering, shader-generator, pixel-gate, headless-chrome, tdd]

# Dependency graph
requires:
  - phase: 64-06
    provides: the one Body curve (`bodyCurve = clamp01(body)^6`), the cover pass, the canonical `body` key and the probe `--body` / `--scenario cover` / `bakeMs` operands
  - phase: 64-08
    provides: the scattering deposit into the settled `B.a` channel (`SCATTERING_MAX = 8`, `SCATTER_EPSILON = 1e-3`), its transport through `settleFS`, and the retired white-gouache member
provides:
  - the two-branch `displayBasisGLSL()` generator — a Kubelka-Munk layer-over-white reconstruction per display band with `km`-prefixed band intermediates and a character-for-character legacy false branch
  - the half-exponent calibration (`k = 0.5 * clamp(K)`) that makes the squared transmittance exactly `exp(-K)` at zero scattering
  - the overflow-free `exp(-arg)`-normalized form that keeps every band finite and inside [0,1] for any deposit a stroke can reach
  - the display shader's one broadband scalar read (`iB.a + fB.a`) and its D-16 scaling beside the coefficients, with the paper term untouched (D-15)
  - `kmBand.test.ts` — a CPU reference of the emitted expressions plus 12 generator/wiring source pins
  - probe `--size <32..4096>` and `renderMs`, comparator duration printing, and the recorded run/compare operand contract
  - byte-identity evidence: the neutral gate equals the committed pre-milestone baseline; `scatter-low`/`scatter-high` differ from `scatter-off` on all three exports at 256 and 1024; repeats digest identically
affects: [64-11, 64-12]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 13178
  tasks: 3
  commits: 4
plan_head_before: e73c6c21f98126f83ff816a609936bbe24ff768d
plan_head_after: f12c11a90cb0d4ceccfb5acc569299a3911aa70e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Band reconstruction in the generator: one closed-form KM block per display band, every intermediate suffixed with its band index so 16 bands cannot shadow each other"
    - "Overflow-free hyperbolics: normalize sinh/cosh by exp(-arg) so `kmSh = (1-e)/2`, `kmCh = (1+e)/2`, `T = sqrt(e)`, and every term is bounded for any finite absorption and scattering"
    - "Calibration by construction: `k = 0.5 * clamp(exponent)` makes the S=0 limit evaluate to the exact legacy exponential, so the epsilon branch can keep the old lines verbatim (D-17 byte identity)"
    - "Totality without a guard: the white-background reflectance is emitted as `R + T*T/om` with `om = 1 - R` computed in closed form, and a zero-absorption band takes the defined limit 1"
    - "Cost measured, never gated: `bakeMs` (script + settle) and `renderMs` (the three exports and their readbacks) are printed by the comparator and never compared"

key-files:
  created:
    - packages/efx-watercolor/src/playground/kmBand.test.ts
    - .planning/phases/64-medium-engine/64-10-red-evidence-task1.json
  modified:
    - packages/efx-watercolor/src/playground/spectral.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs

key-decisions:
  - "`k` is HALF the clamped absorption exponent, not the exponent itself: at S = 0 the Kubelka-Munk layer-over-white form then reduces to `exp(-K)` exactly (`R -> 0`, `T^2 = exp(-A)`), so the scattering-free band is the expression the shader has always evaluated rather than an approximation of it (MED-35)"
  - "The raw sinh/cosh denominator is not emitted. It overflows float32 past `arg ~ 88`, which a few dozen overlapping Body-100 dabs reach, and `Inf/Inf` turns the band into NaN. The emitted form divides by the algebraically identical `exp(-arg)`-normalized denominator, and emits `1 - R` as `(k sinh + arg cosh)/den` so the complement never cancels to zero (Rule 1 auto-fix)"
  - "A band with no absorption (k <= 0) returns 1 — the continuous limit of the layer-over-white form and the physical reflectance of a non-absorbing scatterer over white — so no division is reachable at zero"
  - "`scatter` is one broadband scalar (`iB.a + fB.a`), scaled by the same `k` as the coefficients (D-16) and never per-band or per-pigment; the paper term stays the final multiply (D-15)"
  - "The epsilon branch (`scatter > 0.001000000`) keeps the 16 legacy band line-pairs character for character, so a scattering-free render stays byte-identical to the committed baseline instead of numerically close to it (D-17)"
  - "The probe's high-definition sheet is 1024 square: no HD constant exists in the phase docs, so the probe fixes one (16x the default's pixels) and names it in its usage text rather than retyping a number per run"
  - "Task 2's pins shipped green on first write: every behaviour they assert was delivered by 64-06, 64-08 and Task 1. No RED evidence was fabricated for it; the plan-level RED->GREEN pair is Task 1's"

patterns-established:
  - "Generator doc-as-contract: the closed form, the calibration, the zero-absorption limit and the normalization rationale are recorded above `displayBasisGLSL()` and pinned by phrase in tests"
  - "Two-duration cost record: `bakeMs` for the medium (script + settle) and `renderMs` for the render phase (exports + readbacks), both printed, neither compared"
  - "Probe matrix as positive evidence: `--differs-from` asserts the scattered export CHANGED rather than asserting a negated command; `--other` asserts the repeat is byte-identical"

requirements-completed: [MED-34, MED-35, MED-36, MED-38]

coverage:
  - id: D1
    description: "The CPU reference of the emitted KM band: zero scattering returns the legacy exponential (worst relative error 1.1e-15 over the absorption grid), a zero-absorption band returns 1, the deposit grid and a hostile grid to K = 1000 / S = 65504 stay finite and inside [0,1], continuity into the S -> 0 limit holds (2.2e-10), the band rises with S and falls with K, and R + T never exceeds one (measured 0)"
    requirement: MED-34
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/kmBand.test.ts#the Kubelka-Munk band reference (MED-34)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The generated block opens on the imported epsilon and the deposit maximum, halves the clamped exponent, carries band-indexed km intermediates, never divides by a quantity that can reach zero, uses the normalized form with no raw sinh/cosh, reads one scalar, and keeps the 16 legacy line-pairs character for character in its false branch"
    requirement: MED-35
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/kmBand.test.ts#the generated band block (MED-34 / MED-35)"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity"
        status: pass
    human_judgment: false
  - id: D3
    description: "The display shader declares one broadband scattering scalar beside the coefficient reads, scales it by the same granulation factor as `a` and `b` (D-16), interpolates the generated block after both scalar declarations, and documents the Kubelka-Munk composite in its header"
    requirement: MED-34
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/kmBand.test.ts#the generator and the display shader wiring (MED-34 / MED-35 / D-16)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Scattering and order compose on one control: the cover pass and the deposit law read the same curve, no second curve exists anywhere in the package, and the granulation factor erodes the scattering beside the pigment it erodes"
    requirement: MED-36
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#the composition of order and opacity (MED-36)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Replay determinism holds with a body arm (body 0 and 100 replay identically and carry the value; an absent body key replays exactly like an explicit zero), and a repeated scattered probe run digests identically at 256 and at 1024"
    requirement: MED-38
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#replays identically within each body arm and carries the value"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#replays an absent body key exactly like an explicit zero"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs scatter-high --other scatter-high-repeat"
        status: pass
    human_judgment: false
  - id: D6
    description: "All three export backgrounds (paper, transparent, white) render the scattered scene on the same capture: both scattered gates differ from the scattering-free gate on every digest, at 256 and at 1024"
    requirement: MED-38
    verification:
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs scatter-low --differs-from scatter-off && node packages/efx-watercolor/probe/medium-engine/compare.mjs scatter-high --differs-from scatter-off"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs scatter-high-hd --differs-from scatter-off-hd"
        status: pass
    human_judgment: false
  - id: D7
    description: "The scattered render reads correctly on the live sheet: a light pigment at high Body over dried dark reads light with no bleed-through, Body 50 tints without erasing, a dark pigment at high Body covers and stays dark, the border blends when water is above zero, and export matches the screen on every mode with no zoom shimmer"
    requirement: MED-36
    verification: []
    human_judgment: true
    rationale: "Perceptual order/opacity and export-versus-screen equality are human judgments; the probe proves the bytes differ and are deterministic, never that they read correctly to an eye."
  - id: D8
    description: "The composite cost at high definition is a measured number: at 1024 square the two-stroke cover scene costs +5 ms bake and +6 ms render at Body 100 against Body 0 (medians of two runs), reported rather than reduced by changing the law"
    verification:
      - kind: integration
        ref: "2x `--gate scatter-off*-hd --body 0 --scenario cover --size 1024` vs 2x `--gate scatter-high*-hd --body 100 ...`: bake median 39 -> 44 ms, render median 70.5 -> 76.5 ms"
        status: pass
    human_judgment: false

# Metrics
duration: 6min14s (commit span 17:02:31Z-17:08:45Z; the working session also included a context-compaction break)
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 10: Scattering in the Display Reconstruction Summary

**Every display band now reconstructs through a Kubelka-Munk layer-over-white form calibrated by half the absorption exponent — so zero scattering runs the legacy exponential verbatim, and a Body-bearing stroke scatters light at a measured cost**

## Performance

- **Duration:** 6 min 14 s commit span (17:02:31Z - 17:08:45Z; the session included a context-compaction break, so wall clock is longer)
- **Started:** 2026-11-17T17:02:31Z (first task commit; the read/analysis phase predates it)
- **Completed:** 2026-11-17T17:08:45Z (Task 3 commit)
- **Tasks:** 3 of 3
- **Files created/modified:** 9 (2 created, 7 modified)

## Accomplishments

- `displayBasisGLSL()` grew its second branch: each of the 16 display bands now evaluates the two-constant Kubelka-Munk form for the layer over a white background — its reflectance over black plus its squared transmittance over one minus that reflectance — with the absorption input set to HALF the clamped band exponent.
- The calibration is exact, not approximate: at S = 0 the squared transmittance equals `exp(-K)` to 1.1e-15 relative error, so a scattering-free fragment could have run either branch. The epsilon branch nevertheless keeps the 16 legacy band line-pairs character for character, and the committed neutral-identity baseline proved it byte-identically.
- The emitted form is total in float32. The plan's literal `sinh`/`cosh` denominator overflows past `arg ~ 88` (about 40 overlapping Body-100 dabs) and produces NaN; the emitted denominator is its algebraically identical `exp(-arg)`-normalized twin, the white-background reflectance is `R + T*T/om` with `om = 1 - R` in closed form, and a zero-absorption band returns the defined limit 1. A hostile grid to K = 1000 and S = 65504 stays finite and inside [0, 1].
- The display shader reads ONE broadband scalar (`iB.a + fB.a`) beside the coefficient reads and scales it by the same granulation/edge factor as the coefficients (D-16); the paper term is still the final multiply (D-15).
- The probe can now measure the composite: `--size <32..4096>` renders the same scenario at 256 or 1024 square, `renderMs` records the render phase (three exports and their readbacks) beside `bakeMs`, and `compare.mjs` prints both captures' durations when two gates are compared. All three export backgrounds carry the scattered scene on every run.
- The full matrix is green: neutral equals the committed baseline on all 6 compared fields; `scatter-low` and `scatter-high` each differ from `scatter-off` on all 3 digests (at 256 and 1024); the repeat captures are byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: The Kubelka-Munk band form and its scattering-free branch** - `d590d83fd` (test, RED) then `3e719d1ca` (feat, GREEN)
2. **Task 2: Pin the composition of order and opacity, and the replay determinism** - `70fe7d298` (test)
3. **Task 3: Prove the scattering gates with the pixel-buffer matrix and measure the composite** - `f12c11a90` (feat)

**Plan metadata:** the `docs(64-10)` commit that carries this file.

_Note: Task 1 is the plan-level RED -> GREEN pair; Task 2's pins were green on first write (see TDD Gate Compliance)._

## Files Created/Modified

- `packages/efx-watercolor/src/playground/kmBand.test.ts` - CPU reference of the emitted KM expressions (7 rows) and 12 generator/wiring source pins (19 tests)
- `packages/efx-watercolor/src/playground/spectral.ts` - the two-branch `displayBasisGLSL()` generator, the normalized KM block per band, and the doc block recording the closed form, the calibration, the zero-absorption limit and the normalization rationale
- `packages/efx-watercolor/src/playground/shaders.ts` - the one `float scatter` read, the D-16 scaling line (`a *= k; b *= k; scatter *= k;`), and the display-shader header note
- `packages/efx-watercolor/src/playground/scattering.test.ts` - the composition/order-and-opacity block: one curve with two consumers, no second curve, lift erosion of both outputs, allocation/program/history counts, one scalar, record-key and payload pins
- `packages/efx-watercolor/src/determinismContract.test.ts` - the body arm rows: replays identical within body 0 and 100 and carries the value; an absent key replays like an explicit zero
- `packages/efx-watercolor/probe/medium-engine/probe.ts` - `--size` reader, per-run sheet, `renderMs` measurement and report field
- `packages/efx-watercolor/probe/medium-engine/run.mjs` - `--size` parsing, page-query pass-through, the `render` summary line and the final operand-contract usage text
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` - duration printing for both captures in `--other` and `--differs-from` modes
- `.planning/phases/64-medium-engine/64-10-red-evidence-task1.json` - the validated RED record (`RED_EVIDENCE_OK`, reason `target_test_failed`)

## Decisions Made

- Half the clamped exponent as the absorption input, so the scattering-free limit is the exact legacy exponential rather than a calibrated approximation.
- The normalized KM form replaces the raw hyperbolics; the reflectance complement is emitted in closed form so no subtraction can cancel to zero.
- A zero-absorption band returns 1 — the continuous limit and the physical reflectance of a non-absorbing scatterer over white.
- One broadband scalar, scaled by the granulation factor beside the coefficients; no per-band and no per-pigment scattering (the spec's stated approximation).
- The probe's HD sheet is 1024 square, fixed once in the probe's usage text because no phase constant exists.
- Durations are printed, never compared: a cost delta must not be able to fail a byte-identity gate.

## TDD Gate Compliance

- RED: `d590d83fd` `test(64-10): add failing Kubelka-Munk band tests` — `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` on `64-10-red-evidence-task1.json` (reason `target_test_failed`; the generator produced no `km` block yet).
- GREEN: `3e719d1ca` `feat(64-10): reconstruct each display band through Kubelka-Munk` follows the RED commit.
- Task 2 (`tdd="true"`) shipped no RED commit: its asserted behaviours were all delivered by 64-06 (cover curve), 64-08 (scatter transport) and Task 1 (the KM block), so every pin passed on first write. It was committed as one `test(64-10)` commit rather than fabricating a failure. The plan-level RED -> GREEN sequence is Task 1's pair.
- Task 3 has no `tdd` attribute; its verification is the probe matrix below.
- REFACTOR: not required. No gate violations.

## Probe matrix (headless Chrome, real WebGL2, seeded fixed scripts)

| Gate | scenario | body | size | digestPaper | digestTransparent | digestWhite | bakeMs | renderMs | Comparison | Result |
|------|----------|------|------|-------------|-------------------|-------------|--------|----------|------------|--------|
| neutral-identity | neutral | (absent) | 256 | d2bd637a | 291d4a11 | 6ba88334 | 29 | 14 | committed baseline (d1fd7ea3c) | PASS — all 6 fields equal |
| scatter-off | cover | 0 | 256 | d573fa72 | b7614318 | 5218ffb8 | 36 | 35 | scattering-free reference | captured |
| scatter-low | cover | 50 | 256 | 515850d6 | 4529550b | 45a9e1d6 | 40 | 40 | `--differs-from scatter-off` (same session) | PASS — all 3 digests differ |
| scatter-high | cover | 100 | 256 | ebc290e1 | 252b9a8b | 80bb5854 | 39 | 41 | `--differs-from scatter-off` (same session) | PASS — all 3 digests differ |
| scatter-high-repeat | cover | 100 | 256 | ebc290e1 | 252b9a8b | 80bb5854 | 42 | 41 | `--other scatter-high` (same session) | PASS — all 6 fields equal |
| scatter-off-hd | cover | 0 | 1024 | d0422240 | f7bfabcf | bdb236f6 | 38 | 69 | HD reference | captured |
| scatter-off-repeat-hd | cover | 0 | 1024 | d0422240 | f7bfabcf | bdb236f6 | 40 | 72 | HD repeat | identical |
| scatter-high-hd | cover | 100 | 1024 | 2fd5307c | 439b1596 | 244e1355 | 44 | 76 | `--differs-from scatter-off-hd` | PASS — all 3 digests differ |
| scatter-high-repeat-hd | cover | 100 | 1024 | 2fd5307c | 439b1596 | 244e1355 | 44 | 77 | HD repeat | identical |

Cost, measured and reported rather than tuned:

- **256 square:** Body 0 -> Body 100 costs **+3 ms bake, +6 ms render** (bake 36 -> 39 ms, render 35 -> 41 ms; single runs per side).
- **1024 square (16x the pixels, medians of two runs each):** Body 0 bake 39 ms / render 70.5 ms; Body 100 bake 44 ms / render 76.5 ms — **+5 ms bake, +6 ms render** for the two-stroke scattered scene. The scattered gate is the only one taking the KM branch; the scattering-free fragments still run the legacy lines.
- The scattering-free cover digests (d573fa72 / b7614318 / 5218ffb8) equal 64-06's `cover-off` capture exactly, so the Body-0 path is unchanged across plans.

Exact verify chain (passed end to end):
`node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate scatter-off --body 0 --scenario cover && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate scatter-low --body 50 --scenario cover && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate scatter-high --body 100 --scenario cover && node packages/efx-watercolor/probe/medium-engine/compare.mjs scatter-low --differs-from scatter-off && node packages/efx-watercolor/probe/medium-engine/compare.mjs scatter-high --differs-from scatter-off && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate scatter-high-repeat --body 100 --scenario cover && node packages/efx-watercolor/probe/medium-engine/compare.mjs scatter-high --other scatter-high-repeat`

Operand contract (recorded in `run.mjs`'s usage text for later phases): `--gate` is required; `--scenario cover`, `--emboss 0..100`, `--body 0..100`, `--light 0..4` and `--size 32..4096` are optional and additive, and an omitted operand writes no key/value. `compare.mjs <gate>` is committed-baseline equality over the three digests, byte length and dimensions; `--other <g>` is same-session equality and never consults a baseline; `--differs-from <n>` prefers the committed baseline `baselines/<n>.json`, falls back to the same-session capture, and requires all three digests to differ with agreeing dimensions. **No baseline was written or rewritten by this plan.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced the raw sinh/cosh KM denominator with its exp(-arg)-normalized twin**
- **Found during:** Task 1 (the Kubelka-Munk band form)
- **Issue:** The plan's literal denominator `(k + S) sinh(arg) + arg cosh(arg)` overflows float32 once `arg` passes about 88, which ~40 overlapping Body-100 dabs reach; the overflow makes the denominator `Inf` and the band `Inf/Inf = NaN`, i.e. the gate's own acceptance scene can poison the render.
- **Fix:** Emit the algebraically identical normalized form: `kmE = exp(-2 arg)`, `kmSh = (1 - kmE)/2`, `kmCh = (1 + kmE)/2`, `kmDen = (k + S) kmSh + arg kmCh`, `kmT = arg sqrt(kmE) / kmDen`, and the reflectance complement in closed form (`kmOm = (k kmSh + arg kmCh) / kmDen`) so `kmR + kmT^2/kmOm` never subtracts near one. Every term is bounded for any finite absorption and scattering.
- **Files modified:** `packages/efx-watercolor/src/playground/spectral.ts`, `packages/efx-watercolor/src/playground/kmBand.test.ts`
- **Verification:** Hostile grid to K = 1000 and S = 65504 stays finite and inside [0, 1]; S = 0 matches the legacy exponential to 1.1e-15; the test pins the absence of `sinh(`/`cosh(` in the emitted block; the neutral probe gate stays byte-identical.
- **Committed in:** `3e719d1ca` (Task 1 GREEN); the test package in `d590d83fd`

### Plan-text corrections (implementation follows the tree, not the prose)

- **"Seven display bands" -> 16.** `DISPLAY_BANDS.length` is 16 and `COEFFS` is 7 (the coefficient count). The generator and the tests iterate `DISPLAY_BANDS.length`, and the schema pins `DISPLAY_BANDS.length * 3` divisions.
- **"Add the third export background alongside the paper and transparent digests" -> already present.** `probe.ts` has digested paper, transparent and white since 64-01; the matrix exercises all three on the scattered render rather than re-adding a digest. Recorded in the probe header and in D6.
- **Task 2 `tdd="true"` with no genuine RED.** Detailed in TDD Gate Compliance: its behaviours were already delivered, so the pins passed on first write and no failure was manufactured.

**Total deviations:** 1 auto-fixed (Rule 1) plus 3 plan-text corrections.
**Impact on plan:** The auto-fix is required for numerical totality (T-64-25) and changes no observable arithmetic in a valid range; the corrections align the plan text with the tree. No scope creep, no baseline movement.

## Issues Encountered

- **Doc-pin wording.** The first GREEN run failed one assertion: the generator doc said "the layer's reflectance over black" while the pinned phrase was "the reflectance of the layer over black". The doc was reworded; the pin enforces the documented contract.
- **Prose false positives in Task 2 pins.** `expectNotContains(lift, 'keep')` matched the word "keep" in a comment, and a payload scan for `body` matched the prose "AQTL byte body". Both were replaced with structural assertions (`= vec4(f);` exactly twice; `/\bbody\s*[?:]/` and `/\bscatter\w*\s*[?:]/`).
- **Ledger recovery.** The per-plan commit ledger (`gsd-plan-head-before-64-10`) was absent when Task 3 completed, so it was recreated from the verified plan base `e73c6c21f` (the parent of the first 64-10 commit) before the measured commit count was taken. The frontmatter records that base so `/gsd-verify-work` can re-measure.
- **No package installs.** T-64-SC holds: the plan added no dependency.

## UAT rows handed to the human (the probe cannot execute these)

1. A light pigment at high `Body` over a dried dark area reads light with no bleed-through.
2. The same stroke at `Body` 50 tints without erasing; the dark still shows through.
3. A dark pigment at high `Body` covers and stays dark.
4. The stroke's border blends when `water` is above zero.
5. Dry, replay, undo and redo produce identical rasters on the live sheet.
6. Export matches the screen on every mode (paper, transparent, white, pigment).
7. Zoom shows no shimmer over a scattered area.

## Declared behaviours for the human UAT (not defects)

- **A pale scatter reads near-transparent in the pigment-alpha compositor path**, because that path derives alpha from the minimum band reflectance — the retired gouache term behaved the same way; the on-paper and transmittance paths carry the scattered colour correctly.
- **Scattering is broadband**, so a strongly coloured pigment scatters grey-ish light — the spec's accepted approximation, not a per-wavelength model.
- **A low Body lightens without erasing; a high Body lightens and replaces** — both terms read `bodyCurve(body)`, and the two compose per texel with no ordering between them.

## Known Stubs

None — no hardcoded empty values, placeholder text, mock data sources or skipped tests were introduced.

## Row ledger

This plan owns 6 of the phase's 56 classified rows: `MED-34.adjacency`, `MED-34.empty`, `MED-34.ordering` (the KM form, its zero-absorption branch and its numerical totality — kmBand.test.ts reference rows) and `MED-38.adjacency`, `MED-38.empty`, `MED-38.ordering` (the granulation scaling and the shared-curve composition — the scattering.test.ts composition block). All six are covered by passing tests in this plan's suites.

## Next Phase Readiness

- 64-11 and 64-12 consume the KM display block, the probe `--size`/`renderMs` operands and the documented comparator contract; no open blocker.
- The committed baseline remains the pre-milestone capture; the scattered scene is a positive gate (`--differs-from`) and must stay uncommitted so the baseline keeps proving the identity claim.
- The seven UAT rows above remain with the human; rows 1-3 are the plan's declared order/opacity behaviours and cannot be replaced by digests.

---

*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Created files present: `packages/efx-watercolor/src/playground/kmBand.test.ts`, `.planning/phases/64-medium-engine/64-10-red-evidence-task1.json`, `.planning/phases/64-medium-engine/64-10-SUMMARY.md`
- Commits present and ancestors of HEAD: `d590d83fd`, `3e719d1ca`, `70fe7d298`, `f12c11a90`
- Measured plan span: `e73c6c21f..f12c11a90` = 4 commits (frontmatter `commits: 4`)
- Suites: `kmBand.test.ts` 19, `scattering.test.ts` 24, `shaders.test.ts` 3, `determinismContract.test.ts` 14 — 60 passed; package build exit 0
