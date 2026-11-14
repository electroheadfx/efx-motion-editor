---
phase: 261111-tul-sliderstepper-commit-boundary-milestone-
plan: 01
subsystem: shared UI control (SliderStepper)
tags: [slider-stepper, on-commit, gesture-boundary, pointer-events, tdd, preact]

requires:
  - phase: quick-261105-sk3
    provides: commitOnInput live-commit path and the commitInput shared commit law
  - phase: quick-261024-p5q
    provides: mixed selection display and the bypassed equality guard

provides:
  - "optional onCommit?: (value: number) => void on SliderStepperProps, documented as the gesture release boundary"
  - "typed boundary: blur commits once, Enter commits and suppresses its blur, Escape commits nothing, unparseable entries commit the displayed value"
  - "track boundary: one commit at pointerup/pointercancel carrying lastTrackValue — the gesture's own value, never the stale value prop"
  - "stepper boundary: one commit at press end (hold-repeat included), one on keyboard activation, silence for disabled/preset-end/no-value gestures"
  - "onChange, draft painting, coalescing and rendered output unchanged when onCommit is absent"

affects: [Phase 61 selection-scoped brush controls, any future consumer of a release-boundary value handoff]

actuals:
  tokens: 6241
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Gesture value refs: the release commit carries the value the gesture computed (lastTrackValue / pressValue), never the value prop, so an asynchronous parent re-render cannot corrupt the payload"
    - "Per-gesture dedupe refs: suppressBlurCommit is set by Enter/Escape and consumed once by the blur it triggers; pressValue is read and cleared before the press-end early return, so the second pointerup/pointerleave route finds null"
    - "onChange stays the continuous stream with its equality guard; onCommit is the equal-value-permitting release handoff"

key-files:
  created: []
  modified:
    - app/src/components/shared/SliderStepper.tsx
    - app/src/components/shared/SliderStepper.test.tsx

key-decisions:
  - "The unparseable typed commit reports the displayed/unchanged value because the box reverts — the commit reports what the box now shows"
  - "commitInput still runs twice on Enter-then-blur exactly as shipped; only the onCommit emission is deduped (onChange still fires twice)"
  - "A cancelled track drag or ± press commits the value it reached: the gesture already applied it live through onChange, so the commit only mirrors a real change"
  - "A step that lands on the current value still commits (equal-value law), while onChange keeps its equality guard"
  - "The three new handler-only refs are allocated after draftRef so the pre-quick hook offsets of the render-read refs are preserved (dialog vnode-expansion harness stability)"
  - "No consumer is wired in this quick: it is an optional prop with no UI surface, so it is automated-ready, not a shipped user-facing behaviour"

patterns-established:
  - "One commit per gesture, at the release boundary, with a gesture-owned value ref"
  - "The 261111-tul describe duplicates its own helpers per describe, matching the sibling blocks"

requirements-completed: [QUICK-261111-TUL]

coverage:
  - id: D1
    description: "Typed commit boundary: blur commits once with the parsed value, Enter commits once and its blur is suppressed, a second gesture commits again, Escape commits nothing, and unparseable or equal-value entries still commit the displayed value"
    requirement: "QUICK-261111-TUL"
    verification:
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#a typed blur commits exactly once with the parsed value"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#Enter commits once and its blur adds nothing; a second gesture commits again"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#Escape commits nothing — not even the blur it triggers"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#an unparseable entry commits the displayed value"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#a typed value equal to the prop commits while onChange keeps its equality guard"
        status: pass
    human_judgment: false
  - id: D2
    description: "Track commit boundary: continuous onChange with zero commits while dragging, exactly one commit at pointerup/pointercancel carrying the gesture's last computed value (not the stale prop), equal-value releases commit, and a no-value gesture commits nothing — with commitOnRelease orthogonal"
    requirement: "QUICK-261111-TUL"
    verification:
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#a track drag emits onChange continuously and commits once at release with the gesture value"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#commitOnRelease keeps its draft and commits the same value at release"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#a cancelled drag commits the value it reached; a late release adds nothing"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#an equal-value release commits; a gesture that computed no value does not"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stepper commit boundary: one commit at press end including hold-to-repeat, one on keyboard activation, no double commit from the pointerup/pointerleave pair, and silence for disabled controls, preset-list ends and cancelled presses reporting only the value reached"
    requirement: "QUICK-261111-TUL"
    verification:
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#one ± press commits once at release; the follow-on leave adds nothing"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#keyboard activation commits after its step; a real click does not double"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#hold-to-repeat commits once at release, not on the repeat ticks"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#disabled controls and preset-list ends never commit"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#a cancelled press commits the value it reached"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/SliderStepper.test.tsx#a step that lands on the current value still commits"
        status: pass
    human_judgment: false
  - id: D4
    description: "With onCommit undefined every existing emission, guard, coalescing bracket and rendered output is unchanged: the 32 baseline tests pass untouched and typecheck plus the full suite stay green"
    requirement: "QUICK-261111-TUL"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/shared/SliderStepper.test.ts (47 tests: 32 baseline + 15 new)"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run (425 files, 8895 passed, 1 skipped, 96 todo)"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-11
status: complete
plan_head_before: 8afee1949eb1738527516134c886f15d231a190a
plan_head_after: 1ce179f3c5dd2307a444fbb7af868e849d01fd3c
commits: 3
---

# Quick 261111-tul: SliderStepper Commit Boundary Summary

**SliderStepper now exposes an optional `onCommit` that fires exactly once per gesture at its release boundary — typed blur/Enter, track pointerup/pointercancel, ± press end and keyboard activation — carrying the value the gesture actually reached, while `onChange` stays the unchanged continuous stream.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-11T20:38:56Z
- **Completed:** 2026-11-11T20:44:54Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `SliderStepperProps.onCommit?: (value: number) => void` is documented beside `onChange` with the full boundary law (equal-value commits, Escape/disabled/preset-end/no-value silence, byte-identical behaviour when absent).
- Typed boundary: `commitInput` now returns the committed value (or the displayed `value` when unparseable); blur commits once, Enter commits and marks its blur so the shipped Enter+blur double parse reports one commit, Escape marks its blur and commits nothing, and the marker is consumed per gesture and reset on focus.
- Track boundary: `lastTrackValue` records every computed gesture value in `emitTrackValue` (both the draft and continuous branches), is reset at pointerdown, and is read-and-cleared at pointerup/pointercancel — so the commit carries the gesture's own value, never the stale prop.
- Stepper boundary: `stepBy` returns the reached value (or null at a preset end); `pressValue` captures the initial step and each repeat tick; `handlePressEnd` commits once before its early return, so release/cancel/pointerleave produce one commit, and `handleClick` commits the single keyboard-activation step while ignoring real mouse clicks.
- 15 new tests pin the boundary law in a dedicated `slider-stepper — onCommit gesture boundary (261111-tul)` describe; the 32 baseline tests pass untouched.

## Task Commits

Each task was committed atomically after its RED run and GREEN implementation:

1. **Task 1: Typed commit boundary — prop contract, blur/Enter dedupe, Escape silence** — `21584f408` (feat)
2. **Task 2: Track commit boundary — one commit at release with the gesture's own value** — `e3522df21` (feat)
3. **Task 3: Stepper commit boundary, hold-repeat single commit, and the full gate** — `1ce179f3c` (feat)

**Plan metadata:** orchestrator commit (docs artifacts are left uncommitted for the orchestrator).

## Files Created/Modified

- `app/src/components/shared/SliderStepper.tsx` — the optional `onCommit` prop, `suppressBlurCommit` / `lastTrackValue` / `pressValue` gesture refs, the returning `commitInput` / `stepBy`, and the release-boundary emissions in the typed, track and ± handlers.
- `app/src/components/shared/SliderStepper.test.tsx` — the `261111-tul` describe with 15 tests and its per-describe helper set; no existing `it(...)` block edited.

## TDD Evidence

- Task 1 RED: 4 of the 5 new tests failed on `onCommit` assertions (Escape's silence test is already true by absence); 33 passed. GREEN: 37 passed, typecheck clean.
- Task 2 RED: 4 new tests failed on the missing track emissions; 37 passed. GREEN: 41 passed, typecheck clean.
- Task 3 RED: 5 new tests failed on the missing stepper emissions (disabled silence already true by absence); 42 passed. GREEN: 47 passed, typecheck clean.

## Decisions Made

- An unparseable typed entry commits the displayed/unchanged `value`: the box reverts, so the commit reports what the box now shows.
- Enter+blur still runs `commitInput` twice exactly as shipped — only the `onCommit` emission is deduped, so `onChange` keeps firing on both parses.
- A cancelled drag/press commits the value it reached because `onChange` already applied it live; the commit mirrors a real change rather than inventing one.
- `onCommit` is orthogonal to `commitOnRelease`: `lastTrackValue` is recorded on the same `next` in both branches, so release behaviour is identical with the knob on or off.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] New gesture refs allocated after `draftRef` instead of beside `dragging`**
- **Found during:** Task 3 (full suite gate)
- **Issue:** `strokeSettingsModel.test.ts` expands function components outside a real render with a fixed traversal ref band (`TRAVERSAL_REF_BASE = 1000`). Adding the three new `useRef` calls before `draftRef` shifted `draftRef` onto a foreign harness slot whose `current` was `null`, so the re-expanded `SliderStepper` threw while reading `draft.value` and three Stack-section tests saw no mounted input (`expected undefined to be defined`).
- **Fix:** Kept the pre-quick ref offsets of every render-read ref by allocating `suppressBlurCommit`, `lastTrackValue` and `pressValue` after `draftRef` (they are handler-only state). No hook is conditional and no behaviour changes.
- **Files modified:** `app/src/components/shared/SliderStepper.tsx`
- **Verification:** `strokeSettingsModel.test.ts` 171/171 passes; full suite 8895 passed; targeted suite 47/47; typecheck clean.
- **Committed in:** `1ce179f3c` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, harness-compatibility only)
**Impact on plan:** No behavioural impact; the plan's ref semantics are unchanged, only their allocation order. No existing test was edited or weakened.

## Issues Encountered

- The full-suite gate initially failed on three Stack-section tests in `strokeSettingsModel.test.ts`; diagnosed as the traversal-band collision above and fixed in production ref ordering rather than by touching the pre-existing test harness.

## Scope Check

- `git diff --stat` across the three task commits lists exactly `app/src/components/shared/SliderStepper.tsx` and `app/src/components/shared/SliderStepper.test.tsx`.
- No `SliderStepper.test.ts` file was created; `app/vitest.config.ts`, `SliderStepper.test.tsx.test.ts` and every consumer file are untouched.
- The pre-existing dirty paths (`packages/efx-watercolor/probe/vector-spine/result.json`, untracked `.red-evidence/**`) were never staged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The prop is ready for the Phase 61 selection-scoped brush control: its consumer can adopt the value at release without parsing the continuous `onChange` stream.
- No user-visible surface changes in this quick — it is **automated-ready**, not a shipped user-facing behaviour; no native UAT row applies.

---
*Phase: 261111-tul-sliderstepper-commit-boundary-milestone-*
*Completed: 2026-11-11*

## Self-Check: PASSED

- Both modified files exist on disk.
- Commits `21584f408`, `e3522df21` and `1ce179f3c` are ancestors of HEAD.
- SUMMARY written at `.planning/quick/261111-tul-sliderstepper-commit-boundary-milestone-/261111-tul-SUMMARY.md`.
