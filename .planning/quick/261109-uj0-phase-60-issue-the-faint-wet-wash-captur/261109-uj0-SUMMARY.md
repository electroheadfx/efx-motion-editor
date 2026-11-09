---
phase: 261109-uj0-phase-60-issue-the-faint-wet-wash-captur
plan: 01
subsystem: physic-paint
tags: [aquarelle, capture-gate, wet-wash, roto, production-diagnostics, vitest]

# Dependency graph
requires:
  - quick: 261109-pwt
    provides: the 0.3 global capture floor and the eager snapshot / promotion / settle capture pipeline
  - phase: 52.1
    provides: the live-pixel capture transactions the gate guards
provides:
  - node-pure capture-ink measurement (historical global mean + densest capped 12x12 window) and one gate predicate
  - one production-visible console.warn per rejection with measured inks, floors and frame/identity context
  - the Studio's two capture ports decided by the shared predicate; no Studio-owned ink threshold
affects: [Phase 61, Phase 62, v2.1.0-beta2 release verification]

actuals:
  tokens: 7279
  tasks: 2
  commits: 4
  plan_head_before: 4ad44e56063d01da3395f01c4d8e8816944d251e
  plan_head_after: 7860637008161faebe597a26026fc82350c32b07

tech-stack:
  added: []
  patterns:
    - "Localized capture statistic: densest 12x12 window with a per-pixel darkening cap, OR-ed with the historical global floor"
    - "One module owns every threshold; consumers import the predicate instead of re-declaring a floor"
    - "Production-visible rejection diagnostic: one console.warn line with measured values, never DEV-gated"

key-files:
  created:
    - app/src/components/physic-paint/roto/aquarelleCaptureInk.ts
    - app/src/components/physic-paint/roto/aquarelleCaptureInk.test.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts

key-decisions:
  - "The gate is the OR of the historical global floor (0.3) and the densest capped window floor (2.5): a faint wash passes on area, a cleared sheet and paper flecks stay rejected"
  - "Cap each pixel's darkening at 8 inside a window so amplitude (specks) cannot impersonate area (a wash)"
  - "The measurement module owns every capture ink threshold; the Studio imports the predicate and declares none"
  - "A rejection prints exactly one console.warn line with frame/startFrame/op/layer/track and both inks/floors; no DEV gate, no file, no async work"
  - "The eager snapshot, sequence assignment, promotion, retry, settle and flush paths after the gate are byte-identical to HEAD"

requirements-completed: [QUICK-261109-UJ0]

coverage:
  - id: D1
    description: "Pure, deterministic capture-ink measurement and gate: historical global per-mille mean plus the densest 12x12 capped window; blank sheets and flecks rejected, faint below-global-floor washes accepted"
    requirement: QUICK-261109-UJ0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCaptureInk.test.ts#quick 261109-uj0 — localized aquarelle capture ink"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both Studio capture ports use the shared predicate, and a rejection emits exactly one non-DEV console.warn with measured values and frame/identity context; capture laws after the gate pinned unchanged"
    requirement: QUICK-261109-UJ0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#rejects a blank aquarelle sheet before it can overwrite painted cache pixels"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#quick 261109-uj0 — capture laws stay intact around the localized gate"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts#still applies the capture ink gate at the capture entry"
        status: pass
    human_judgment: false
  - id: D3
    description: "Packaged-build UAT: a faint wet wash survives the first return, a cleared sheet never overwrites the cache, and any residual rejection prints the measured diagnostic line"
    requirement: QUICK-261109-UJ0
    verification: []
    human_judgment: true
    rationale: "The dev-passing / packaged-rejecting divergence reproduces only on the compiled app (261109-pwt precedent); vitest cannot exercise the packaged webview timing or stderr. The user runs the app."

# Metrics
duration: 4min
completed: 2026-11-09
status: complete
---

# Quick 261109-uj0: Localized aquarelle capture ink gate Summary

**The blank-sheet capture gate now decides on the densest capped 12x12 ink window as well as the historical global mean, so a faint wet wash below 0.3 is accepted while blank sheets, near-white texture and clustered paper flecks stay rejected; every remaining rejection prints one non-DEV warn line with its measured values.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-09T21:08:10Z
- **Completed:** 2026-11-09T21:12:16Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `aquarelleCaptureInk.ts` measures, in one pass over raw RGBA data, the historical global per-mille mean (48x48, white 248, Rec.709, alpha ignored) and the densest 12x12 sampling window (stride 4) with a per-pixel darkening cap of 8; the gate is the OR of `globalInk >= 0.3` and `localInk >= 2.5`, and every unmeasurable sample fails open.
- Eleven behavior fixtures prove a uniform cleared sheet, the measured blank baseline (0.054 / 0.163), scattered flecks and the worst-case single-window cluster (1.416) are rejected, while a faint 6x6 wash whose global ink is 0.245 — below the historical floor, i.e. rejected by the pre-change gate — is accepted through 3.92 localized ink, including when it straddles the sampling grid.
- Both Studio capture ports (the cache capture entry and the Save Script thumbnail) now decide through `passesAquarelleCaptureInkGate`; the Studio no longer declares an ink threshold of its own.
- A rejection emits exactly one `[aquarelle-capture] ink-gate rejected blank sheet ...` console.warn carrying `frame`, `startFrame`, `op`, `layer`, `track`, the rounded `globalInk`/`localInk`, `inkPixels` and both floors. It is not wrapped in `import.meta.env`, writes no file and starts no async work.
- The capture pipeline after the gate is untouched: eager snapshot, sequence assignment, pending promotion, deferred capture queue, retry, settle and flush are byte-identical to HEAD.

## Task Commits

Each task was committed atomically (TDD task split into RED / GREEN / wiring):

1. **Task 1 RED: failing localized capture-ink tests** - `05d1a59de` (test)
2. **Task 1 GREEN: capture-ink module and gate** - `036b83c42` (feat)
3. **Task 1 wiring: both Studio ports + production warn + retargeted pins** - `c1a02f881` (feat)
4. **Task 2: capture-law invariant pins** - `786063700` (test)

**Plan metadata:** handled by the orchestrator (SUMMARY/STATE docs commit).

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `app/src/components/physic-paint/roto/aquarelleCaptureInk.ts` - pure measurement, constants, fail-open value and the one gate predicate
- `app/src/components/physic-paint/roto/aquarelleCaptureInk.test.ts` - eleven raw-RGBA behavior fixtures
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - sampler returns the measurement; both capture ports gated; one production warn; `roundAquarelleInk`; no local threshold
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - capture-gate pin moved to the predicate plus warn/no-DEV assertions; new five-test capture-laws describe
- `app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts` - capture-entry gate literal retargeted and retitled

## Decisions Made

- Reject only on the shared predicate; the localized path is deliberately additive (OR), so the historical global floor and its diagnostic meaning are unchanged.
- The amplitude cap is a per-pixel constant (8) inside the window, making isolated specks a coverage question rather than an amplitude one; one full-black pixel contributes 0.218 to the localized statistic.
- The rejection diagnostic is one template-literal `console.warn` on purpose: the DEV-gated render-split event is invisible in the packaged build, which is why beta2 left no trace.
- The guard calls `passesAquarelleCaptureInkGate(ink)` directly (the explicit pin literal); `passesInkGate` remains the single computation used in the DEV event payload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - plan assertion corrected] Amplitude-cap fixture gate outcome**
- **Found during:** Task 1 GREEN (module tests)
- **Issue:** The plan's Test 8 says a single luminance-0 pixel on a uniform base must leave the gate false. Under the mandated OR predicate, that fixture's historical global ink is 0.422 (248/2304 × 1000/255), which is above the 0.3 global floor — so the gate returns true on the global path, exactly as the pre-change gate did. The plan's own verified-arithmetic line only claims the localized 0.22.
- **Fix:** The test pins the actual contract: capped `localInk` ≈ 0.218 (below the 2.5 localized floor, proving amplitude cannot spoof area) and `globalInk` ≈ 0.42. No implementation change.
- **Files modified:** `roto/aquarelleCaptureInk.test.ts`
- **Verification:** module suite green (11/11)
- **Committed in:** `036b83c42`

**2. [Rule 1 - fixture corrected] Fifteen-fleck cluster placement**
- **Found during:** Task 1 RED design
- **Issue:** The plan's literal "row 20, x 16..23 and x 16..22" overlaps to eight unique pixels; fifteen flecks inside one 12x12 window would measure 3.38 and ACCEPT a blank sheet, contradicting the plan's verified 1.85 and the required rejection.
- **Fix:** Fifteen flecks as two clusters in row 20 (x 16..23 and x 28..34) so the densest window holds eight flecks plus four baseline samples: 68/144 × 1000/255 = 1.852, still below 2.5. The rejection the plan requires is preserved.
- **Files modified:** `roto/aquarelleCaptureInk.test.ts`
- **Verification:** module suite green (11/11)
- **Committed in:** `036b83c42`

**3. [Rule 1 - expectation precision] Normal-paint control expected value**
- **Found during:** Task 1 GREEN (module tests)
- **Issue:** 20% of a 48x48 sample is 460.8 pixels; the every-fifth-sample fixture paints 461, so the actual global ink is 29.8169, not the continuous-coverage ideal 29.8 that `toBeCloseTo(..., 2)` could not accept (0.017 > 0.005).
- **Fix:** Pinned the discrete value 29.82 at precision 2. The gate outcome and scale remain fully pinned.
- **Files modified:** `roto/aquarelleCaptureInk.test.ts`
- **Verification:** module suite green (11/11)
- **Committed in:** `036b83c42`

**4. [Rule 3 - blocking] Guard literal vs pin literal**
- **Found during:** Task 1 targeted suite
- **Issue:** The plan's wiring snippet writes the guard as `if (!passesInkGate)` while its explicit pin instruction names `if (!passesAquarelleCaptureInkGate(ink))`; both existing pins failed on the snippet form.
- **Fix:** Used the pin literal. The predicate is pure, so the second call is free of side effects; `passesInkGate` stays the single value recorded in the DEV event.
- **Files modified:** `PhysicsPaintStudio.tsx`
- **Verification:** targeted suites green (379 tests)
- **Committed in:** `c1a02f881`

---

**Total deviations:** 4 auto-fixed (3 plan-assertion/fixture corrections, 1 blocking literal mismatch)
**Impact on plan:** No scope creep and no weakened behavior pin: every correction makes the tests match the plan's own verified arithmetic and the mandated predicate; the intended reject/accept outcomes are unchanged.

## TDD Gate Compliance

- RED: `05d1a59de` (`test(261109-uj0): ...`) — created `aquarelleCaptureInk.test.ts` before the module. Evidence: `261109-uj0-01-RED-EVIDENCE.json`. The observed failure is a module-resolution failure with zero tests discovered, which is the plan's explicit RED step ("record that it fails because the module does not exist"); semantic assessment: the suite's 11 behavior assertions are the planned contract and all passed after GREEN.
- GREEN: `036b83c42` (`feat(261109-uj0): ...`) — implementation made all 11 pass.
- Task 2 (`tdd="true"`, invariant pins): no RED is possible by design — the five pins codify laws Task 1 already implemented, and the plan forbids production changes in Task 2 (a failing assertion had to correct Task 1's wiring instead). All five passed on first run against Task 1.

## Issues Encountered

- None beyond the plan/arithmetic reconciliations documented above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Automated gates are green: typecheck, the three targeted suites (379 tests), the Studio suite (346 tests) and the full suite (409 files, 8,433 passed, 1 skipped, 96 todo). The production `viteBuild` test inside the full run also passed (chunk budget intact).
- Native UAT rows 1-5 from the plan remain pending on the compiled build (faint wash survives the first return, cleared sheet never overwrites, diagnostic line on any residual rejection, Save Script thumbnail, dev control). Those rows are the user's; no dev server was started and no `.test.tsx` was added.
- Phase 61 and the beta2 release verification are otherwise unaffected; the capture pipeline after the gate is unchanged.

## Self-Check: PASSED

- All five planned files and this SUMMARY exist on disk.
- All four task commits (`05d1a59de`, `036b83c42`, `c1a02f881`, `786063700`) are ancestors of HEAD.
- No `.test.tsx` was added; no dev server or `pnpm tauri dev` was started.
