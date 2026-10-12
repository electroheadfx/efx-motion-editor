---
phase: quick-260924-ffd
plan: 260924-ffd
subsystem: ui
tags: [preact, signals, numeric-stepper, fps, presets, tdd, source-scan, two-tier-isolation]

# Dependency graph
requires:
  - phase: quick-260924-d6l
    provides: "Constraint-injection contract (classic default, resolveStep/freeEntry scoped to paper grain) — preserved verbatim, extended here"
provides:
  - "Three-tier NumericStepper contract: classic default (±1 integer), first-class presets mode, explicit decimal opt-in"
  - "FPS_PRESETS [6,12,15,24,25,50,60] single-sourced by Settings, New Project and Studio strip"
  - "Two-tier fps isolation source-scan pins (playback chain vs projectStore)"
  - "RED-first contract pins superseding D-24 (fps step 0.5 → OBSOLETE)"
affects: [fps-surfaces, numeric-fields, paper-grain, studio-playback]

# Actuals (#2632)
actuals:
  tokens: 11567
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: [preset-mode-numeric-field, source-scan-tier-isolation, red-first-contract-pins]

key-files:
  created:
    - app/src/lib/fpsPresets.ts
  modified:
    - app/src/components/shared/NumericStepper.tsx
    - app/src/components/shared/NumericInput.tsx
    - app/src/components/shared/NumericStepper.test.tsx
    - app/src/components/views/SettingsView.tsx
    - app/src/components/project/NewProjectDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/project/NewProjectDialog.test.tsx

key-decisions:
  - "Presets mode takes precedence over step/min/max: the ascending list is the sole bound; call sites still declare min/max equal to the list ends (6/60) as documentation"
  - "End-of-list protection is double-layered: handlePressStart/handleClick refuse at-end presses (button already visibly disabled) AND stepBy runs press-end cleanup mid-hold so module-global coalescing can never strand (Pitfall 1)"
  - "Ascending order of FPS_PRESETS is part of the contract (direction-of-travel snap and end detection rely on it)"
  - "Unit pins walk a literal [6,12,15,24,25,50,60] list, glued to FPS_PRESETS by an equality pin — a change to either side fails the suite"
  - "Commit path never emits a no-op (T-52.2-08 preserved): the Pin 3 ties-low case renders from 25 so '24.5'→24 actually emits"

patterns-established:
  - "Preset mode: next/previous entry walk, disabled ends at render + handler refusal, nearest-ties-low typed snap, integer display forced"
  - "Two-tier fps law proven by source scan: playback chain carries no project-store reference; no setFps caller under physic-paint"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Shared NumericStepper three-tier contract: classic default ±1 integer, presets walk with disabled ends + nearest-ties-low typed snap + direction-of-travel snap, explicit decimal steps unchanged"
    verification:
      - kind: unit
        ref: "app/src/components/shared/NumericStepper.test.tsx — 260924-ffd pins 1/2/3/6 + hold-end coalescing (32/32 green)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts (16/16 green — grain d6l pins preserved)"
        status: pass
    human_judgment: false
  - id: D2
    description: "FPS_PRESETS single-sources all three fps surfaces under the two-tier law (PROJECT = projectStore, STUDIO = playback hook, never cross-writing); sweep grew 6→8; D-24 fps 0.5 shape removed"
    verification:
      - kind: unit
        ref: "app/src/components/shared/NumericStepper.test.tsx — Pins 4/5 + numericStepperSweep (8-path list) + FPS_PRESETS equality pin"
        status: pass
      - kind: unit
        ref: "SettingsView.test.tsx.test.ts (5/5), NewProjectDialog.test.tsx.test.ts (8/8), PhysicsPaintWorkflowStrip.test.ts (142/142)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Native 8-row UAT: visible disabled ends, two-tier isolation live, Settings/New Project preset steppers, classic integer field, Scale/grain unchanged, export cadence = PROJECT fps, hold-end undo isolation, garbage revert"
    verification: []
    human_judgment: true
    rationale: "Live UI behavior (visible disabled buttons, hold gestures, export cadence, undo interaction) runs in the native app with no DOM/Tauri harness — vitest is blind to it (project precedent: live evidence over unit probes). Automated gates are green; the user runs the 8 rows."

# Metrics
duration: 21min
completed: 2026-09-24
status: complete
plan_head_before: a3ac0ce9cc1dcd1d7110517a4b8c45d283f6e392
commits: 2
---

# Phase quick-260924-ffd: Numeric Stepper Contract (integer ±1 default + fps presets) Summary

**Three-tier NumericStepper contract shipped — classic default emits exactly ±1 integers, fps walks a first-class FPS_PRESETS menu with visibly disabled ends and nearest-ties-low typed snap, all three fps surfaces single-sourced under the two-tier isolation law; D-24 fps 0.5 OBSOLETE**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-24T09:42:32Z
- **Completed:** 2026-09-24T10:02:25Z
- **Tasks:** 3
- **Files modified:** 8

**Automated gates green; native UAT pending user** (8 rows below).

## Accomplishments

- RED-first contract pins committed before any production edit; RED-EVIDENCE.json records 7 failed | 40 passed (47) with each failing pin naming its locus (verdict RED_EVIDENCE_OK) — the D-24 pins were rewritten/removed, never kept green
- `step` optional (default 1) and `presets?: readonly number[]` implemented in NumericStepper + NumericInput (preset drag-scrub by entry, classic arithmetic guarded against NaN)
- FPS_PRESETS [6,12,15,24,25,50,60] in `app/src/lib/fpsPresets.ts` converts Settings, New Project and the Studio strip; inline [15,24] / setFps(15|24) pills and `step={0.5}` are gone
- Two-tier isolation proven by source scan: playback chain (strip + useRotoCachedPlayback) has no project-store reference; no setFps caller anywhere under physic-paint
- Full suite green (228 files, 4268 tests passed) + typecheck clean; grain d6l pins and T-52.2-08 clamp/hold/coalesce preserved verbatim

## Task Commits

Each task was committed atomically (code only — docs artifacts left for the orchestrator commit):

1. **Task 1: RED — rewrite D-24 pins, add new-contract pins** - `9b4bdec9` (test)
2. **Task 2: GREEN — preset mode + classic default, FPS_PRESETS, three call sites** - `fa0a2623` (feat)
3. **Task 3: Full-suite regression sweep** - no commit needed (suite green on first run, zero additional edits)

**Plan metadata:** docs commit handled by orchestrator (constraint: SUMMARY/STATE/PLAN/CONTEXT/RESEARCH/RED-EVIDENCE not committed by executor)

## Files Created/Modified

- `app/src/lib/fpsPresets.ts` - NEW: the single FPS_PRESETS list (ascending, contract)
- `app/src/components/shared/NumericStepper.tsx` - three-tier contract: optional step (default 1), presets branch in stepBy/commit/format, disabled ends at render + handler refusal, mid-hold at-end cleanup inside stepBy, header docs mark D-24 obsolete
- `app/src/components/shared/NumericInput.tsx` - presets passthrough; label scrub walks one entry per 4px clamped at ends; classic formula defaults step to 1 (never NaN)
- `app/src/components/views/SettingsView.tsx` - Frame Rate row → preset stepper on projectStore.fps/setFps (PROJECT tier)
- `app/src/components/project/NewProjectDialog.tsx` - fps pills → preset stepper on the existing local useState(24) seed → createProject
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - fps field → presets + min/max 6/60, `step={0.5}` removed (STUDIO tier untouched)
- `app/src/components/shared/NumericStepper.test.tsx` - pins 1-6, hold-end coalescing pin, FPS_PRESETS equality pin, sweep 6→8, D-24 tests rewritten
- `app/src/components/project/NewProjectDialog.test.tsx` - **additionally edited (plan-sanctioned):** W×H stepper assertions scoped by aria-label (Frame Rate stepper joined the dialog as a third NumericStepper)

## Decisions Made

- Presets mode ignores step/min/max arithmetic — the list is the sole bound (strip still declares min/max = list ends as documentation per plan)
- Double-layered end protection (handler refusal + stepBy cleanup) so coalescing cannot strand whether the press starts at the end or a hold runs into it
- Pin 3 ties-low case renders from 25 (not 24) because the commit path correctly skips no-op emissions — the snap result 24 still proves the tie resolves down
- Guard half of Pin 4 (playback chain / setFps source scans) is green at birth by design — regression guards over existing isolation, not red-by-default; the Settings/New Project binding halves were red as planned

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Source-scan pins tripped on their own comment literals**
- **Found during:** Task 2 (GREEN cutover, first verify run)
- **Issue:** New explanatory comments contained the exact strings the pins forbid (`projectStore` in the strip comment, `projectStore.setFps` in the NPD comment, `[15, 24]` in the Settings comment) — the pins are literal source scans
- **Fix:** Reworded the three comments to describe the tiers without reproducing the forbidden literals; behavior unchanged
- **Files modified:** PhysicsPaintWorkflowStrip.tsx, SettingsView.tsx, NewProjectDialog.tsx
- **Verification:** Pins 4a/4c/4d green in the same suite run
- **Committed in:** fa0a2623 (part of Task 2 commit)

**2. [Rule 1 - Bug] Pin 3 "24.5" case rendered from the expected result**
- **Found during:** Task 2 (GREEN cutover)
- **Issue:** Rendering at value 24 and committing 24 is a no-op — the commit path (correctly, T-52.2-08) skips onChange, so the pin could never observe the snap
- **Fix:** Case table now carries the render value; "24.5" renders from 25 and must emit 24 — still proves nearest-ties-low, no assertion weakened
- **Files modified:** NumericStepper.test.tsx
- **Verification:** Pin 3 green; all other pins unchanged
- **Committed in:** fa0a2623 (part of Task 2 commit)

**3. [Rule 3 - Blocking] Strip imported fpsPresets with the wrong relative depth**
- **Found during:** Task 2 (typecheck)
- **Issue:** `../../lib/fpsPresets` from `components/physic-paint/view/` resolves outside src → TS2307
- **Fix:** `../../../lib/fpsPresets`
- **Files modified:** PhysicsPaintWorkflowStrip.tsx
- **Verification:** typecheck exit 0
- **Committed in:** fa0a2623 (part of Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All three were necessary for the pins/typecheck to be honest; no scope creep, no weakened assertions, no package installs, no server starts.

## Issues Encountered

- Plan's expected-red list said "isolation" as a whole; in execution only the Settings/New Project binding pins were red (the physic-paint chain guards were green at birth — they pin isolation that already existed). Recorded honestly in RED-EVIDENCE.json; no red was manufactured.
- Nothing else: full suite passed on first Task 3 run; no other suite asserted the old button-row / step-0.5 shapes.

## User Setup Required

None - no external service configuration required.

## Native UAT — 8 rows (USER runs after GREEN; app is ready, no server started by executor)

1. Preset stepping stops at ends — Studio strip fps at 60: + visibly disabled, no-op; at 6: − visibly disabled; from 24: + → 25 → 50, − → 15 → 12; never 24.5/30/decimals.
2. Two-tier isolation — change Studio playback fps, Settings fps unchanged (and vice versa).
3. Settings Frame Rate = preset stepper over the 7 values bound to project fps; New Project dialog = same stepper with 24 pre-selected (locked decision), seeds the project.
4. Classic integer field (no constraints) steps 1, 2, 3 with integer display.
5. Sidebar Scale 0.01 unchanged (±0.01, decimal display) and paper grain rows unchanged (260923-bcm: bands 1.0→1.5, typed "2,2" → 2.2, free entry in bounds).
6. Export cadence follows PROJECT fps, not Studio preview fps.
7. Hold a preset + button across the end, release, then perform an unrelated edit — undo must not swallow it (coalescing never stranded; hold collapses to one undo entry).
8. Garbage typed commit ("abc") on a classic field reverts to the pre-edit value; usable off-step numeric input still snaps (T-52.2-08).

## Next Phase Readiness

- Automated-ready: full vitest suite + typecheck green, all contract pins passing, RED-EVIDENCE.json on disk (uncommitted, orchestrator owns docs commit)
- Blocker to close: the 8 native UAT rows above — quick stays open until live UAT passes

## Self-Check: PASSED

- All 8 modified/created code files exist on disk (fpsPresets.ts, NumericStepper.tsx, NumericInput.tsx, NumericStepper.test.tsx, SettingsView.tsx, NewProjectDialog.tsx, PhysicsPaintWorkflowStrip.tsx, NewProjectDialog.test.tsx)
- RED-EVIDENCE.json and SUMMARY.md present in the quick directory (uncommitted by design — orchestrator owns the docs commit)
- Commits FOUND in history: `9b4bdec9` (Task 1 RED), `fa0a2623` (Task 2 GREEN); Task 3 required no commit (suite green, zero additional edits)
- Measured from ledger `plan_head_before: a3ac0ce9` → `commits: 2` matches frontmatter
