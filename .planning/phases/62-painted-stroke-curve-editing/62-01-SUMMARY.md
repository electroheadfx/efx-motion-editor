---
phase: 62-painted-stroke-curve-editing
plan: 01
subsystem: physic-paint (vector path editing)
tags: [preact-signals, vector-path, curve-fit, douglas-peucker, pressure-remap, tdd]

# Dependency graph
requires:
  - phase: 61-painted-stroke-anchor-model
    provides: anchor model ({x,y,kind,in,out,width,color}), curveMode absent-key default, evaluateAquarellePath, normaliseAquarelleAnchors, toStudioStroke
  - phase: 56-aquarelle-record-store
    provides: the ONE script-write seam (updateAquarellePathInScript), the pre/post snapshot pair and the edit ledger
provides:
  - "fitVectorPathAnchors — the pure interpolating, curvature-adaptive fitter on original samples"
  - "curveFitSession + curveWireframeRestore — the session-only held fit and the D-06 restore bracket"
  - "updateAquarellePathInScript options seam — mode-carrying conversion in ONE write, ONE bump, ONE ledger entry"
  - "resampleVectorSpineWithPressureLaw — count-preserving arc stations plus the arc-length pressure remap"
affects: [62-02 curve-mode entry UI, 62-03 overlay preview, 62-04 edit gestures, 62-05 re-bake verification]

# Actuals (#2632) — same chars/4 scale as the plan's estimate.
actuals:
  tokens: 24071
  tasks: 3
  commits: 6

commits: 6
plan_head_before: 2f2aa4c1565b6aa63248c0a5c73262d20092a6bb
plan_head_after: a21ca9ce669da9315a925954410ff0c125d532f5

tech-stack:
  added: []
  patterns:
    - "Interpolating decimation (Douglas-Peucker + turn pass) instead of least-squares fitting, so anchors are always original samples"
    - "Count-preserving edit re-sample: the sample count IS ticks, so edits redistribute samples rather than minting a new wet lifetime"
    - "Arc-length pressure remap with both ends pinned, sentinel-preserving"
    - "Dynamic-import test pins for planned exports, keeping RED a behavioural failure rather than a module-load failure"

key-files:
  created:
    - app/src/components/physic-paint/view/vectorPathFit.ts
    - app/src/components/physic-paint/view/vectorPathFit.test.ts
    - app/src/components/physic-paint/view/vectorPathCurveBracket.ts
    - app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
    - app/src/components/physic-paint/view/vectorPathHandles.ts
    - app/src/components/physic-paint/view/vectorPathHandles.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts

key-decisions:
  - "The conversion rides the existing updateAquarellePathInScript seam through a new options argument (curveMode), so anchors, mode and re-derived points land in ONE write with ONE revision bump and ONE ledger entry — no second write path."
  - "The default mode is the ABSENT key: the in-app gesture passes no explicit mode, so the first conversion stores no curveMode key and the preview cannot disagree with what is persisted."
  - "The fit is interpolating, never approximating: Douglas-Peucker runs on the ORIGINAL polyline with tolerance equal to PATH_SAMPLE_STEP_UV, and a turn pass above pi/4 guarantees a retained vertex at every cumulative turn before the 40-anchor cap."
  - "The cap falls back in a bounded order: tolerance doubling (8 steps), then index decimation with endpoints pinned. Douglas-Peucker is iterative (explicit stack) so a pathological stroke cannot exhaust the call stack."
  - "Every edit seam now preserves the recorded sample count (it IS ticks) and remaps the recorded pressure along the source polyline's arc length with both ends pinned; an all-sentinel stroke stays all-sentinel."
  - "The draw-time mint (resampleVectorPaintPoints + vectorSpinePressures in buildVectorStroke) is untouched — the new law only redistributes samples an edit already owns."

patterns-established:
  - "Fit and re-sample laws are pure type-only modules with independent oracles written out in the tests, never importing the law they check"
  - "Conversion safety = one snapshot pair + one revision bump + same timeline index; undo restores the exact hand samples"

requirements-completed: [CRV-01, CRV-02]

coverage:
  - id: D1
    description: "A fitted anchor list converts an anchorless painted stroke in ONE script write (anchors, optional non-default curveMode, re-derived points), one revision bump and one timeline index; one undo restores the exact hand samples and removes both keys."
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#62-01 painted-stroke conversion — one write, one undo"
        status: pass
    human_judgment: false
  - id: D2
    description: "Entering a fitted session holds the fit in module-level session state (D-03: arming writes nothing) and the wireframe bracket captures the pre-entry value before forcing Draft on (D-06)."
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The curvature-adaptive interpolating fitter: anchors sit ON recorded samples, straight runs carry no interior anchors, turns keep theirs, the list is capped at 40 with a floor of 2 and is deterministic."
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathFit.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both edit seams preserve the recorded sample count and remap the recorded pressure by source arc length with pinned ends; all-sentinel strokes stay sentinel and the draw-time mint is untouched."
    requirement: CRV-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#62-01 D-07/D-08 — the count-preserving pressure-law re-sample"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#62-01 D-07/D-08 — count preservation and the pressure remap"
        status: pass
    human_judgment: false
  - id: D5
    description: "Native UAT rows A–D: fitted anchors sit on the paint with no visible deviation, one anchor edit re-renders at an identical wet lifetime, undo/redo restore the wash, and lift-erased regions plus grain survive the re-bake."
    requirement: CRV-02
    verification: []
    human_judgment: true
    rationale: "Requires painting live in the app and visually judging wash shape, wet lifetime, texture and erased-region survival — automation cannot see the rendered result. Row A also awaits 62-02's curve-mode entry UI."

# Metrics
duration: 22min
completed: 2026-11-14
status: complete
---

# Phase 62 Plan 01: Painted-Stroke Curve Conversion Summary

**A painted stroke now converts to editable `auto` anchors in one undoable write — interpolating curvature-adaptive fit on the recorded samples, and a count-preserving, arc-length pressure remap at every edit seam**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-11-14T12:14:12Z
- **Completed:** 2026-11-14T12:35:55Z
- **Tasks:** 3 (all TDD: RED then GREEN)
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments

- `fitVectorPathAnchors` turns recorded samples into `auto` anchors that are always original samples (D-04), with Douglas-Peucker on the original polyline, a pi/4 cumulative-turn pass, and a deterministic 40-anchor cap (D-05).
- `updateAquarellePathInScript` gained the optional conversion mode and performs the whole conversion — anchors, absent-key default mode, re-derived points — in one revision bump, one ledger entry and one timeline index (D-01/D-02/D-12).
- `vectorPathCurveBracket.ts` holds the fit in session state only (D-03) and brackets the wireframe restore value before forcing Draft on (D-06).
- `resampleVectorSpineWithPressureLaw` makes every edit preserve the recorded sample count (the count IS `ticks`, D-08) and remap the recorded pressure by source arc length with both ends pinned (D-07).
- The draw-time mint (`resampleVectorPaintPoints` + `vectorSpinePressures` in `buildVectorStroke`) is untouched; its shipped pins still pass.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1: End-to-end conversion in ONE write and one undo restores it** (tracer, tdd) - `c5f490161` (test), `4630e8014` (feat)
2. **Task 2: The curvature-adaptive interpolating fitter** (tdd) - `64dbfdaf6` (test), `5e1a516c8` (feat)
3. **Task 3: Count preservation and the arc-length pressure remap** (auto, tdd) - `512cdab6c` (test), `a21ca9ce6` (feat)

Measured from the plan ledger base `2f2aa4c1565b6aa63248c0a5c73262d20092a6bb`: 6 commits, head `a21ca9ce669da9315a925954410ff0c125d532f5`.

## Files Created/Modified

- `app/src/components/physic-paint/view/vectorPathFit.ts` - the pure interpolating fitter (sanitise, Douglas-Peucker, turn pass, bounded cap, deterministic freeze)
- `app/src/components/physic-paint/view/vectorPathFit.test.ts` - straight run, corner, locality, cap/determinism, floor, non-mutation and purity pins
- `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` - the session-only held fit, its setters and the wireframe restore bracket
- `app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts` - arming writes nothing, one held session, restore bracket pins
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` - the options-carrying path write and both seams rewired to the count-preserving law
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` - `beginAquarellePathEdit` forwards the conversion options through the SAME snapshot pair
- `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts` - conversion, undo/redo, idempotence and D-07/D-08 pins
- `app/src/components/physic-paint/view/vectorPathHandles.ts` - `resampleVectorSpineWithPressureLaw` (+ arc helpers); mint untouched
- `app/src/components/physic-paint/view/vectorPathHandles.test.ts` - the law's stations, pressure remap, sentinel and degenerate-spine pins
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` - the 61-31 mode-flip pin retargeted to the D-08 law

## Decisions Made

- **The conversion reuses the existing script-write seam** instead of a second write path: `updateAquarellePathInScript(mutationId, anchors, options?)` stores anchors, mode and points together, so one undo restores the exact hand samples and removes both keys.
- **Default mode = absent key**: the in-app gesture passes no explicit mode; only a non-default mode is stored, so an untouched document keeps its exact bytes (REL-02).
- **Fit = decimation of original samples, never least-squares**: tolerance equals `PATH_SAMPLE_STEP_UV` (never coarser than the sampler), ties break to the lower index, and the cap thins straight runs by tolerance doubling before index decimation.
- **Edits never mint a new wet lifetime**: the sample count is preserved and pressures are remapped by source arc length; sentinel strokes stay sentinel so mouse strokes keep speed-derived texture.
- **The draw-time mint stays as shipped**: its real-data A/B pins (peak ink, core width, halo) are untouched; the new law is used only where an edit already owns the samples.

## Deviations from Plan

### Planned-law-driven test retargets (no production scope change)

**1. [In-scope pin retarget] The 61-31 mode-flip pin was retargeted to D-08**
- **Found during:** Task 3 (count preservation), plan-level 8-file verification
- **Issue:** `aquarelleStrokeSelection.test.ts` still asserted the pre-62 length-proportional resample (`sampledModePoints(...)`) for both the spline flip and the flip back to Bézier. The planned D-07/D-08 law intentionally retires exactly those edit-time pins; the file was not listed in Task 3's `<files>` but is part of the plan's own verification command.
- **Fix:** Added an independent `arcStations` oracle (count preserved, evenly by arc length) and retargeted both assertions; the flip back now asserts the count is preserved and the draw-time hand-cadence samples are NOT restored, stated as D-08.
- **Files modified:** `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts`
- **Verification:** the full 8-file suite passes (243 tests); typecheck clean.
- **Committed in:** `a21ca9ce6` (Task 3 GREEN)

**2. [Test precision] The mode round-trip pressure comparison is numeric, not bit-exact**
- **Found during:** Task 3 GREEN
- **Issue:** Flipping spline → bezier re-derives pressures from the samples the flip starts from, so the remap agrees to interpolation precision (~1e-13) rather than bit-for-bit. A strict `toEqual` on the point list over-pinned the old sentinel behaviour.
- **Fix:** The pin now asserts identical count and identical x/y geometry, with pressures compared at 9 decimal places.
- **Files modified:** `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts`
- **Verification:** all 125 Task 3 tests pass.
- **Committed in:** `a21ca9ce6` (Task 3 GREEN)

---

**Total deviations:** 2 in-scope test retargets (0 Rule 1–4 auto-fixes)
**Impact on plan:** No production scope change. Both retargets are the planned D-07/D-08 retirement of the pre-62 length-proportional edit pins.

## TDD Gate Compliance

| Task | RED evidence | Verdict | RED commit | GREEN commit |
|------|--------------|---------|------------|--------------|
| 1 (tracer) | `62-01-RED-evidence.json` | RED_EVIDENCE_OK | `c5f490161` | `4630e8014` |
| 2 (tdd) | `62-01-fit-RED-evidence.json` | RED_EVIDENCE_OK | `64dbfdaf6` | `5e1a516c8` |
| 3 (tdd) | `62-01-d07-RED-evidence.json` | RED_EVIDENCE_OK | `512cdab6c` | `a21ca9ce6` |

Each RED commit touched test files only; each GREEN commit carries the implementation. The Task 3 RED evidence target ("preserves the recorded sample count through a much longer and a much shorter spine") failed on the planned assertion (41 samples minted, expected the preserved 5), not on a load or fixture fault. The tracer feedback gate re-ran Task 1's verify end-to-end before Task 2, and it passed.

## Issues Encountered

- **Task 3 RED premise fix:** the 61-30 path-edit case originally asserted spline/bezier divergence at the mid station, where the two evaluations nearly coincide (6.9e-8). The premise now takes the maximum delta across all stations and asserts the edit reproduces the spline at that divergent station.
- **RED evidence format:** the TAP strict parser breaks on multiline YAML diagnostics, so all RED evidence was captured with `--reporter=junit` and validated by `gsd_run check tdd-red-evidence`.
- **Injection-scan LOW notice** on `scriptStrokeEdition.ts` recurring from a code comment; assessed as a false positive, no behaviour change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fitVectorPathAnchors`, `beginPaintedCurveSession` and the options-carrying conversion write are ready for 62-02's curve-mode entry UI.
- The overlay preview in 62-03 can read `resolveAquarelleCurveMode` and the held session; no document write exists before a committed gesture.
- Native UAT rows A–D remain open for the user; row A also awaits 62-02's entry UI.
- No stubs or unrun verifies: all three plan verification commands ran green (8-file suite 243 tests, watercolor package 96 tests, `tsc --noEmit` clean).

---
*Phase: 62-painted-stroke-curve-editing*
*Completed: 2026-11-14*

## Self-Check: PASSED

- Created files exist: `vectorPathFit.ts`, `vectorPathFit.test.ts`, `vectorPathCurveBracket.ts`, `vectorPathCurveBracket.test.ts`
- Commits are ancestors of HEAD: `c5f490161`, `4630e8014`, `64dbfdaf6`, `5e1a516c8`, `512cdab6c`, `a21ca9ce6`
