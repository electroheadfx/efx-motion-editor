---
phase: 62-painted-stroke-curve-editing
plan: 03
subsystem: physics-paint / vector path overlay
tags: [preact-signals, tdd, tracer, vector-path, held-fit, ghost-spine, pressure-band, d-09]

# Dependency graph
requires:
  - phase: 62-painted-stroke-curve-editing
    provides: 62-01's held fit (`beginPaintedCurveSession`) and 62-02's eligibility gate, writer admission and ONE exit funnel
provides:
  - "The armed held fit as the ONE Phase 61 overlay's edit target for an anchorless painted stroke (record anchors win once committed)"
  - "`getHeldFit` key-handler seam so Delete/Backspace works on a fitted anchor list"
  - "`resolveAquarelleCurveMode(stroke.curveMode)` for BOTH anchor sources — never the draw-time mint"
  - "The display-only ghost of the original recorded spine (`vector-path-curve-ghost`, #94a3b8 / 0.45 / 1px / 3 3)"
  - "`hasRecordedPressureProfile` — the recorded-profile discriminator for D-09"
  - "`DrawnVectorPath.envelopePx` + `renderPath`'s ONE-ring envelope source (band ?? anchor-width)"
affects: [62-04, 62-05]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 39375
  tasks: 3
  commits: 5
  plan_head_before: 56df3204ada33eb4763d16c57e5cba193b2b1cfe
  plan_head_after: b996d469328a4dc402adec322a62e0f619be0d72

tech-stack:
  added: []
  patterns:
    - "Held-fit fallback resolved in the render body from one signal read; record anchors always outrank the session"
    - "Single narrow render-body read of `curveFitSession` feeds edit-target resolution, the recorded loop and the ghost"
    - "Display-only ghost polyline as the FIRST svg child, frozen to the session snapshot (commits never rewrite it)"
    - "Dynamic-import test double for a planned-but-missing export, so RED fails behaviourally instead of at module load"
    - "One envelope source per path (`envelopePx ?? projection.envelope`) fed by the shipped revision-keyed band cache"

key-files:
  created:
    - .planning/phases/62-painted-stroke-curve-editing/62-03-t1-RED-evidence.json
    - .planning/phases/62-painted-stroke-curve-editing/62-03-t3-RED-evidence.json
  modified:
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
    - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts

key-decisions:
  - "Record anchors first, held fit second: a committed gesture's write instantly becomes the edit target and the session never shadows it"
  - "The held fit's mode is resolveAquarelleCurveMode(stroke.curveMode) — the exact expression 62-01's converting write persists; DEFAULT_VECTOR_PATH_CURVE_MODE stays the draw-time mint only"
  - "getHeldFit is read at event time (.peek()), so the key seam subscribes to no session signal"
  - "The ghost projects the session's sourcePoints snapshot directly; non-finite samples are dropped and under two survivors draw nothing (T-62-11)"
  - "D-09 discriminates on the recorded samples themselves (any finite p >= 0), never a persisted converted flag, which D-02 forbids"
  - "The all-sentinel mouse profile keeps the shipped anchor-width envelope — the documented D-09 exception, asserted positively in both the predicate and the render"
  - "The band is computed only while a display gate is on (wireframe || previewStrokeSize) and always through buildStrokeBandCached's revision|width|height stamp"

requirements-completed: [CRV-01]

coverage:
  - id: D1
    description: "An armed held fit is the overlay's edit target for an anchorless painted stroke: fitted spine + one marker per anchor, interactive surface, one commit per drag"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#62-03 — the armed held fit in the ONE overlay"
        status: pass
    human_judgment: false
  - id: D2
    description: "Delete/Backspace deletes a fitted anchor through the getHeldFit seam in ONE onPathEdit and stays a no-op without the seam"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#62-03 — the armed held fit in the ONE overlay"
        status: pass
    human_judgment: false
  - id: D3
    description: "The held fit draws in resolveAquarelleCurveMode(stroke.curveMode), never the draw-time mint: a handle-bearing session renders a different spline and bezier spine"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#62-03 — the armed held fit in the ONE overlay"
        status: pass
    human_judgment: false
  - id: D4
    description: "The original recorded spine draws as a faint ghost beneath the fitted path, frozen to the session snapshot, absent without a session or with every sample non-finite"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#62-03 — the armed held fit in the ONE overlay (ghost cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A stroke with a real recorded pressure profile draws its recorded band as the construction-view envelope, element for element with buildStrokeBand, before and after its first commit"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#62-03 — the armed held fit in the ONE overlay (D-09 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The all-sentinel mouse profile keeps the shipped anchor-width envelope — the documented D-09 exception, asserted positively and against the band ring"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#62-03 — the armed held fit in the ONE overlay (D-09 cases) + aquarelleStrokeBand.test.ts#62-03 D-09 predicate"
        status: pass
    human_judgment: false
  - id: D7
    description: "With both display gates off no envelope is emitted for either profile; the band cache rebuilds after a revision bump (no stale polygon)"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#62-03 — the armed held fit in the ONE overlay (D-09 cases)"
        status: pass
    human_judgment: false
  - id: D8
    description: "hasRecordedPressureProfile is total and fail-closed: true for any finite non-negative sample, false for the all-sentinel, empty and non-finite cases"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts#62-03 D-09 — the recorded pressure profile predicate"
        status: pass
    human_judgment: false
  - id: D9
    description: "Native UAT rows A-D: fitted path over the paint with the ghost beneath; live anchor drag with a frozen ghost and no wash re-render; real pen taper vs the mouse exception in the construction view; clean exit vanishes the chrome"
    requirement: CRV-01
    verification: []
    human_judgment: true
    rationale: "Rows A-D are judged on the live canvas by the user; this plan ships and pins the render contracts they observe."

# Metrics
duration: 10min
completed: 2026-11-14
status: complete
---

# Phase 62 Plan 03: The ONE overlay edits the held fit, ghosts the original spine, and shows the real taper

**An anchorless painted stroke is now drawn, edited, deleted and ghosted through its armed fitted anchors in the shipped Phase 61 overlay, and the construction view shows the stroke's real recorded pressure band instead of a synthetic uniform ribbon (with the mouse-sentinel exception documented and pinned).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-11-14T12:57:40Z (ledger base)
- **Completed:** 2026-11-14T13:07:16Z
- **Tasks:** 3
- **Files modified:** 6 (4 source/test + 2 RED evidence records)

## Accomplishments

- The ONE Phase 61 overlay resolves an armed `curveFitSession` as its edit target exactly like record anchors: one fitted spine, one marker per anchor, an interactive surface, and every shipped gesture (drag, spine click, Delete) leaving as exactly ONE `onPathEdit`.
- The Delete/Backspace law gained a `getHeldFit` seam read at event time, so a fitted anchor can be deleted before the record carries any anchors.
- The held fit draws in `resolveAquarelleCurveMode(stroke.curveMode)` — the same expression the converting write persists — proven with a handle-bearing session where spline and bezier spines genuinely differ; `DEFAULT_VECTOR_PATH_CURVE_MODE` stays the draw-time mint.
- The original hand-painted spine draws as a faint slate ghost (`#94a3b8`, opacity 0.45, 1 px, dash `3 3`) as the FIRST svg child, frozen to the session snapshot, and vanishes with the session.
- D-09 landed end-to-end: `hasRecordedPressureProfile` reads the record (never a persisted flag, which D-02 forbids), `DrawnVectorPath.envelopePx` threads the shipped `buildStrokeBandCached` polygon into `renderPath`, and ONE ring is drawn from `envelopePx ?? projection.envelope`; the all-sentinel mouse profile keeps the shipped anchor-width envelope as the documented exception.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: arm the held fit as the overlay's edit target** - `6bd66db84` (test)
2. **Task 1 GREEN: edit an anchorless painted stroke through its held fit** - `bd13bce55` (feat)
3. **Task 2: draw the original recorded spine as a ghost** - `6ebb34c28` (feat)
4. **Task 3 RED: pin the D-09 recorded-pressure envelope law** - `fd8a78e61` (test)
5. **Task 3 GREEN: show the recorded pressure band in the construction view** - `b996d4693` (feat)

**Plan metadata:** final docs commit (recorded in the completion report; not part of the measured 5 task commits)

_Task 1 is `type="tracer"` and ran its feedback gate after the GREEN commit: the automated verify was re-run end-to-end (102/102) and passed, so the wave continued to Task 2 without a checkpoint (auto mode off, `human_verify_mode: end-of-phase`, automated-only `<verify>`)._

## Files Created/Modified

- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` - Held-fit edit target + recorded-loop fallback, `getHeldFit` seam, mode contract, ghost projection/polyline, `envelopePx` threading and the ONE-ring envelope source.
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` - 16 new 62-03 cases (7 held fit, 5 ghost, 4 D-09) plus two shipped-pin retargets (palette literals, uniform-profile fixture).
- `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` - `hasRecordedPressureProfile` with the D-02/D-07/D-09/T-61-31 provenance documentation.
- `app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts` - 4 predicate cases resolved through a dynamic double (behavioural RED).
- `.planning/phases/62-painted-stroke-curve-editing/62-03-t1-RED-evidence.json` - Machine-verified RED evidence.
- `.planning/phases/62-painted-stroke-curve-editing/62-03-t3-RED-evidence.json` - Machine-verified RED evidence.

## Decisions Made

- **Record anchors outrank the held fit:** the render-body resolution chains `recordAnchors ?? heldFitAnchors`, so the first committed gesture's write is instantly authoritative and no session state can shadow it.
- **One mode expression for both anchor sources:** `editTargetCurveMode = resolveAquarelleCurveMode(candidate.curveMode)` covers record and held-fit targets; the 61-31 source pins still match literally.
- **The ghost is display chrome over an immutable snapshot:** the session object is never rewritten by commits, so the ghost keeps showing where the hand painted; it needs no teardown because the edit-target/latch gates remove it once the session clears.
- **D-09 arbitrates on the record:** a stored flag would be a D-02 violation, and importing the engine's speed law into a view leaf is forbidden by T-61-31, so the sentinel profile keeps the anchor-width envelope — no data lost, no field added.
- **One envelope ring per path:** `renderPath` reads `drawn.envelopePx ?? projection.envelope`; an empty band polygon means no envelope, never a silent fallback to two sources.
- **The band reuses the shipped cache untouched:** `buildStrokeBandCached` is called with the live revision and the cache's `revision|width|height` stamp, so a record change or resize can never serve a stale polygon.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2 test fixture missing required `AquarellePoint` fields**
- **Found during:** Task 2 (ghost spine), `tsc --noEmit`
- **Issue:** The non-finite ghost fixture declared `{ x, y, p }` where `AquarellePoint` requires `tx`, `ty`, `tw` (TS2739 at two samples).
- **Fix:** Added the three zero tilt fields to both fixture samples; suite 107/107 and `tsc` clean afterward.
- **Files modified:** app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
- **Commit:** `6ebb34c28`

**2. [Plan-directed retarget] The shipped palette pin now admits the documented ghost slate**
- **Found during:** Task 2 (ghost spine)
- **Issue:** The 61-22 static pin asserted exactly five hex literals in the overlay source; the plan mandates the ghost palette constant beside them, so the sixth literal `'#94a3b8'` failed the pin.
- **Fix:** Retargeted that one assertion to the six documented literals with a comment naming the ghost slate as the only addition — inlining the literal instead would have violated the one-palette law.
- **Files modified:** app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
- **Commit:** `6ebb34c28`

**3. [Plan-directed retarget] The 61-25 uniform-profile fixture moved to the sentinel profile**
- **Found during:** Task 3 GREEN
- **Issue:** The shipped D-10 case used `vectorStroke()`, whose default samples carry `p: 1` — a real recorded profile. Under D-09 the editing chrome now draws that stroke's recorded band, so the "uniform profile draws no envelope" assertion failed for a fixture that no longer represents the profile D-10 governs.
- **Fix:** The fixture is now the all-sentinel mouse profile, the ONE profile D-09's exception leaves on the shipped anchor-width envelope; every original assertion (wireframe envelope present, editing envelope refused) is unchanged.
- **Files modified:** app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
- **Commit:** `b996d4693`

### Technique Notes

**Dynamic-import test double (RED technique):** `hasRecordedPressureProfile` is planned but absent from HEAD, so the band tests resolve it through a cast dynamic import and throw at CALL time when missing. This keeps RED behavioural — a static import of a missing export would fail at module load, which the RED gate classifies as `fixture_or_load_failure` and refuses (same pattern 62-02 used). The tests were not edited between RED and GREEN.

## Known Stubs

None. Every surface added by this plan is wired to shipped state: the held fit to `curveFitSession`, the ghost to the session's `sourcePoints`, and the envelope to `buildStrokeBandCached` over the recorded samples.

## TDD Gate Compliance

| Gate | Task | Evidence | Verdict |
|------|------|----------|---------|
| RED | Task 1 (tracer) | `6bd66db84`, `62-03-t1-RED-evidence.json` | `RED_EVIDENCE_OK` (6 of 7 new cases failed behaviourally; shipped 95 green; the seventh is the no-session positive control) |
| GREEN | Task 1 | `bd13bce55` | 102/102 overlay cases pass; tracer feedback gate re-ran the verify and continued |
| RED | Task 3 | `fd8a78e61`, `62-03-t3-RED-evidence.json` | `RED_EVIDENCE_OK` (4 predicate cases throw on the missing export at call time; 2 overlay cases mismatch on the real band ring; 2 positive controls green) |
| GREEN | Task 3 | `b996d4693` | 136/136 band+overlay cases pass |

Task 2 is `type="auto"` (no TDD gate required); its production code and 5 ghost cases landed together in `6ebb34c28`.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/VectorPathOverlay.test.ts src/components/physic-paint/view/aquarelleStrokeBand.test.ts src/components/physic-paint/view/vectorPathCurveBracket.test.ts src/components/physic-paint/view/vectorPathHandles.test.ts` — **243/243 pass**.
- `pnpm --filter efx-motion-editor exec tsc --noEmit` — **clean**.
- Native UAT rows A-D remain for the user (human judgment): fitted path + ghost over the paint; live drag with a frozen ghost; real pen taper vs the mouse exception; clean exit removes the chrome.

## Self-Check: PASSED
