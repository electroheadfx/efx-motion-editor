---
phase: quick-261025-co0
plan: 261025-co0
subsystem: physics-paint-ui
tags: [preact, palette, swatches, keyboard-delete, accessibility, vitest]

# Dependency graph
requires: []
provides:
  - "Selectable Color-tab swatches (aria-pressed + accent outline) with no per-swatch X control"
  - "Commit-time in-place rewrite of the selected palette entry (favorites / recents / hidden-default convention)"
  - "Palette-owned Delete/Backspace containment inside the swatch grid"
affects: [physics-paint-color-tab, physics-paint-keyboard-routing]

# Actuals (#2632) — chars/4 over the realized diff (34f0ea29..ac9fa3a1), same scale as the plan estimate.
actuals:
  tokens: 6593
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Palette selection stays in local useState; the rewrite runs from the commit boundary only, never from onColorChange"
    - "Grid-scoped keydown calls preventDefault + stopPropagation before any mutation so the global and Studio delete handlers never fire"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/RightPanelColorTab.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts

key-decisions:
  - "Swatch clicks pass fromSwatch so a stale selectedSwatch closure can never rewrite the previously selected swatch"
  - "The rewrite uses one functional updater per store (favorites swap, recents swap, hide-default + favorite append) so each store persists at most once per commit and no stale array enters the selection-keyed callback"
  - "Delete/Backspace are contained (preventDefault + stopPropagation) for every unmodified Delete/Backspace press inside the grid, even with no selection or on key repeat; only the first press with a selection mutates"

patterns-established:
  - "Selection + key deletion replaces per-item hover controls in palette-like grids: the grid owns the destructive key and re-focuses itself after deletion"

requirements-completed: []

coverage:
  - id: D1
    description: "No X control; swatches toggle aria-pressed selection, each click applies and commits exactly once with focus, and a committed color rewrites the selected favorite/recent/default"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts#native-approved Physics Paint palette behavior"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts#native-approved Physics Paint right sidebar"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live Studio: no X on hover, accent outline on the selected swatch without moving the 32px grid, focus survives clicks in WKWebView, palette Delete/Backspace never deletes a stroke/clip/layer, and the rewrite persists across a Studio reopen"
    verification:
      - kind: human
        ref: "Live Studio UAT — 7 native rows"
        status: pass
    human_judgment: true
    rationale: "Visual geometry, WKWebView focus behavior, global keyboard routing, and cross-session persistence are native-surface judgments vitest cannot observe."

# Metrics
duration: 3min
completed: 2026-10-25
status: complete
---

# Quick 261025-co0: Selectable Color palette Summary

**Color-tab swatches are now selectable (accent outline + aria-pressed), a committed color rewrites the selected entry in place, and Delete/Backspace inside the palette removes it without reaching stroke/clip/layer handlers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-25T08:15:03Z
- **Completed:** 2026-10-25T08:17:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Removed the per-swatch X control and its three CSS rules; the lucide `X` import is gone from the color tab.
- Swatches toggle selection with `aria-pressed` and a single accent-outline rule (`outline-offset: 1px`) that leaves the 8-column 32px cell geometry and 7px gap untouched.
- A commit-boundary color change (box release, hue release, color chip, hex Enter/blur, +) rewrites the selected palette entry: favorites in place, recents in place, or the existing hide-default + newest-favorite convention — with no live-drag writes and no write storms for identical or unselected colors.
- Delete/Backspace inside the palette grid delete the selected swatch, clear the selection, refocus the grid, and always call `preventDefault` + `stopPropagation` before any mutation; modifiers and key repeats never mutate.
- Palette behavior suite rewritten: selection/deselection, no-X, commit rewrite (favorite + default), no-write-storm, and Delete/Backspace containment (including repeat, modifiers, and non-delete keys).

## Task Commits

Each task was committed atomically:

1. **Task 1: Selectable swatches, commit-time rewrite, and palette-owned Delete/Backspace** - `57c6b61f` (feat)
2. **Task 2: Rewrite the palette behavior suite for selection, rewrite, and Delete/Backspace** - `ac9fa3a1` (test)

## Files Created/Modified
- `app/src/components/physic-paint/view/RightPanelColorTab.tsx` - selection state, commit-time rewrite, grid keydown containment, `aria-pressed`; X control and lucide import removed.
- `app/src/components/physic-paint/physicsPaintStudio.css` - three removal rules deleted; `.physics-paint-swatch[aria-pressed="true"]` outline rule added after the swatch base rule.
- `app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts` - palette geometry test renamed/pinned to the no-X + selected-outline contract; grab-handle test pins the new color-tab contract.
- `app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts` - obsolete removal test replaced by seven focused behavior tests; the one-commit-per-gesture swatch click now exercises the focus call.

## Decisions Made
- Kept the component's existing useState/useCallback/useRef model (no signals migration, no new effects, no window/document listeners) per D-05.
- Rewrite ordering follows D-03 literally: favorites swap, recents swap, then the built-in hide-default + favorite append, then move the selection to the new color.
- Global containment uses `fromSwatch` on the click path (D-03) and unmodified-key-only handling on the grid path (D-04), so Cmd/Ctrl/Alt/Shift combinations remain available to the global and Studio handlers.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. The obsolete removal test was expected to fail during Task 1 and was replaced in Task 2, as the plan specified.
- STATE.md / ROADMAP.md were intentionally left untouched: the orchestrator owns the docs commit for this quick task.

## UAT

- **Native UAT approved (2026-10-25):** all 7 live Studio rows passed — no-X hover, select/deselect outline, commit rewrite of a favorite and a default, persistence across reopen, palette Delete/Backspace containment, no-selection/repeat safety, and switching swatch A → B.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Automated verification is green:

- `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintPalette.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` → 3 files, 62 tests passed.
- `pnpm --dir app run typecheck` → clean.

All 7 native UAT rows from `261025-co0-PLAN.md` were **approved on 2026-10-25** (no-X hover, select/deselect, commit rewrite of a favorite and a default, persistence across reopen, palette Delete/Backspace containment, no-selection/repeat safety, switching swatch A → B).

## Self-Check: PASSED
