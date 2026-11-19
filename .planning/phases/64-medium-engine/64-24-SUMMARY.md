---
phase: 64-medium-engine
plan: 24
subsystem: [watercolor-engine, probe-harness]
tags: [webgl2, glsl, r32f, last-touch, wetness, pickup, acrylic, determinism, headless-chrome]

requires:
  - phase: 64-medium-engine (64-21)
    provides: the per-bristle carrier, reservoirs and the `BRISTLE_CAP` shape target
  - phase: 64-medium-engine (64-22)
    provides: the five-nearest gather deposit, the one coverage write, the Body mask (D-21/D-26/D-27)
  - phase: 64-medium-engine (64-23)
    provides: the §4.3–§5.5 traces in the gather and the carrier, `bristle-edge-1080`
provides:
  - the D-24 last-touch field: a document-sized exact-float `R32F` ping-pong pair, cleared to the one-week sentinel, carried through the whole-document lifecycle as the sixth pool-0 layer
  - the §3.4 gate `exp(−age / wetSeconds) · coverage` gating PICKUP only, on the virtual clock, with a recorded A/B seam (`uWetMode`, `setLastTouchMode`)
  - the `bristleTouchFS` per-dab touch refresh, weighted by the cover the same dab wrote
  - the D-25 acrylic retune (water 26 / bleed 22 / flow 60 / wetSeconds 12) in one record
  - the `bristle-wet` acceptance scenario and its baseline: fresh 50.64 vs agedWet 250.16 band darkness, plus the uncommitted `--wet-mode 0` proxy control
affects: [phase-64 verification, the acrylic look row deferred to UAT (D-30), any future wetness or tack-time work]

actuals:
  tokens: 31549
  tasks: 3
  commits: 4
plan_head_before: 955987fc6bdac7646d1708d483be011aa22fc602
plan_head_after: a6dcd283cd33b46cf91760fe9def035b058e14fe

tech-stack:
  added: []
  patterns:
    - "Session-only engine state as a whole-document layer: a new field joins `allocateHistory`'s format list, `snapshotLayers`, `travel`'s pool-0 map, `docTargets`, `captureWhole`/`uploadWhole` and `resizeDocument` together, and an exact-float read/upload keeps its sentinel"
    - "A cleared texture is a semantic decision, not a zero: the sentinel is one week old, written to both halves at allocation and after every wipe"
    - "An A/B seam is a uniform bound from the recorded mode, never a second shader: mode 1 (timestamp) is the shipped law, mode 0 (the 64-21 proxy) survives only as the recorded control"

key-files:
  created:
    - packages/efx-watercolor/src/playground/lastTouch.test.ts
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-wet-1080.json
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/gl.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/bristles.test.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - packages/efx-watercolor/src/playground/mediums.test.ts
    - packages/efx-watercolor/src/playground/relief.test.ts
    - packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body0-1080.json
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body100-1080.json
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body100-2048.json
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-round-body0-1080.json
    - packages/efx-watercolor/probe/medium-engine/baselines/bristle-edge-1080.json

key-decisions:
  - "The last-touch clears to −604800 s, not 0: a cleared R32F reads 0, which the virtual clock would call 'touched at t = 0' and every texel would start wet. The one-week sentinel is written to both halves at allocation and after every sheet wipe, and because a half-float round-trip clamps at 65504, `WholeDoc.layers` widened to `Uint16Array | Float32Array` with an exact f32 read/upload."
  - "Memory is recorded, never gated: the sheet pair is 9,331,200 B at 1080² (2 × 1080·1080·4) and 33,554,432 B at 2K (2 × 2048·2048·4), the pool-0 atlas grows by one FLOAT_R layer, and the frame cache is 0 B because a committed frame is a WebP raster and a new frame starts clean on the sentinel. Spike 002's +26.1 MB / +67.1 MB / +103 ms are reference points on the same order."
  - "The acceptance measures the transparent export's band darkness — the census's measured lesson that the coverage alpha is a saturated union — over two 0.022-wide boxes at the crossings. Light #dddddd bands under one #111111 crossing make the pickup legible; the direction (fresh crossing lighter, aged darker) is evidence, never an assertion. The comparator gates only finiteness, range and |fresh − agedWet| ≥ 1 luma."
  - "`tool: 'water'` writes only `brushWet` — no coverage, no last-touch refresh — which is exactly the discriminator the proxy needs: under mode 0 the revived `wet × coverage` proxy reads the re-wetted band as wet, under mode 1 the timestamp stays thirty seconds old. The observed A/B: mode 0 agedWet 249.86 vs mode 1 agedWet 250.16, and all three exported digests differ."
  - "D-25's Feather half is discharged by composition: the acrylic water edge is the retune's fluid transport passing through 64-22/64-23's `uSoftness = gatherSoftness(P.feather)` band, so no `feather` expression is added and none may appear."

patterns-established:
  - "A wall-clock-free acceptance ages one region of a sheet by advancing the engine's virtual clock with zero simulation ticks (`advanceClock`), so 'thirty seconds old' and 'just re-wetted' are independent facts a replay reproduces"
  - "The comparison mode is the proof: `--other` proves the baseline's determinism, `--differs-from` proves the seam is load-bearing, and the control capture is read, never committed"

requirements-completed: [MED-05, MED-23, MED-32, MED-33, MED-34, MED-35, MED-36, MED-37, MED-38]

coverage:
  - id: D1
    description: "The last-touch field and its eight lifecycle sites: FLOAT_R ping-pong pair, one-week sentinel, exact f32 whole-document carry, resize copy"
    requirement: MED-32
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/lastTouch.test.ts (21 tests)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts, coverageLifecycle.test.ts (positional pins amended in place)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The §3.4 gate `exp(−age/wetSeconds)·coverage` gating pickup only, and the cover-weighted touch refresh after each deposit"
    requirement: MED-05
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/bristles.test.ts (bristleWetness, bristleTouchValue), scattering.test.ts (the carrier gate, bristleTouchFS, binder and pass-order pins)"
        status: pass
      - kind: unit
        ref: ".gsd/tdd-evidence/64-24/task2-red.json — RED_EVIDENCE_OK (11 new tests failed as planned)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The D-25 acrylic retune: water 26 / bleed 22 / flow 60 / wetSeconds 12, every other medium and every other number untouched"
    requirement: MED-23
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts (the acrylic literal plus the retune arithmetic)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The bristle-wet acceptance: one sheet, one brush, two ages, and the --wet-mode 0 proxy A/B"
    requirement: MED-38
    verification:
      - kind: automated_ui
        ref: "probe/medium-engine: bristle-wet-1080 vs bristle-wet-1080-repeat (--other) and vs baselines/bristle-wet-1080.json; --differs-from vs the uncommitted bristle-wet-proxy"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every non-bristle response stays byte-identical and no identity baseline is edited"
    verification:
      - kind: automated_ui
        ref: "nine identity gates PASS against committed baselines: neutral-identity (256), neutral-pigment (256), watercolor-50 (1080), cover-textured (512 chalk), cover-advect / cover-lift / cover-over-wet (256, Body 100), white-over-blue (1080, Body 100), red-over-blue-50 (1080, Body 100)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The acrylic look itself — a wetter, edge-flowing paint"
    requirement: MED-23
    verification:
      - kind: manual_procedural
        ref: "live UAT row deferred by D-30"
        status: unknown
    human_judgment: true
    rationale: "D-25 is numbers in one record: the gate proves determinism and byte-identity, not that the retuned acrylic reads as a wetter paint to the eye. That judgment is the phase's UAT row, not an automated claim."

duration: 14min
completed: 2026-11-19
status: complete
---

# Phase 64 Plan 24: Acrylic Wetness and the Last-Touch Field Summary

**Paint on the sheet now has an age the brush can feel: pickup is `exp(−age / wetSeconds) · coverage` on the virtual clock, and one 1080² capture proves it — the fresh crossing picks up the pale band it crosses (50.64 band darkness) while the thirty-second-old re-wetted crossing lays its own dark palette (250.16), with the `--wet-mode 0` proxy differing on all three exported digests.**

## Performance

- **Duration:** 14 min measured across the plan's first→last commit (15:32:25 → 15:46:43 +0100); the plan's own load time predates the first commit (the ledger HEAD commit dates 15:23:32, so wall-clock ≈ 23 min)
- **Started:** 2026-11-19T14:32:25Z (first commit)
- **Completed:** 2026-11-19T14:46:43Z (last commit)
- **Tasks:** 3/3
- **Files modified:** 22 (+1 untracked left alone)

## Accomplishments

- The D-24 last-touch field ships as the sixth pool-0 layer: a document-sized exact-float `R32F` ping-pong pair whose CLEARED value is one week before the clock's zero (`LAST_TOUCH_DRY_SECONDS = -604800`), written to both halves at allocation and after every sheet wipe. Because a half-float round-trip clamps at 65504, `WholeDoc.layers` widened to `Uint16Array | Float32Array` with `readFloat` / `uploadFloat` carrying the sentinel exactly; all eight lifecycle sites (`allocateHistory`, `snapshotLayers`, `travel`, `docTargets`, `captureWhole`, `uploadWhole`, `resizeDocument`, the undo block) grew together, and the `relief`/`coverageLifecycle` positional pins were amended in place, never deleted.
- The carrier's §3.4 gate is the timestamp law: `exp(−age / wetSeconds) · coverage`, `age = now − lastTouch`, `now = this.clock() / 1000`, and it multiplies PICKUP only — refill, pigment coefficients and covering density are untouched, so an old sheet still takes new paint and only the mixing stops. `bristleTouchFS` stamps each dab after its deposit, `mix(prev, now, clamp(cover · amount, 0, 1))`, so a later dab reads the age of the paint it crosses. `uWetMode` keeps 64-21's `wet × coverage` proxy compiled as the recorded control; `setLastTouchMode` is the compare-then-write seam.
- The D-25 retune is numbers in one record: acrylic `water: 26, bleed: 22, flow: 60, wetSeconds: 12`. Every other medium and every other acrylic number is the shipped one, the one-write medium path is unchanged, and D-22's Feather half is discharged by composition through the existing `uSoftness = gatherSoftness(P.feather)` band — no `feather` expression was added.
- The acceptance is one sheet, one brush, two ages: `BRISTLE_WET_BOXES` at x = 0.3 / 0.7, light `#dddddd` bands, one `#111111` crossing, and a `tool: 'water'` swash carrying `advanceClockMs: 30000` between the two bands. Measured band darkness: `pickupFreshMean` 50.64 vs `pickupAgedWetMean` 250.16 (delta 199.52 luma, bar ≥ 1). The baseline was authored from two byte-identical same-session captures (`--other`: all 7 fields equal).
- The A/B seam is load-bearing, proven without committing a control: the same gate at `--wet-mode 0` reads `fresh 51.36 | agedWet 249.86` and differs from the timestamp capture on all three exported digests (paper `e083b0e3` vs `9eaef5be`, transparent `4ff81f59` vs `ca1553bf`, white `c0aa7289` vs `cb741c11`). The proxy revives pickup on the re-wetted band; the timestamp does not.
- Every non-bristle response is byte-identical: nine identity gates PASS against their committed baselines with NO identity baseline edited — `neutral-identity` (256), `neutral-pigment` (256), `watercolor-50` (1080), `cover-textured` (512 chalk), `cover-advect` / `cover-lift` / `cover-over-wet` (256, Body 100), `white-over-blue` (1080, Body 100) and `red-over-blue-50` (1080, Body 100, luma 108.51 / 97.37 = 1.11, hue −0.07°, paperWhite 0 %).
- Cost, for the record: the acceptance capture is 190 ms bake / 178 ms render at 1080²; the repeat reads 180 / 170 ms. The sheet pair is 9,331,200 B at 1080² and 33,554,432 B at 2K; the frame cache line is 0 B. Spike 002's +26.1 MB / +67.1 MB / +103 ms bake remain reference points, not bars.

## Task Commits

Each task committed atomically:

1. **Task 1: The last-touch channel and its eight lifecycle sites** — `afb36bd61` (feat)
2. **Task 2: The §3.4 gate and the touch refresh** — RED `c57b8401a` (test) → GREEN `dfe46df10` (feat)
3. **Task 3: The acrylic retune and the bristle-wet acceptance** — `a6dcd283c` (feat)

TDD evidence: `.gsd/tdd-evidence/64-24/task2-red.json` — verdict `RED_EVIDENCE_OK`, 11 of 11 new tests failing on their planned assertions while all 92 pre-existing tests passed in the same run.

## Files Created/Modified

- `packages/efx-watercolor/src/playground/gl.ts` — `readFloat` / `uploadFloat` (exact f32, with a narrowing guard on upload)
- `packages/efx-watercolor/src/playground/Engine.ts` — `FLOAT_R`, the `lastTouch` ping-pong pair, `clearLastTouch`, the eight lifecycle sites, `lastTouchMode` / `setLastTouchMode`, the `bristleTouch` pass and the carrier's four uniform bindings
- `packages/efx-watercolor/src/playground/shaders.ts` — the carrier's two-mode `wetAt` gate (`uTimes` / `uNow` / `uWetSeconds` / `uWetMode`) and the gather-free `bristleTouchFS`
- `packages/efx-watercolor/src/playground/bristles.ts` — `LAST_TOUCH_DRY_SECONDS`, `bristleWetness`, `bristleTouchValue`, each settled once with its endpoint law
- `packages/efx-watercolor/src/playground/lastTouch.test.ts` — the sentinel, the call order after both wipe loops, the widenings and the exact-float carry (21 tests)
- `packages/efx-watercolor/src/playground/bristles.test.ts` — the gate's endpoint table (−604800, exp(−1) at one tack time, dry-to-float at 600 s, negative age reads 1) and the touch mix's totality
- `packages/efx-watercolor/src/playground/scattering.test.ts` — the carrier gate's text pins, `bristleTouchFS`, the binder lines and the pass order after `bristleInk`
- `packages/efx-watercolor/src/playground/relief.test.ts`, `coverageLifecycle.test.ts` — the positional pins amended in place for the sixth layer
- `packages/efx-watercolor/src/playground/mediums.ts` — the D-25 retune with its D-25 / D-24 / D-22 comment
- `packages/efx-watercolor/src/playground/mediums.test.ts` — the acrylic literal, the other four records held fixed, and the retune arithmetic
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — `advanceClock(ms)` (clock-only, no tick, no render) and `setLastTouchMode` (both test-only)
- `packages/efx-watercolor/probe/medium-engine/probe.ts` — `advanceClockMs` / `tool` on `ScriptEntry`, the `bristle-wet` scenario, its two boxes and the two pickup readings, `readWetMode`
- `packages/efx-watercolor/probe/medium-engine/run.mjs` — the twin closed-list name, `--wet-mode` parsing and usage, the `wetness` print line
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` — `bristleWetFailures` (relations only, `PICKUP_MIN_DELTA = 1`) and the printer
- `packages/efx-watercolor/probe/medium-engine/harness.test.ts` — laws 20–23: the scenario script and its clock order, the advance application, the report fields, the comparator bars and the flag plumbing
- `packages/efx-watercolor/probe/medium-engine/baselines/bristle-wet-1080.json` — the acceptance baseline (paper `e083b0e3` / transparent `4ff81f59` / white `c0aa7289` / pigment `0569bcdc`)
- The five bristle baselines re-authored from verified `--other` pairs (Task 2)

## Decisions Made

- **A cleared texture needs a sentinel, not a zero.** `LAST_TOUCH_DRY_SECONDS = -604800` is one week old on the virtual clock; written to both halves at allocation and after both `docTargets` wipe loops. A cleared-to-zero field would make every texel fresh — the failure T-64-80 exists to prevent. `lastTouch.test.ts` pins the constant, the call order and the exact-float round-trip, since a half-float carry would clamp the sentinel at 65504 and every restored sheet would read as touched.
- **The proxy stays compiled as the control.** `uWetMode` is one uniform branch: mode 1 (default) is §3.4's timestamp law; mode 0 is 64-21's `wet × coverage`, reachable only through the test-only `setLastTouchMode`. The A/B is then one recorded flag apart, and the shipped default never depends on the control.
- **The acceptance ages a sheet without moving its fluid.** `advanceClock(ms)` adds to the virtual clock with no simulation tick and no render — unlike `skipTicks` — so "thirty seconds older" and "just re-wetted" are independent facts, and two bakes of the same script agree byte-for-byte (verified `--other`).
- **The measurement is the film, not the mask.** The crossing boxes read the transparent export's band darkness (the 64-23 census's measured lesson: the coverage alpha is a saturated union and cannot grade). The direction — fresh crossing light (50.64), aged crossing dark (250.16) — is recorded as evidence; the comparator gates only finiteness, range and the ≥ 1 luma separation.
- **Memory and cost are recorded, not gated.** Sheet pair 9,331,200 B at 1080² and 33,554,432 B at 2K; pool-0 atlas +1 FLOAT_R layer; frame cache 0 B (a committed frame is a WebP raster and a new frame starts clean on the sentinel). These sit beside D-24's +26.1 MB / +67.1 MB and spike 002's +103 ms bake as reference points.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The RED suite failed at collection, not at its assertions**
- **Found during:** Task 2 (the RED commit)
- **Issue:** The new slice fixtures resolved their anchors at module collection, so the run failed before any target test executed — a collection fault, not a RED.
- **Fix:** The slice anchors became lazy (resolved at test time), so all 11 new tests executed and failed on their planned assertions while the 92 pre-existing tests passed in the same run.
- **Files modified:** `src/playground/scattering.test.ts` (fixture anchors)
- **Verification:** `.gsd/tdd-evidence/64-24/task2-red.json` → `RED_EVIDENCE_OK`; `gsd_run check tdd-red-evidence .gsd/tdd-evidence/64-24/task2-red.json` passes
- **Committed in:** `c57b8401a`

**2. [Rule 1 - Bug] Five bristle baselines moved, not four — the census baseline moved too**
- **Found during:** Task 2's GREEN capture
- **Issue:** The must_haves truth names "the four bristle gates this extension owns", but `bristle-edge-1080` (64-23's census baseline) also legitimately moved: the timestamp gate changes pickup on the census's crossings, exactly as it does on the other four. The plan's own `files_modified` lists all five, so the action is within the plan.
- **Fix:** Re-authored all five from verified `--other` pairs (`bristle-body0-1080`, `bristle-body100-1080`, `bristle-body100-2048`, `bristle-round-body0-1080`, `bristle-edge-1080`); no identity-set baseline was touched.
- **Files modified:** the five baseline JSONs
- **Verification:** every re-authored gate reproduces byte-identically with `--other`; the nine identity gates all PASS against unedited baselines
- **Committed in:** `dfe46df10`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** No scope creep and no model change. Deviation 1 keeps the RED honest; deviation 2 records that the census baseline is inside the gate's legitimate footprint, with the identity set untouched.

## Issues Encountered

- The plan's estimate (118 000 tokens) versus the realized diff (31 549 tokens, chars/4 over 126 197 chars) — the estimate was accepted at 1.18× the 100 000-token smart-zone budget with `confidence: low`; the realized work came in well under it.
- The measurement's discriminating band is narrow by design: the water swash writes only `brushWet`, so under the proxy the revived wetness is the only difference and the exported digests carry it (`ca1553bf` vs `4ff81f59` on the transparent export) while the box readings differ by only 0.3 luma. The comparator therefore gates the boxes' separation WITHIN one capture and leaves the across-mode relation to `--differs-from`'s digest check, where it is unambiguous.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The bristle extension is complete as a four-plan chain (64-21 carrier → 64-22 gather/coverage → 64-23 traces → 64-24 wetness): the delivery law's closed set is three `RGBA16F` `1 × 256` reservoirs, one `RGBA16F` `1 × 256` shape target, one document-sized `R32F` pair, and three passes — carrier, gather, touch refresh — with the gather's consumers exactly three (`bristleDeposit`, `bristleCover`, `bristleBodyCover`).
- The field is engine state only: no project member, no parser, no Rust mirror, no frame-cache entry (0 B). Nothing a reopened project could read as wet.
- Open row for UAT (D-30): whether the retuned acrylic — water 26, bleed 22, flow 60, twelve-second tack — reads as the wetter, edge-flowing paint the D-25 decision describes. Everything automated is green: 729 tests pass (8 pre-existing skips), `check` and `build` clean, the identity set byte-identical, and the acceptance and its baseline committed.

---
*Phase: 64-medium-engine*

## Self-Check: PASSED

- FOUND: packages/efx-watercolor/src/playground/lastTouch.test.ts
- FOUND: packages/efx-watercolor/probe/medium-engine/baselines/bristle-wet-1080.json
- FOUND: .planning/phases/64-medium-engine/64-24-SUMMARY.md
- FOUND: afb36bd61, c57b8401a, dfe46df10, a6dcd283c (all ancestors of HEAD)
