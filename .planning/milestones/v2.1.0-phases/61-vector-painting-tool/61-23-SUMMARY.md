---
phase: 61-vector-painting-tool
plan: 23
subsystem: ui
tags: [preact-signals, eyedropper, vector-path-edit, session-state, alt-modifier]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-17's dependency-free latch leaf and the picker's one-way import edge (T-61-60)"
  - phase: 61-vector-painting-tool
    provides: "61-08's path-edit session (`enterPathEdit` disarms the picker; the overlay reads `event.altKey`)"
provides:
  - "`aquarellePickerActive` gated by `pathEditMutationId === null` — the visor, rail chip and brush-ring gate all stop at an open edit"
  - "`isAquarellePickerArmed()` rewritten as a fresh direct `.peek()` predicate over the three signals"
  - "`setAquarellePickerAltHeld(true)` refused while an edit is open, write-free; a release always lands"
affects: [61-25, 61-28, 61-29]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 2389
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Context-ambiguous modifier: one computed verdict masks a surface for the lifetime of an owning edit, and the setter refuses only the arming write"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/aquarelleColorPicker.ts
    - app/src/components/physic-paint/view/aquarelleColorPicker.test.ts

key-decisions:
  - "The guard lives in the ONE computed verdict, not in each consumer — the visor, the rail chip and the brush-ring gate need no change"
  - "`isAquarellePickerArmed` reads the three signals directly instead of a computed `.peek()`, so a dispatch-time probe is never stale (T-61-71)"
  - "Task 2's release pin asserts both branches: a stale direct Alt still clears on release, and an already-false release is the shipped compare-then-write no-op"
  - "Task 2 landed four new tests (45 total) rather than three, because the shipped 61-17 directions are re-pinned as their own case; the plan's 44 floor is a minimum"

patterns-established:
  - "Edit-lifetime masking: `(signalA || signalB) && ownerLatch === null` on the single verdict every consumer reads"
  - "Arming-only setter refusal: compare-then-write first, then `next && ownerOpen -> return`, so a release is never swallowed"

requirements-completed: [VEC-02]

coverage:
  - id: D1
    description: "The picker's one armed verdict (and therefore the Pipette visor, the rail chip and the brush-ring gate) is false for the whole lifetime of an open vector path edit, whichever picker signal is set."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-23 G-19 the open path edit outranks the picker > routes both the visor gate and the pick seam to false while Alt is held during an edit"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-23 G-19 the open path edit outranks the picker > is not Alt-specific — a latched pick is likewise false during an edit"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-23 G-19 the open path edit outranks the picker > reads the edit lifetime, never a one-shot latch — the verdict returns true when the edit closes"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#the picker module keeps its one-way edge (T-61-60) > imports only the signals runtime and the dependency-free latch leaf"
        status: pass
    human_judgment: false
  - id: D2
    description: "An Alt keystroke inside an open path edit writes no picker session state and notifies no subscriber; a release still lands, and a fresh Alt after the edit arms the picker exactly as before."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-23 G-19 the open path edit outranks the picker > an Alt keydown during an edit writes nothing and notifies no subscriber"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-23 G-19 the open path edit outranks the picker > never swallows a release — a stale Alt still clears, an already-false release is the compare-then-write no-op"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-23 G-19 the open path edit outranks the picker > arms again after the edit closes with one real write"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-23 G-19 the open path edit outranks the picker > re-pins both shipped 61-17 directions around the guard"
        status: pass
    human_judgment: false
  - id: D3
    description: "Native UAT: with a vector path edit open, holding Alt and dragging a handle breaks the tangent and the Pipette visor never appears over the canvas while the rail's Picker chip stays unlit; after the edit, holding Alt picks as before."
    requirement: VEC-02
    verification: []
    human_judgment: true
    rationale: "The guard is unit-proven, but 'the visor never appears over the canvas' and 'the rail chip does not light' are live WKWebView visuals in the Studio window; vitest renders no DOM and the user runs the app."

duration: 3 min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 23: Hide the color picker during a vector path edit Summary

**The picker's one armed verdict now stops at an open vector path edit, and an Alt keydown inside the edit writes nothing — so breaking a tangent can never resurface the Pipette visor**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-11T10:58:14Z
- **Completed:** 2026-11-11T11:01:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `aquarellePickerActive` gains `pathEditMutationId` as a source: `(latched || altHeld) && pathEditMutationId === null`. The visor, the rail chip and the brush-ring gate all read this one computed and needed no edits (G-19).
- `isAquarellePickerArmed()` is now a direct `.peek()` predicate over the same three signals, so the Studio's dispatch-time pick seam cannot arm on a stale computed value (T-61-71).
- `setAquarellePickerAltHeld(true)` refuses the arming write while an edit is open and notifies nothing; `next === false` still writes, so a release is never swallowed and no hold leaks past the edit.
- 61-17's entry-edge law is untouched and re-pinned: `enterPathEdit` still disarms the picker, and latching the picker still closes the open edit.
- The T-61-60 import pin was extended (never weakened): the module still has exactly two imports, the second still the dependency-free latch leaf, now carrying `pathEditMutationId`.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing tests for the picker verdict during a path edit** - `8e5668350` (test)
2. **Task 1 GREEN: stop the picker verdict at an open path edit** - `5c61c644d` (feat)
3. **Task 2 RED: failing tests for the Alt keydown during a path edit** - `bd0e8de98` (test)
4. **Task 2 GREEN: refuse an Alt arming write during an open path edit** - `1d8447ece` (feat)

**Plan metadata:** see the final `docs(61-23): complete ...` commit on this branch.

_Note: TDD plans produce RED then GREEN commits per task; no REFACTOR commit was needed._

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | `8e5668350` | `5c61c644d` | — | Pass |
| 2 | `bd0e8de98` | `1d8447ece` | — | Pass |

RED evidence (JUnit report + record) is under
`.planning/phases/61-vector-painting-tool/.red-evidence/61-23-t1/` and `61-23-t2/`;
both records returned `RED_EVIDENCE_OK` from `gsd_run check tdd-red-evidence`.

- Task 1 RED: 41 tests collected, 4 failed — the three new G-19 cases plus the extended
  import pin. The target failed on the planned assertion (verdict stayed true during an
  open edit); all 37 shipped tests passed in the same run.
- Task 2 RED: 45 tests collected, 2 failed — the Alt arming write and the post-edit
  arming case (whose first write is also refused). The two guard pins (release never
  swallowed; the two shipped 61-17 directions) passed at HEAD by design.

## Files Created/Modified
- `app/src/components/physic-paint/view/aquarelleColorPicker.ts` — the edit-lifetime gate on the one computed, the direct armed predicate, and the arming-only Alt setter guard; module comment records the two Alt meanings and the unchanged 61-17 entry edge.
- `app/src/components/physic-paint/view/aquarelleColorPicker.test.ts` — a new `61-23 G-19` describe (7 tests) and the extended T-61-60 exact-import pin.

## Decisions Made
- **Guard in the verdict, not the consumers.** `AquarellePickerVisor`, `PhysicsPaintToolRail` and `AquarelleCanvasLayer` already read `aquarellePickerActive`; adding per-consumer gates would have multiplied the same predicate.
- **Direct predicate over the three signals.** `isAquarellePickerArmed` no longer peeks the computed, because an unread computed stays dirty after a source write and the pick seam must be fresh at dispatch.
- **Release semantics pinned both ways.** Task 2's release test asserts that a stale direct Alt write still clears on `setAquarellePickerAltHeld(false)` and that an already-false release is the shipped compare-then-write no-op — matching the plan's action ("a legitimate release is never swallowed") and acceptance criteria.
- **Task 2 landed four tests, not three.** The two shipped 61-17 directions are re-pinned as their own case (behaviour test 4). The plan's 44-test floor is a minimum; the file ends at 45.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated gates: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleColorPicker.test.ts` → 45/45 pass; sibling session/selection suites → 97/97 pass; `tsc --noEmit` → exit 0.
- **Native UAT row (user-judged, pending):** open Edit path on one vector stroke, hold Alt and drag a handle — the tangent breaks, the Pipette visor never appears over the canvas, and the rail's Picker chip does not light. Release Alt, finish the edit, then hold Alt on the canvas: the pipette appears and picks as before.
- Out of this plan's scope (unchanged, still deferred): the rail's Picker `disabled` vs `disarmed` state under wireframe (61-25), width discoverability (61-22), the path-edit drag lifecycle (61-28), and every paint re-bake concern (61-29).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- `app/src/components/physic-paint/view/aquarelleColorPicker.ts` — FOUND
- `app/src/components/physic-paint/view/aquarelleColorPicker.test.ts` — FOUND
- Commit `8e5668350` — FOUND (ancestor of HEAD)
- Commit `5c61c644d` — FOUND (ancestor of HEAD)
- Commit `bd0e8de98` — FOUND (ancestor of HEAD)
- Commit `1d8447ece` — FOUND (ancestor of HEAD)
