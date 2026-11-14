---
phase: 62-painted-stroke-curve-editing
plan: 02
subsystem: physics-paint / vector path editing
tags: [preact-signals, tdd, vector-path, painted-stroke-conversion, session-bracket, eligibility-gate]

# Dependency graph
requires:
  - phase: 62-painted-stroke-curve-editing
    provides: 62-01's held fit (`beginPaintedCurveSession`), the wireframe entry arm, and the count-preserving resample law
provides:
  - "`resolvePaintedCurveEligibility` / `admitsPathEditWrite` plus the named Lift and degenerate refusal constants"
  - "The gate's painted arm (one eligible painted stroke enables the shipped Edit path button)"
  - "The dialog's painted-entry route through `readCurveEntry` / `enterPaintedCurve` (lazy fit on entry only)"
  - "The widened `handleAquarelleVectorPathEdit` writer seam that admits an eligible anchorless painted stroke"
  - "`registerPathEditExitHook` — the ONE funnel every shipped exit route already passes through"
  - "`resolveCurveExitAction` / `endCurveBracket` — the five-case exit law and its performer"
affects: [62-03, 62-04, 62-05]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 34719
  tasks: 3
  commits: 7
  plan_head_before: 9778cbc704e388edc46e756df50cc3fcfd4ecb92
  plan_head_after: c187aa033b44d5a5345c1f94a2b1eabb29fa06c0

tech-stack:
  added: []
  patterns:
    - "Dynamic-import test doubles for planned-but-missing exports, so RED fails behaviourally instead of at module load"
    - "Single-slot module-level exit hook (register null to detach) instead of editing nine call sites"
    - "Pure five-case exit resolver over a widened {wireframe, draft} pre-entry capture"

key-files:
  created:
    - .planning/phases/62-painted-stroke-curve-editing/62-02-t1-RED-evidence.json
    - .planning/phases/62-painted-stroke-curve-editing/62-02-t3-RED-evidence.json
  modified:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/vectorPathLatches.ts
    - app/src/components/physic-paint/view/vectorPathCurveBracket.ts
    - app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts
    - app/src/components/physic-paint/view/vectorPathSession.ts
    - app/src/components/physic-paint/view/vectorPathSession.test.ts

key-decisions:
  - "Eligibility resolves the vector arm FIRST via normaliseAquarelleAnchors; anchors present but unreadable fail closed instead of offering an editable path"
  - "Admission reuses the eligibility verdict, so the ONE writer seam admits exactly what the gate offers (no second store walk)"
  - "Entry arms the durable base through the shipped armDraftBase BEFORE fitting; a refused arm publishes DRAFT_ARM_REFUSAL_MESSAGE and never holds a fit or opens the latch"
  - "readCurveEntry performs no fit (render-body read only); the fit runs in enterPaintedCurve on the click (D-03)"
  - "The exit resolver ignores preDraft in the dirty branch: a dirty Draft only settles once or stays behind the user's own wireframe (D-14)"
  - "resetForStudioOpen closes path edit through exitPathEdit so the Studio-open route reaches the same hook and no second selection write exists"

requirements-completed: [CRV-01]

coverage:
  - id: D1
    description: "Eligibility law: Brush/Water/Pen with two distinct finite samples enter; Lift and degenerate strokes are refused with fixed named copy"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#62-02 D-10 painted-curve eligibility and named refusals"
        status: pass
    human_judgment: false
  - id: D2
    description: "The shipped path-edit gate enables and titles for one eligible painted stroke and keeps every shipped result unchanged"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#62-02 D-10 painted-curve eligibility and named refusals"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ONE writer seam admits an eligible anchorless painted stroke and still refuses Lift, degenerate and malformed-anchor strokes"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#62-02 painted-curve entry and conversion admission in the Studio"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clicking the shipped spline-pointer on an eligible painted stroke arms the base, fits, brackets the view and opens path edit; a refused arm stays closed"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#62-02 painted-curve entry through the shipped spline-pointer + PhysicsPaintStudio.test.ts entry cases"
        status: pass
    human_judgment: true
    rationale: "UAT row A: the user confirms on a real canvas that one painted Brush stroke lights up the shipped spline-pointer and that entry shows the fitted wireframe."
  - id: D5
    description: "One registered hook fires from exitPathEdit and resetForStudioOpen exactly on a real open -> closed transition"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathSession.test.ts#62-02 the ONE path-edit exit funnel"
        status: pass
    human_judgment: false
  - id: D6
    description: "The five-case exit resolver and the teardown order: drop the fit first, never bake on a clean exit, keep a deferred dirty render behind a user-owned wireframe"
    requirement: CRV-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts#62-02 the exit action resolver + the exit bracket teardown"
        status: pass
    human_judgment: false
  - id: D7
    description: "In-app restore on every shipped exit route (the registered hook wired to the Studio)"
    requirement: CRV-01
    verification: []
    human_judgment: true
    rationale: "The production registration is deliberately 62-04 T2; UAT row C's restore half is judged then. This plan ships and pins the funnel and the bracket it calls."

# Metrics
duration: 16min
completed: 2026-11-14
status: complete
---

# Phase 62 Plan 02: Painted-stroke curve entry and the one exit bracket

**An eligible painted Brush/Water/Pen stroke now opens the shipped spline-pointer through a lazily fitted, count-preserving conversion, and one registered hook restores the pre-entry wireframe/Draft on every exit route.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-14T12:39:08Z (ledger base)
- **Completed:** 2026-11-14T12:55:20Z
- **Tasks:** 3
- **Files modified:** 13 (11 source/test + 2 RED evidence records)

## Accomplishments

- D-10's eligibility law is one pure predicate: readable anchors keep the shipped vector arm, Brush/Water/Pen with at least two distinct finite samples enter, and Lift plus degenerate strokes are refused with fixed, non-interpolated copy.
- The shipped Edit path button now enables and titles itself for ONE eligible painted stroke, and the same click path arms the durable base, fits, brackets the view and opens path edit — with no document write until a committed gesture.
- The ONE writer seam (`handleAquarelleVectorPathEdit`) admits exactly what the gate offers via `admitsPathEditWrite`, so a conversion the user triggers reaches `commitAquarelleVectorPathEdit`.
- One module-level hook in the dependency-free latches funnels all nine shipped exit routes (and the Studio-open reset) into `endCurveBracket`: the held fit is dropped first, and the pure five-case resolver restores the user's own wireframe/Draft without ever baking on a clean exit.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: eligibility, refusals and gate extension** - `c4b99f597` (test)
2. **Task 1 GREEN: resolve painted-curve eligibility and admit the conversion write** - `30908516f` (feat)
3. **Task 2 RED: painted entry and the widened writer seam** - `e3bf11f36` (test)
4. **Task 1 follow-up: widen the dynamic-module reason type so tsc stays clean** - `80db91e44` (test)
5. **Task 2 GREEN: open curve mode through the shipped entrance** - `78a4e76b5` (feat)
6. **Task 3 RED: the D-06 exit bracket and the ONE exit funnel** - `accdf2b6c` (test)
7. **Task 3 GREEN: funnel every path-edit exit into one bracket teardown** - `c187aa033` (feat)

**Plan metadata:** final docs commit (recorded in the completion report; not part of the measured 7 task commits)

_Note: both TDD tasks have separate RED and GREEN commits; the evidence records embed the JUnit XML each RED run produced._

## Files Created/Modified

- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - Eligibility/refusal law, write-admission predicate, gate painted arm, two optional bundle members.
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - 10 new cases for D-10 plus the dynamic-module typing fix.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - One render-body `curveEntry` read and the painted click branch.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` - 3 cases pinning the leaf branch order and fixed copy.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `readCurveEntry` / `enterPaintedCurve` callbacks, bundle wiring, and the widened handler guard.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - 5 cases pinning the callbacks, ordering and admission predicate.
- `app/src/components/physic-paint/view/vectorPathLatches.ts` - `registerPathEditExitHook` and the transition-only invocation in `exitPathEdit`.
- `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` - Widened `{wireframe, draft}` capture, `resolveCurveExitAction`, `endCurveBracket`.
- `app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts` - 19 cases: 62-01 fit law, widened entry capture, five resolver cases, six teardown cases.
- `app/src/components/physic-paint/view/vectorPathSession.ts` - `resetForStudioOpen` closes through `exitPathEdit`.
- `app/src/components/physic-paint/view/vectorPathSession.test.ts` - 3 funnel cases plus the retargeted import-lines pin.
- `.planning/phases/62-painted-stroke-curve-editing/62-02-t1-RED-evidence.json` - Machine-verified RED evidence.
- `.planning/phases/62-painted-stroke-curve-editing/62-02-t3-RED-evidence.json` - Machine-verified RED evidence.

## Decisions Made

- **Vector arm first:** eligibility checks readable anchors before tool/point checks, and anchors that are present but unreadable fail closed rather than offering an edit the writer would refuse.
- **One verdict, two consumers:** `admitsPathEditWrite` delegates to the eligibility verdict so the gate and the writer seam can never disagree.
- **Entry is arm-then-fit:** `enterPaintedCurve` awaits the shipped `armDraftBase` BEFORE fitting; a refused arm publishes the fixed refusal and leaves no fit or latch behind (fail-closed entry).
- **No fit in the render body:** `readCurveEntry` only classifies; the fit happens on the click, satisfying D-03's lazy-fit law.
- **Dirty exits never bake behind a user-owned view:** the resolver's dirty branch settles once when the user had no wireframe, or restores that wireframe and leaves the deferred pixels untouched (D-14).
- **One exit action owns the selection drop:** `resetForStudioOpen` routes through `exitPathEdit`, so the anchor-selection clear and the hook live in exactly one place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bundle interface members landed in `strokeSettingsModel.ts` (outside Task 2's `<files>`)**
- **Found during:** Task 2 (entry and conversion gate)
- **Issue:** `StrokeSettingsDialogBundle` — the type the dialog consumes — is declared in `strokeSettingsModel.ts`, which Task 2's file list did not name, but the two new optional members (`readCurveEntry`, `enterPaintedCurve`) cannot be added from the Studio/dialog files.
- **Fix:** Added the two optional members to the existing interface and pinned them in the dialog test; no other model change in that task.
- **Files modified:** app/src/components/physic-paint/view/strokeSettingsModel.ts
- **Commit:** `78a4e76b5`

**2. [Rule 3 - Blocking] `vectorPathSession.ts` routed through `exitPathEdit` (outside Task 3's `<files>`)**
- **Found during:** Task 3 (exit funnel)
- **Issue:** The behavior spec requires `resetForStudioOpen` to run the exit hook, but that function lives in `vectorPathSession.ts` while the hook slot and invocation live in the dependency-free latches.
- **Fix:** `resetForStudioOpen` now calls `exitPathEdit()` instead of writing the latch directly; the now-unused `clearVectorAnchorSelection` import was removed and the shipped exact import-lines pin updated. No second selection writer remains.
- **Files modified:** app/src/components/physic-paint/view/vectorPathSession.ts, app/src/components/physic-paint/view/vectorPathSession.test.ts
- **Commit:** `c187aa033`

**3. [Rule 1 - Bug] Test-double type widened so `tsc --noEmit` stays clean**
- **Found during:** Task 1 (eligibility)
- **Issue:** The dynamic-import double typed the planned refusal constants as optional, so `reason` read `string | undefined` while `CurveEntryState.reason` is `string | null` (TS2322 at two assertion sites).
- **Fix:** The test-local shape widens `reason` to `string | null | undefined` with a comment explaining the temporary union; committed separately after the Task 1 GREEN so the RED record stayed intact.
- **Files modified:** app/src/components/physic-paint/view/strokeSettingsModel.test.ts
- **Commit:** `80db91e44`

**4. [Plan-directed rename] 62-01's wireframe-only capture was superseded**
- **Found during:** Task 3 (exit bracket)
- **Issue:** The plan directs extending the capture to `{wireframe, draft}`, which retires `curveWireframeRestore` / `clearCurveWireframeRestore`.
- **Fix:** Replaced with `curveEntrySnapshot` / `clearCurveEntrySnapshot`; the two 62-01 entry tests were retargeted to the widened snapshot while keeping every original assertion (capture-before-latch, no overwrite, no document write).
- **Files modified:** app/src/components/physic-paint/view/vectorPathCurveBracket.ts, app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts
- **Commit:** `c187aa033`

## Known Stubs

None. The production hook registration is intentionally NOT in this plan — 62-04 T2 installs the ONE Studio registration (`registerPathEditExitHook(() => endCurveBracket({ settle: settleDraftScript }))` in a `[settleDraftScript]` effect). That is plan-ordered phase sequencing, not a defect: this plan's goal is the funnel and the bracket, both shipped and pinned.

## TDD Gate Compliance

| Gate | Task | Evidence | Verdict |
|------|------|----------|---------|
| RED | Task 1 | `c4b99f597`, `62-02-t1-RED-evidence.json` | `RED_EVIDENCE_OK` (target test failed; 169 shipped cases green) |
| GREEN | Task 1 | `30908516f` | 179/179 strokeSettingsModel cases pass |
| RED | Task 3 | `accdf2b6c`, `62-02-t3-RED-evidence.json` | `RED_EVIDENCE_OK` (18 failing cases, all behavioural; 22 pass) |
| GREEN | Task 3 | `c187aa033` | 40/40 bracket+session cases pass |

Task 2 is `type="auto"` (no TDD gate required); its tests landed first in `e3bf11f36` and the implementation in `78a4e76b5`.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/vectorPathCurveBracket.test.ts src/components/physic-paint/view/vectorPathSession.test.ts src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` — **690/690 pass**.
- `pnpm --filter efx-motion-editor exec tsc --noEmit` — **clean**.
- Native UAT rows A-D remain for the user (human judgment); row C's restore half becomes observable in-app once 62-04 T2 registers the exit hook.

## Self-Check: PASSED
