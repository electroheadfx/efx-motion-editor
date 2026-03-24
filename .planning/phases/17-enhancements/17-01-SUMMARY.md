---
phase: 17-enhancements
plan: 01
subsystem: ui
tags: [preact, tailwind-v4, sidebar, sequence, collapse]

# Dependency graph
requires:
  - phase: 15-audio-import-waveform
    provides: SequenceItem component with maxHeight key photo expand/collapse
provides:
  - Collapsible key photo lists in sidebar SequenceItem (toggle on second click)
  - All Tailwind v4 [var(--...)] patterns migrated to parenthetical (--...) syntax across 33 files
affects: [17-02, 17-03, 17-04, all-components]

# Tech tracking
tech-stack:
  added: []
  patterns: [key-photo-collapse-toggle-via-useState, tailwind-v4-parenthetical-css-vars]

key-files:
  created: []
  modified:
    - Application/src/components/sequence/SequenceList.tsx
    - Application/src/components/layout/TimelinePanel.tsx
    - Application/src/components/sidebar/SidebarFxProperties.tsx
    - Application/src/components/import/ImportGrid.tsx

key-decisions:
  - "Regex batch replacement for Tailwind migration with manual fix for var() fallback values"

patterns-established:
  - "Tailwind v4 parenthetical syntax: use utility-(--custom-prop) not utility-[var(--custom-prop)]"
  - "Key photo collapse: useState toggle on same-sequence second click, auto-expand on switch"

requirements-completed: [ENH-02]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 17 Plan 01: Key Photo Collapse + Tailwind v4 Migration Summary

**Collapsible key photo lists in sidebar SequenceItem with toggle-on-second-click, plus project-wide Tailwind v4 [var(--...)] to (--...) syntax migration across 33 component files**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T09:38:40Z
- **Completed:** 2026-03-24T09:41:40Z
- **Tasks:** 2
- **Files modified:** 34

## Accomplishments
- SequenceItem now supports collapse/expand toggle: second click on active sequence header collapses key photos, clicking a different sequence auto-expands (D-02, D-04)
- All 332 deprecated Tailwind `[var(--...)]` patterns migrated to parenthetical `(--...)` syntax across 33 component files (D-18, D-19)
- TypeScript compilation remains clean (only pre-existing glslRuntime.test.ts unused import warning)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add key photo collapse/expand toggle to SequenceItem** - `db0e155` (feat)
2. **Task 2: Migrate all Tailwind v4 [var(--...)] to (--...) syntax** - `da293ba` (chore)

## Files Created/Modified
- `Application/src/components/sequence/SequenceList.tsx` - Added keyPhotoCollapsed state, toggle on second click, auto-expand on switch, maxHeight condition update, plus Tailwind migration
- `Application/src/components/layout/TimelinePanel.tsx` - 28 Tailwind syntax migrations (highest count file)
- `Application/src/components/sidebar/SidebarFxProperties.tsx` - 25 Tailwind syntax migrations
- `Application/src/components/import/ImportGrid.tsx` - Tailwind migration including manual fix for var() with fallback value
- 30 additional component files - Tailwind `[var(--...)]` to `(--...)` syntax migration

## Decisions Made
- Regex batch replacement (`perl -pe`) for all 332 occurrences was the right approach for a mechanical transformation
- One occurrence with a CSS var() fallback value (`--color-audio-waveform,#22B8A0`) required manual fix since the regex only matched simple `--prop-name` patterns
- Removed the `if (seq.id !== wasActive)` guard around seek-to-frame in handleSelect since the early return for same-sequence click already handles that case

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed var() with fallback value not matching batch regex**
- **Found during:** Task 2 (Tailwind migration)
- **Issue:** ImportGrid.tsx had `text-[var(--color-audio-waveform,#22B8A0)]` with a CSS fallback value; the batch regex `--[\w-]+` didn't match the comma and fallback portion
- **Fix:** Manual edit to convert to `text-(--color-audio-waveform,#22B8A0)`
- **Files modified:** Application/src/components/import/ImportGrid.tsx
- **Verification:** `grep -rn '\[var(--' Application/src/components/ | wc -l` returns 0
- **Committed in:** da293ba (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor regex edge case, no scope creep.

## Issues Encountered
None - both tasks executed smoothly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tailwind syntax is now clean project-wide for Plans 02-04
- SequenceItem collapse toggle is complete, ready for solo mode (Plan 02) and gradient solids (Plans 03-04)
- No blockers

## Self-Check: PASSED

- FOUND: Application/src/components/sequence/SequenceList.tsx
- FOUND: .planning/phases/17-enhancements/17-01-SUMMARY.md
- FOUND: db0e155 (Task 1 commit)
- FOUND: da293ba (Task 2 commit)

---
*Phase: 17-enhancements*
*Completed: 2026-03-24*
