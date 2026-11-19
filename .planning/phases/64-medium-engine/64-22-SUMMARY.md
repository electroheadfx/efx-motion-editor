---
phase: 64-medium-engine
plan: 22
subsystem: watercolor / acrylic bristle extension — the gather, carried coefficients and the bristle-modulated Body cover
tags: [watercolor, bristles, gather, spectral-field, coefficient-space, body, cover-mask, feather, pickup, refill, wetseconds, tdd, identity-gates, determinism]

# Dependency graph
requires:
  - phase: 64-21
    provides: the deterministic bristle set, the 1 × 256 reservoir pair and the carrier pass that runs ahead of every deposit
  - phase: 64-13
    provides: the coverage composite and its committed pins
  - phase: 64-20
    provides: the coverage transport and the committed identity baselines
provides:
  - the gather (`BRISTLE_GATHER`) — the five nearest bristles, `profile · min(load·1.5, 1) · touch`, averaged over the seven absorbance coefficients plus alpha, one snippet with exactly three consumers
  - the bristle deposit and its one coverage write (`bristleDepositFS`, `bristleCoverFS`, `bristleInk`) on the shipping additive and source-over laws
  - D-21's bristle-modulated Body cover (`bristleBodyCoverFS`, `coverBristlePass`) reading the same gather mask
  - Feather, Pickup, Refill and wetSeconds as canonical, recorded globals; the fourteen-key medium records; the thirteen-row Paint tab
  - four new bristle probe baselines (Body 0 and Body 100 at 1080², round at 1080², Body 100 at 2K) with measured cost
affects: [64-23 (extends this ONE gather snippet with the streak/rim/landing laws and the grain-height trio), 64-24 (water and the last-touch field, the acrylic retune), phase-64 verification]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 21058
  tasks: 3
  commits: 5
plan_head_before: 2a502660bdda8040a2569ff597e3a81a3479624e
plan_head_after: 22a169c5a35be0845981911e6849da504bf9642f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One law, three consumers: the gather is a single exported snippet composed into the ink deposit, the one coverage write and the Body mask — a mask and the paint it hides cannot diverge because they are the same function"
    - "Coefficient-space mixing: carried pigment is averaged over the engine's seven absorbance coefficients plus alpha; RGB never enters the gather (D-28)"
    - "Measured, never gated: new pixel gates record bake/render beside spike 002's reference points and compare only for equality"
    - "Recorded globals end to end: a knob that changes the look is a canonical key through the ONE mapping, a medium-record member and a recorded bag key — and only sometimes a UI row (wetSeconds is the deliberate exception)"

key-files:
  created:
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body0-1080.json
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body100-1080.json
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-round-body0-1080.json
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body100-2048.json
  modified:
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/params.test.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - packages/efx-watercolor/src/playground/mediums.test.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/bristles.test.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/mediumSelection.test.ts
    - app/src/components/physic-paint/view/brushGroupMedium.test.ts

key-decisions:
  - "The Body mask's law switch is named `uShapeLaw`, not `uShape`: the gather's texture helper already binds `uShape` as the shape-texture sampler and GLSL has one namespace per program; the law and its two values (1 then 0) are `coverPass`'s unchanged."
  - "The cover inherits both shipped laws exactly: `fixed` erodes alpha-shaped (`uShapeLaw = 1`, the medium's per-dab density) and `relief` erodes at the DELIVERED LINEAR thickness law (`uShapeLaw = 0`, `coverAmount × RELIEF_ERODE`)."
  - "The gather's softness is declared once in `bristles.ts` (`BRISTLE_SOFTNESS` 0.09, `BRISTLE_FEATHER_GAIN` 0.25) and reached through `gatherSoftness(feather)`; Feather 0 is the §6 band, Feather 1 is 0.34, and a missing or hostile key replays at the shipped look."
  - "`wetSeconds` rides the recorded bag and every medium record but owns no UI row: the panel's ×100 reset law would multiply a seconds value by 100, so it is deliberately absent from `GLOBAL_ROWS` and pinned absent by a negative test."
  - "The bristle predicate is computed once per stamp and drives BOTH the deposit branch and the cover branch, so a dab can never mix a gather deposit with a footprint erode."
  - "D-21's two Body-100 baselines were re-authored in Task 3 after Task 2 first authored all four; the two Body-0 baselines stayed byte-identical, which is the proof that the cover branch is inert at Body 0."

patterns-established:
  - "A shared GLSL snippet with a closed consumer list: the gather's three consumers are source-pinned, so a fourth is visibly a delivery-law amendment (D-29), not an implementation choice."
  - "Cost evidence beside a reference, never a bar: spike 002's 675.5 ms / 1.17 s stay comparison points while each gate's own bake/render is recorded per baseline."

requirements-completed: [MED-21, MED-24, MED-31]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The four new globals map through the ONE canonical mapping: feather, pickup and refill run clamp01(value / 100), wetSeconds is forwarded in seconds with a 1-second floor, and an absent key replays at its §6 default (0 / 60 / 60 / 7 canonical; 0 / 0.6 / 0.6 / 7 engine)."
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/params.test.ts (16 tests) — the clamp table, the seconds floor, the fallback and the default pins"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every medium record declares the fourteen medium keys (the committed ten numbers unchanged, watercolor derived from the canonical defaults), the recorded bag carries sixteen keys, and the Paint tab renders thirteen rows — Feather after Body, then Pickup, Refill, Emboss last — with wetSeconds owning no row."
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts (7 tests) — fourteen-key records and the watercolor derivation"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts (20 tests) — row order, Reset ×100 values, the wetSeconds negative"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts (17) + aquarelleRecordState.test.ts (12) + brushGroupMedium.test.ts (13) — the sixteen-key bag and the fourteen-global apply"
        status: pass
    human_judgment: false
  - id: D3
    description: "A bristle dab deposits the five nearest bristles' ink-weighted carried coefficients — seven absorbance coefficients plus alpha, never RGB — additively (`ONE, ONE`) into the pigment layer, and writes the coverage channel exactly once (`ONE, ONE_MINUS_SRC_ALPHA`), from the same gather. The gather is one shared snippet with exactly three consumers."
    requirement: MED-24
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts (35 tests) — shared snippet, additive deposit, one coverage write, the three-way branch, pickup/refill from the bag, the pinned 23/13 counts"
        status: pass
      - kind: integration
        ref: "probe: compare.mjs bristle-body0-1080 (1080², flat, Body 0) and bristle-round-body0-1080 (1080², round, Body 0) — reproduces the committed baselines; each has a deterministic twin (--other) and holds its scene invariants"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pickup and Refill drive the §3.1 carrier from the recorded bag and Feather widens the gather's coverage band through the constants declared once in bristles.ts; the one Body curve still arrives as `uScatter` and no bristle fragment re-derives the exponent."
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/bristles.test.ts (21 tests) — the two constants, the band law and the clamp; scattering.test.ts — no `pow(` in the deposit, `scatteringDeposit(` call sites unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-21: a bristle dab's Body erode reads the same gather as its deposit — `fixed` alpha-shaped, `relief` LINEAR — in the shipped carrier → cover → deposit order, while every non-bristle response keeps `FOOTPRINT_MASK` byte-for-byte."
    requirement: MED-21
    verification:
      - kind: unit
        ref: "scattering.test.ts#64-22 — the bristle Body mask (D-21) — shared-gather mask, the two blend laws, the cover branch with the undo block in place"
        status: pass
      - kind: integration
        ref: "probe: compare.mjs bristle-body100-1080 --differs-from bristle-body0-1080 — all 3 digests differ with the scenario invariants holding; Body 0 reproduces its baseline (the branch is inert there)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every non-bristle render is untouched: the nine committed identity gates reproduce with no baseline file edited, and the four new bristle baselines were authored from verified deterministic pairs at 1080² and 2K with their cost recorded."
    requirement: MED-31
    verification:
      - kind: integration
        ref: "compare.mjs: neutral-identity, neutral-pigment, watercolor-50, cover-textured, cover-advect, cover-lift, cover-over-wet, white-over-blue, red-over-blue-50 — all PASS, all 7 fields equal"
        status: pass
      - kind: integration
        ref: "compare.mjs --other pairs: bristle-body0-1080, bristle-body100-1080, bristle-round-body0-1080, bristle-body100-2048 — all PASS; git status clean under probe/medium-engine/baselines"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-11-19
status: complete
---

# Phase 64 Plan 22: The Gather and the Bristle-Modulated Body Cover Summary

**A bristle dab now gathers the five nearest bristles' carried coefficients out of the per-bristle reservoirs, deposits them additively in the engine's own spectral space, writes coverage exactly once, and erodes Body through that same gather mask — while Feather, Pickup and Refill become recorded globals and the nine committed identity gates stay byte-identical.**

## Performance

- **Duration:** 13 min (span of this plan's five task commits)
- **Started:** 2026-11-19T13:28:42Z (first task commit, RED)
- **Completed:** 2026-11-19T13:41:22Z (final task commit)
- **Tasks:** 3 of 3
- **Files modified:** 18 (4 created, 14 modified)

## Accomplishments

- The four new canonical globals through the ONE mapping: `feather`/`pickup`/`refill` via `clamp01(num(v, d) / 100)`, `wetSeconds` via `Math.max(1, num(v, d))` — seconds, never divided by 100. `DEFAULT_CANONICAL_PARAMS` 0 / 60 / 60 / 7; `Params` and `DEFAULT_PARAMS` carry the mapped 0 / 0.6 / 0.6 / 7.
- The fourteen-key medium records: every record states the §6 defaults for the four new keys, the committed ten numbers are untouched, and watercolor still derives every key from `DEFAULT_CANONICAL_PARAMS`.
- The recorded surface: `AQUARELLE_GLOBAL_KEYS` grows to sixteen, `DEFAULT_AQUARELLE_PARAMS` grows by four, and the Paint tab renders thirteen rows in the D-22 order (Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed, Viscosity, Body, Feather, Pickup, Refill, Emboss). `wetSeconds` deliberately has no row, with the ×100-reset reason documented and a negative test pinning its absence.
- The gather, ported as one exported snippet: `BRISTLE_TEXTURES` (shared with 64-21's carrier) plus `BRISTLE_GATHER`'s `gatherBristle(uv)` — aspect-corrected dab frame, `2/count` spacing, nearest index ±2, §4.1 radius floor 0.8 px, §5.1 profile `(1 − offset²)²`, §3.2 ink `profile · min(load·1.5, 1) · touch`, carried coefficient/alpha sums divided by `Σ ink` with the `1e-4` early-out, §4.5 `local = inkSum / max(profileSum, 0.5)`, §4.4 `threshold = grain·(1 − paperHeight) − 0.25` on the engine's own paper tap, and the softness band `smoothstep(threshold − uSoftness, threshold + uSoftness, coverage)`.
- The three consumers, all composed from that one snippet: `bristleDepositFS` (additive absorbance with `uScatter` arriving as a uniform), `bristleCoverFS` (the one coverage write), and `bristleBodyCoverFS` (D-21's mask). `bristleInk` binds the shared gather uniforms once, touches the rect, draws ink `ONE, ONE` into the pigment layer, then coverage `ONE, ONE_MINUS_SRC_ALPHA`; `coverBristlePass` draws `fixed` (`uShapeLaw = 1`) and `relief` (`uShapeLaw = 0`) with `ZERO, ONE_MINUS_SRC_COLOR`.
- The stamp branch: one bristle predicate per stamp decides both the deposit (`bristleInk` vs the shipped `coverageDeposit`/`brushInk` chain) and the cover (`coverBristlePass` vs the shipped `coverPass`). The carrier stays first, the undo `protect` block stays exactly where it was, and pickup/refill now come from `this.params` instead of spike 002's constants.
- Four new bristle baselines, authored from verified pairs; the two Body-100 ones re-authored after D-21 changed their mask by design. Two sets of twin runs prove same-session determinism.
- Identity, measured: all nine pre-existing gates reproduce byte-identically and no baseline file was edited (`git status` clean under `probe/medium-engine/baselines/`).

## Task Commits

Each task was committed atomically (the two TDD tasks split RED → GREEN):

1. **Task 1: The three exposed globals and the recorded medium surface** (TDD)
   - `4bdd6879e` (test) add failing pins for the Feather, Pickup, Refill and wetSeconds surface
   - `8842798f5` (feat) expose Feather, Pickup and Refill as canonical globals
2. **Task 2: The gather — carried coefficients into the spectral field** (TDD)
   - `1a50afd47` (test) add failing pins for the gather constants and the bristle deposit
   - `1a3b99058` (feat) deposit the five-nearest gathered coefficients additively
3. **Task 3: The bristle-modulated cover (D-21) and the composition gate**
   - `22a169c5a` (feat) erode the Body mask through the same gather the deposit reads

**Plan metadata:** the docs commit that carries this SUMMARY.

## Files Created/Modified

- `packages/efx-watercolor/src/playground/params.ts` — the four canonical members, defaults, and the ONE mapping: `clamp01` for the three sliders, a seconds floor for `wetSeconds`; the header law sentence now states the exception.
- `packages/efx-watercolor/src/playground/params.test.ts` — the clamp table for all three sliders, the wetSeconds forwarding/floor/fallback pins, and the amended exact-equality mapping literal.
- `packages/efx-watercolor/src/playground/mediums.ts` — `MediumParamKey` at fourteen; every record states the four §6 defaults; committed ten numbers untouched.
- `packages/efx-watercolor/src/playground/mediums.test.ts` — the fourteen-key pin, the five record literals, the watercolor-derivation pin.
- `packages/efx-watercolor/src/playground/bristles.ts` — `BRISTLE_SOFTNESS` 0.09, `BRISTLE_FEATHER_GAIN` 0.25 and `gatherSoftness(feather)`.
- `packages/efx-watercolor/src/playground/bristles.test.ts` — the constants, the band law (0 → 0.09, 1 → 0.34) and the hostile-input clamp.
- `packages/efx-watercolor/src/playground/shaders.ts` — `BRISTLE_TEXTURES` exported, `BRISTLE_GATHER`, `bristleDepositFS`, `bristleCoverFS`, `bristleBodyCoverFS`.
- `packages/efx-watercolor/src/playground/Engine.ts` — `Params`/`DEFAULT_PARAMS` members; the three programs registered outside the 23-program literal; `bindGather`; `bristleInk`; `coverBristlePass`; the three-way deposit branch and the D-21 cover branch; pickup/refill from the bag.
- `packages/efx-watercolor/src/playground/scattering.test.ts` — the 64-22 describe blocks: one shared snippet, additive deposit, no `pow(`, one coverage write, the cover branch, the Body-mask twins, and the pinned 23/13 counts.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — the four keys on the interface, the key list (sixteen) and the defaults.
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` — `GLOBAL_ROWS` at thirteen in D-22 order; the wetSeconds absence documented.
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` — labels, Reset expectations (0 / 60 / 60), the thirteen-row order pin and the wetSeconds negative.
- `app/src/components/physic-paint/view/mediumSelection.test.ts` — the sixteen-key bag pins and the new defaults.
- `app/src/components/physic-paint/view/brushGroupMedium.test.ts` — the cross-group pick pin restated for fourteen globals and sixteen bag keys.
- `packages/efx-watercolor/probe/medium-engine/baselines/bristle-body0-1080.json` — **created.** 1080², flat, Body 0: digests `21575ea4`/`a5b389e5`/`8e4b5caf`/`a1be1b12`; 55 ms bake / 153 ms render at capture.
- `packages/efx-watercolor/probe/medium-engine/baselines/bristle-body100-1080.json` — **created.** 1080², flat, Body 100 (re-authored by Task 3): `cc916640`/`f66df30a`/`e7dd2ae2`/`d73bf4ae`; 126 ms bake / 161 ms render at capture.
- `packages/efx-watercolor/probe/medium-engine/baselines/bristle-round-body0-1080.json` — **created.** 1080², round, Body 0: `c8b3e625`/`7c8f21a6`/`3e0c4876`/`f8c543af`; 53 ms bake / 115 ms render at capture.
- `packages/efx-watercolor/probe/medium-engine/baselines/bristle-body100-2048.json` — **created.** 2K, flat, Body 100 (re-authored by Task 3): `6f716288`/`983ab14c`/`043192b6`/`dbe03dba`; 87 ms bake / 283 ms render at capture.

## Decisions Made

- **`uShapeLaw`, not `uShape`.** The gather's texture helper binds `uShape` as the shape-texture sampler; a float of the same name in the same program cannot link. The switch keeps `coverPass`'s semantics and its two values.
- **Both cover laws inherited unchanged.** `fixed` stays alpha-shaped (medium density) and `relief` stays the delivered LINEAR law; only the mask moved from `footprintMask()` to `gatherBristle(...).coverage`.
- **The gather's constants live beside the stroke's.** `bristles.ts` already owns the "one law, declared once" declarations, so the softness pair and `gatherSoftness` live there and the engine's binder only reads them.
- **`wetSeconds` is recorded, not exposed.** It rides the medium record and the recorded bag (replay determinism) but has no slider row; the panel's ×100 reset law would corrupt seconds.
- **One predicate, two branches.** The bristle test is computed once per stamp and reused for the deposit and the cover, so a dab cannot half-take the gather path.
- **The Body-100 baselines are Task 3's.** Task 2 authored all four baselines on the footprint cover; Task 3 re-authored the two Body-100 ones after D-21 changed the mask by design. The Body-0 baselines are byte-identical across the two commits, which is the positive proof that nothing leaked into the Body-0 path.

## TDD Gate Compliance

- **RED before GREEN:** Task 1 `4bdd6879e` (`test(64-22)`) precedes `8842798f5` (`feat(64-22)`); Task 2 `1a50afd47` (`test(64-22)`) precedes `1a3b99058` (`feat(64-22)`). Task 3 is `type="auto"` without `tdd="true"`, so it has no RED commit by contract.
- **RED evidence:** `.gsd/tdd-evidence/64-22/params-red.json` → `RED_EVIDENCE_OK` (`target_test_failed`): 16 tests discovered, 5 failing, the named target failing on its planned assertion (`expected undefined to be +0`). `.gsd/tdd-evidence/64-22/task2-red.json` → `RED_EVIDENCE_OK` (`target_test_failed`): 52 tests discovered, 8 failing (3 bristle-constant pins + 5 gather/deposit/cover pins), 44 pre-existing pins green.
- **GREEN proven:** package suite 134/134 across 8 files (including `bristles.test.ts` 21, `scattering.test.ts` 35, `params.test.ts` 16, `mediums.test.ts` 7); app suites 62/62 across 4 files (`AquarelleGlobalsPanel` 20, `mediumSelection` 17, `brushGroupMedium` 13, `aquarelleRecordState` 12); `pnpm --filter @efxlab/efx-watercolor check` and `build` clean; `tsc --noEmit` clean for the app.

## Verification Evidence

### Gates

| Gate | Result |
|------|--------|
| `neutral-identity` (256) | PASS — all 7 fields equal |
| `neutral-pigment` (256) | PASS — all 7 fields equal |
| `watercolor-50` (1080) | PASS — all 7 fields equal |
| `cover-textured --brush chalk` (512) | PASS — all 7 fields equal, scenario invariants hold |
| `cover-advect` (256, Body 100) | PASS — all 7 fields equal, scenario invariants hold |
| `cover-lift` (256, Body 100) | PASS — all 7 fields equal, scenario invariants hold |
| `cover-over-wet` (256, Body 100) | PASS — all 7 fields equal |
| `white-over-blue` (1080, Body 100) | PASS — all 7 fields equal, scenario invariants hold |
| `red-over-blue-50` (1080, Body 100) | PASS — all 7 fields equal, scenario invariants hold |
| `bristle-body0-1080` (+ `--other` twin) | PASS vs baseline and vs twin; scene invariants hold |
| `bristle-body100-1080` (+ `--other` twin) | PASS vs baseline and vs twin; scene invariants hold |
| `bristle-body100-1080 --differs-from bristle-body0-1080` | PASS — all 3 digests differ, scene invariants hold |
| `bristle-round-body0-1080` (+ `--other` twin) | PASS vs baseline and vs twin; scene invariants hold |
| `bristle-body100-2048` (+ `--other` twin) | PASS vs baseline and vs twin; scene invariants hold |

### Measured cost and scene readings (measured, never gated)

Spike 002's reference points: Body 100 = 675.5 ms at 1080² and 1.17 s at 2K.

| Gate | Size | Brush | Body | bakeMs | renderMs | paper digest | blueExcess |
|------|------|-------|------|--------|----------|--------------|------------|
| bristle-body0-1080 | 1080² | bristle-flat | 0 | 60 | 168 | `21575ea4` | −0.17 |
| bristle-body100-1080 | 1080² | bristle-flat | 100 | 73 | 188 | `cc916640` | −0.24 |
| bristle-round-body0-1080 | 1080² | bristle-round | 0 | 55 | 126 | `c8b3e625` | −0.23 |
| bristle-body100-2048 | 2048² | bristle-flat | 100 | 87 | 361 | `6f716288` | −0.23 |

All four gates report the same scene metrics: `coverAlphaMean` 0.46, P10 0, P90 1, `coverAlphaCoveredFraction` 0.46, `coveredPaperWhitePct` 0. These are evidence for 64-23's edge census, not a gate here.

### Structural pins

- The program literal still holds twenty-three programs; the three new programs (`bristleDeposit`, `bristleCover`, `bristleBodyCover`) register outside it.
- The allocation count still reads thirteen — zero new document-sized targets (D-29).
- `scatteringDeposit(` call sites are unchanged; no bristle fragment contains `pow(`.
- Coverage is written exactly once per bristle dab, by `bristleInk`; `coverBristlePass` writes only `fixed` and `relief`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's Body-0 gate commands omit `--body 0`**
- **Found during:** Task 2 / Task 3 verification
- **Issue:** The plan's `<automated>` chains for `bristle-body0-1080` and `bristle-round-body0-1080` pass `--scenario cover-textured --brush …` without `--body 0`, but `probe.ts`'s `coverTexturedScript(emboss, body, brushId)` renders the covering stroke at `body ?? 100`. Omitting the flag renders Body 100, so those two commands can never reproduce the committed Body-0 baselines (which record `"body": 0`) and fail with four differing digests.
- **Fix:** Re-ran both Body-0 gates with explicit `--body 0`; both reproduce their baselines and their twins. No source or baseline change — the baselines were authored correctly, the plan's command text was not.
- **Files modified:** None (verification command corrected).
- **Verification:** `compare.mjs bristle-body0-1080` and `compare.mjs bristle-round-body0-1080` → PASS; twins → PASS.

**2. [Rule 2 - Correctness] `brushGroupMedium.test.ts` was missing from the plan's file list**
- **Found during:** Task 1
- **Issue:** The suite pins the cross-group medium pick's globals (`MEDIUM_KEYS`, the `toEqual` against `record.params`, and the exact sorted bag key list). Growing the record to fourteen keys and the bag to sixteen keys breaks those pins, and the plan's `files_modified` did not name the file.
- **Fix:** Amended the key list, the counts and the test title in the same commit as the surface change, per the plan's own "amend every pin that restates the old surface" rule.
- **Files modified:** `app/src/components/physic-paint/view/brushGroupMedium.test.ts`
- **Committed in:** `4bdd6879e` (RED harness) / `8842798f5` (GREEN).

### Operational notes

**3. Continuation from a prior executor run.** All three tasks' five commits existed before this run, without a SUMMARY. This run verified every task's gates independently (tests, check/build/tsc, all nine identity gates, all four bristle gates with their twins and the composition proof), found them green, and authored this SUMMARY rather than re-executing the tasks. The ledger base (`2a502660…`) was preserved from the existing ledger file, so `commits: 5` is measured over the same range the tasks committed into.

**4. Identity gate commands must carry their baseline's Body.** `cover-over-wet`, `cover-advect` and `cover-lift` record `"body": 100`; the `cover-over-wet` scenario does not fold a default, so it must be re-verified with `--body 100` (verified this run). Not a defect in the code — a reminder for 64-23/64-24 reviewers.

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2) + 2 recorded operational notes.
**Impact on plan:** No source change was needed beyond the plan's own instructions; one test file joined the surface amendment, and one verification command needed its omitted flag restored.

## Issues Encountered

- The Body-0 probe default (deviation 1) initially presented as a failing gate; the diff showed `body: null` in the capture versus `body: 0` in the baseline, and the scene builder's `body ?? 100` explained it. Resolved by passing `--body 0` explicitly.
- `cover-over-wet` failed once during re-verification for the same class of reason (`body: null` vs the baseline's `body: 100`); resolved by passing `--body 100`.
- No baseline file was edited; `git status` under `probe/medium-engine/baselines/` is clean after every gate.

## Known Stubs

None. `wetSeconds`'s missing slider row is a recorded design decision (D-22), not placeholder data: the value is fully wired through the medium record, the recorded bag and the engine mapping, and a negative test pins its absence from the panel.

## Threat Flags

None beyond the plan's register. All five mitigations are live:

- T-64-72 — one shared gather snippet with the coefficient-space average pinned; the deposit is additive `ONE, ONE`; no `pow(` in any bristle fragment.
- T-64-73 — cost measured at 1080² and 2K (60–87 ms bake, 126–361 ms render) and recorded beside spike 002's reference, never gated.
- T-64-74 — one predicate computed once per stamp; the branch is source-pinned; Body 0 is byte-identical and every non-bristle identity gate reproduces.
- T-64-75 — the four keys enter the record loop and the ONE mapping in one pass; absent keys replay at their neutral defaults; `wetSeconds` is excluded from the rows by an explicit negative pin.
- T-64-SC — no dependencies added.

## Self-Check: PASSED
