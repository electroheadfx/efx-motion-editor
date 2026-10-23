---
phase: quick-261023-bji
plan: 261023-bji
subsystem: ui
tags: [preact, signals, physic-paint, studio, timeline, solo, css]

# Dependency graph
requires:
  - phase: quick-261022-iff
    provides: session-only global Solo arm (physicsPaintSoloArm.ts) read by the strip
  - phase: 47-01
    provides: presentational PhysicsPaintTrackRow + the hidden-track fade law
provides:
  - Non-target Paint rows wear the disabled-track fade while the session Solo is armed
  - One shared CSS rule for the hidden-track and solo-dimmed fades
affects: [physic-paint-studio, timeline-presentation]

actuals:
  tokens: 2403
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Presentation-only boolean prop fed from an existing subscribing read (no new signal/effect)"
    - "Shared CSS selector for two semantically distinct fade states"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx

key-decisions:
  - "soloDimmed is a presentational prop only: the strip passes its existing isSoloArmed() value, so no new signal, effect, state, or store call is introduced."
  - "The Background row never receives the prop — a Paint solo leaves the Background participating (backgroundParticipates ignores the solo target)."
  - "The solo fade shares ONE CSS rule with the hidden-track fade so the two treatments cannot drift."

patterns-established:
  - "Solo focus cue: non-target rows reuse the exact disabled-track fade (opacity 0.4 + grayscale 0.9)."

requirements-completed: [BJI-01, BJI-02, BJI-03]

coverage:
  - id: D1
    description: "Non-target Paint rows carry physics-paint-track-row-solo-dimmed while the session Solo is armed, and clear it on disarm; the active lane and the Background row never carry it."
    requirement: BJI-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts#dims every non-target Paint row with the disabled-track fade while Solo is armed (261023-bji)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The solo-dimmed class resolves to literally the hidden-track fade pair (opacity 0.4 + grayscale 0.9) through one shared CSS rule, and the row class is gated by the prop."
    requirement: BJI-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#PhysicsPaintTrackRow — 261023-bji solo focus dimming"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live Studio read: arm Solo on track B → track A fades exactly like a hidden track while B and Bg stay bright; selecting A moves the bright row; disarm restores every row; hide/show parity; single-track document never dims."
    requirement: BJI-03
    verification: []
    human_judgment: true
    rationale: "Visual judgment of a presentation-only fade in the live Studio; automation pins classes/CSS but cannot judge whether the grey reads correctly at a glance."

# Metrics
duration: 2min
completed: 2026-10-23
status: complete
commits: 1
plan_head_before: ad2a44a338248e7ccf5acad4746c540a9ff81597
plan_head_after: d10a2ed43477d06423e2d9c0e0b1e8071a03596d
---

# Quick 261023-bji: Solo focus dimming in the Studio timeline Summary

**Non-target Paint rows now wear the exact hidden-track fade (opacity 0.4 + grayscale 0.9) while the session Solo is armed, driven by the strip's existing isSoloArmed() read with no new signal or effect.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-10-23T06:23:44Z
- **Completed:** 2026-10-23T06:25:34Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- `PhysicsPaintTrackRow` gained a presentational `soloDimmed` prop (optional, defaults false); the row stays a hook-free leaf.
- The strip passes `soloDimmed={soloArmed}` to every non-active row instance only — the active lane (the Solo target) and the Background row are untouched.
- The solo fade and the hidden-track fade share one grouped CSS rule, so the treatments can never drift.
- Pins added: strip-level arm/dim/disarm behavior (including cell retention and Bg brightness) and row-level class + CSS parity.

## Task Commits

1. **Task 1: Dim every non-target Paint row while the session Solo is armed** - `d10a2ed4` (feat)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — new `soloDimmed` prop, destructuring default, `rowClass` entry.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — passes the existing `soloArmed` read to non-active rows only.
- `app/src/components/physic-paint/physicsPaintStudio.css` — grouped `.physics-paint-track-row-hidden, .physics-paint-track-row-solo-dimmed` rule.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` — arm/disarm strip pin + `afterEach(disarmSolo)` isolation.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` — row class gate + CSS fade parity pins.

## Decisions Made
- Presentation-only prop fed from the existing `isSoloArmed()` subscription: no new signal, effect, state, store call, document write, or cache-key term.
- The Background row is deliberately excluded because a Paint solo leaves it participating.
- The pinned header column is unchanged (parity with the hidden-track behavior, whose header does not dim).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `PhysicsPaintWorkflowStrip.viewport.test.ts` has a **pre-existing** stale assertion at lines 842/864 expecting a `physics-paint-track-row-solo` header chip that was retired in commit `a76ded93` (261022-iff). It fails on the pristine tree and is unrelated to this change; per the scope boundary it was **not** fixed. It is the only red test in the targeted files (72 passed, 1 pre-existing failed). New tests pass. Recommendation: delete the two stale assertions in a follow-up quick.

## Deferred Issues
- Remove/update the retired row-S-chip assertions in `PhysicsPaintWorkflowStrip.viewport.test.ts` (lines 842 and 864) — pre-existing, out of scope for 261023-bji.

## Verification Evidence
- `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts` → 72 passed, 1 pre-existing failure (see above); both new suites green.
- `pnpm --dir app typecheck` → 15 errors before and after (no new errors; baseline `/tmp/bji-typecheck-baseline.txt`).
- `grep -q "physics-paint-track-row-solo-dimmed" app/src/components/physic-paint/physicsPaintStudio.css` → present.

## Live UAT — APPROVED (2026-10-23)

User-run, the only completion signal. All rows passed live:

1. Two Paint tracks, Solo armed on B: A fades to the same grey as a hidden track; B and the Bg row stay bright.
2. With Solo armed, clicking track A moves the bright row to A and fades B; the pill stays armed.
3. Disarm restores every row immediately, no flicker or leftover grey.
4. Hide/show a non-target track while armed: same grey in both states, no double-fade.
5. Single-track document: nothing dims.

## Next Phase Readiness
- Live UAT passed 2026-10-23; the feature is closed.
- No document/persistence/compositor/monitor changes, so no regression surface outside the Studio presentation.

---
*Quick: quick-261023-bji*
*Completed: 2026-10-23*

## Self-Check: PASSED

- SUMMARY.md present at `.planning/quick/261023-bji-feat-when-i-solo-track-in-studio-i-want-/261023-bji-SUMMARY.md`
- All 5 modified source/test files present
- Task commit `d10a2ed4` is an ancestor of HEAD
- Ledger-measured commits: 1 (`ad2a44a3..d10a2ed4`)
