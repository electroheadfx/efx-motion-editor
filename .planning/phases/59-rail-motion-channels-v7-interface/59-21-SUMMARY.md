---
phase: 59-rail-motion-channels-v7-interface
plan: 21
subsystem: ui
tags:
  - preact
  - motion-channels
  - inspector
  - projection
  - accessibility
  - gap-closure
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-16
    provides: projectRailMotionInspector five-field projection and the panel's props-driven Motion value section
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-17
    provides: addMotionChannel keyless add-channel command whose refusal path this disabled state mirrors
provides:
  - present flag on RailMotionInspectorField derived from record.channels
  - Disabled, aria-disabled absent-channel fields described by the section note
  - '"not added" label marker for absent channels'
  - onChange commit guard that makes the zero-commit law hold under direct invocation
affects:
  - 59 phase verification and live UAT
  - Any later inspector surface that must distinguish present from keyed channels

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 4301
  tasks: 2
  commits: 3
plan_head_before: 600d146ef4e6f9eff2747153c0060145b15f1d7b
plan_head_after: 9e67f60ccff18ed9c97f6b9eb2bbfb39821b1c21

# Tech tracking
tech-stack:
  added: []
  patterns:
  - Presence flag derived from the same record lookup the value read uses — never a second predicate
  - One section-level note referenced by every absent field through ariaDescribedBy
  - Guarded onChange that keeps the zero-commit law even under direct callback invocation

key-files:
  created: []
  modified:
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts

key-decisions:
  - "`present` means channel EXISTENCE on record.channels, never key presence at the read frame — a channel keyed elsewhere still counts as present."
  - "The absent channel keeps being projected with its identity value and unit, so the user sees what an add would seed; only the affordance changes."
  - "The panel owns the refusal copy (MOTION_ABSENT_CHANNEL_SENTENCE / MOTION_ABSENT_CHANNEL_NOTE_ID); the projection stays copy-free."
  - "One section-level note carries the sentence and every absent field points at it via ariaDescribedBy; never one note per field."
  - "onChange returns before commitMotionValue when the field is absent, so the zero-commit law holds even when a caller invokes the callback directly."

patterns-established:
  - "Availability in a projection: a required boolean flag travels with each projected value so the view can disable without re-deriving state."
  - "Shared aria description: one note id per section, referenced by every disabled field."

requirements-completed:
  - MUI-06

coverage:
  - id: D1
    description: "Every projected Motion field states whether its channel exists on the record, in the fixed five-field D-13 order, without changing any projected value or the null contract"
    requirement: MUI-06
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts#projectRailMotionInspector channel presence (59-21: absent channels are marked)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts#projectRailMotionInspector (59-16: Motion value inspector)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Absent channels render disabled, aria-disabled, described by the exact command-layer sentence and marked 'not added', while present fields keep their value, order and commit behaviour; an absent field can never reach the commit callback"
    requirement: MUI-06
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#renders an absent channel disabled, aria-disabled and described by the exact command-layer sentence"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#never commits an absent channel, even when its onChange is invoked directly"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#renders exactly one absent-channel note per section, and none when every channel is present"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#marks absent labels `not added` and leaves present labels unmarked"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 21: Absent Motion channels are visibly not editable Summary

**Every projected Motion field now states whether its channel exists, and a channel the rail does not carry renders disabled, aria-disabled, described by the command layer's own refusal sentence and marked `not added` — it can never reach the commit callback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-06T20:54:02Z
- **Completed:** 2026-11-06T20:57:22Z
- **Tasks:** 2
- **Files modified:** 4 (+ 2 RED-evidence artifacts)

## Accomplishments

- `RailMotionInspectorField` carries `present`, computed from the existing `record.channels` lookup — never from `hasKeyAtSelection` or the selected key.
- A partially present record marks exactly the channels it carries; a fully present record marks all five; a channel with no key at the read frame stays present.
- Absent channels render `disabled` + `aria-disabled`, are described by the section note whose text is exactly `This Motion channel is not present on the rail.`, and carry a visible `not added` marker.
- The absent field's `onChange` returns before `commitMotionValue`, so `onCommitRailMotionValue` is called zero times even under direct invocation; present fields keep their projected value, step, precision, remount key and commit behaviour.
- The note renders exactly once per section when at least one field is absent and is absent from the tree when every channel is present; the rejection paragraph and remount key are unchanged.
- The panel stayed props-only: no store import, no `useState`, no new effect.

## Task Commits

Each task was committed atomically (Task 1 is TDD: RED then GREEN):

1. **Task 1 (RED): add failing channel-presence rows** - `4186c19c8` (test)
2. **Task 1 (GREEN): state each Motion channel's presence in the projection** - `46cdb148f` (feat)
3. **Task 2: render absent Motion channels as visibly non-editable** - `9e67f60cc` (feat)

**Plan metadata:** (docs: complete plan — this commit)

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` - `present` member on `RailMotionInspectorField`, derived from the per-channel record lookup.
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts` - presence rows (partially present, fully present, present-but-unkeyed).
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` - absent-channel constants, disabled/aria-disabled/described stepper props, `not added` marker, single section note and the onChange commit guard.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` - `present` fixtures plus the disabled-field, marker, zero-commit and note-count rows.

## Decisions Made

- `present` is channel existence only; the flag never consults the read frame, so a rail carrying a channel whose keys sit elsewhere still reports it present.
- Absent channels keep their projected identity value and unit — the inspector shows what an add would seed and only the affordance changes.
- The panel owns the refusal copy and the note id; the projection module stays copy-free.
- One section-level note is shared by every absent field via `ariaDescribedBy`; never one note per field.
- The `onChange` guard sits inside the field callback, so the zero-commit law survives a direct invocation even though the disabled stepper already refuses pointer input.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## TDD Gate Compliance

- RED: `4186c19c8` — `test(59-21): add failing channel-presence rows to the Motion inspector projection`. The three new target tests failed on the planned assertion (`present` was `undefined`); the 19 pre-existing projection tests stayed green; the classifier returned `RED_EVIDENCE_OK`
  (`.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-21-task1.json`).
- GREEN: `46cdb148f` — `feat(59-21): state each Motion channel's presence in the inspector projection`. The same file then reported 22/22 passing.
- REFACTOR: not needed.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` — exit 0, 2 files, 95 tests passed.
- `pnpm --filter efx-motion-editor run typecheck` — exit 0.
- `grep -c "present" app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` — 3 (>= 2).
- `grep -c "This Motion channel is not present on the rail." app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — 1.
- `grep -c "physicPaintStore" app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G1's IN-02 half is closed: the inspector can no longer offer a write the command layer is guaranteed to refuse.
- Live UAT rows remain the human evidence path for this surface; nothing in this plan blocks the remaining wave-2 plans (59-19, 59-20).

## Self-Check: PASSED

- All four modified files exist on disk.
- Commits `4186c19c8`, `46cdb148f`, `9e67f60cc` are ancestors of HEAD (`9e67f60ccff18ed9c97f6b9eb2bbfb39821b1c21`).
- RED evidence record and its JUnit report are present and classified `RED_EVIDENCE_OK`.

---
*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*
