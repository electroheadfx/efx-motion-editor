---
phase: quick-260905-epb
plan: 260905-epb
subsystem: ui
tags: [preact, css, sidebar, scroll, tabs, scripts-panel]

# Dependency graph
requires: []
provides:
  - Pinned tab bars in the right-panel tools and navigation panes (tablists are direct children of the pane divs, siblings of the scroll areas)
  - ScriptsPanel scroll ownership: static toolbar + static Linked Rails nav, scripts list as the sole scroll region, delete-confirmation dialog outside the scrolling region
  - Inspector view in scroll flow under the pinned pane tab bar
affects: [Phase 53 Integrated v1.0.0 Acceptance, native UAT of the right panel]

# Actuals (#2632) — pairs with the plan's `estimate` (30000) to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 4712    # 18847 diff chars / 4 over the 5 files actually changed
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabbed pane = flex column: static tablist header (flex: 0 0 auto) above a SidebarScrollArea wrapping only the tab panel"
    - "Scroll-owning panel: static chrome (toolbar + nav) above a SidebarScrollArea wrapping only the scrollable list; overlays (confirmation dialog) are absolute siblings AFTER the scroll area"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts

key-decisions:
  - "The two tabbed panes are flex columns: the tablist is a direct child of the pane div (flex: 0 0 auto) above a SidebarScrollArea wrapping only the tab panel — the tab bar can no longer scroll away with the content"
  - "The ScriptsPanel owns its scroll: static toolbar + static Linked Rails nav above a SidebarScrollArea wrapping only the scripts list; the delete-confirmation dialog is an absolute-overlay sibling AFTER the scroll area so it stays fully visible and reachable"
  - "The secondary pane renders the ScriptsPanel directly for the scripts tab (no pane-level scroll area — the panel owns its scroll) and keeps the pane-level scroll area for the onion/motion tabs; the source still contains exactly three pane scroll areas so the RightSidebar count assertions stay valid"
  - "The inspector view wraps its short content in a SidebarScrollArea so it stays in scroll flow under the pinned pane tab bar"

patterns-established:
  - "Pinned-chrome + scroll-owner split: static headers/nav/toolbars are flex: 0 0 auto siblings of the SidebarScrollArea, never descendants of the scroll div"

requirements-completed: [ACC-01]

coverage:
  - id: D1
    description: "Tab bars pinned in both tabbed panes (tools pane Paint/Track/Background; navigation pane Actions/Onion/Motion) — tablists are direct children of the pane divs, siblings of the scroll areas"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#PhysicsPaintRightPanel scroll hierarchy (260905-epb)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts#owns three independently scrollable sections"
        status: pass
    human_judgment: false
  - id: D2
    description: "In the Actions tab the toolbar and Linked Rails nav are pinned; only the scripts list scrolls (its own SidebarScrollArea); the delete-confirmation dialog is outside the scrolling region"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#PhysicsPaintScriptsPanel scroll hierarchy (260905-epb)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The selected-loop-clip inspector view keeps the pane tab bar static and its short content in scroll flow (wrapped in a SidebarScrollArea)"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#wraps the inspector view content in a scroll area"
        status: pass
    human_judgment: false
  - id: D4
    description: "The two 32px pane resizer handles and the brushSplit/toolSplit logic are byte-identical; the primary color pane has no tablist and is untouched"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts#places a Lucide-grip 32px grab handle between each section pair"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole app test suite stays green and tsc --noEmit is clean"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "pnpm exec vitest run (185 files, 3448 passed)"
        status: pass
      - kind: unit
        ref: "pnpm exec tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-05
status: complete
---

# Phase quick-260905-epb: Right-panel keep tab bars and the Actions toolbar pinned — only tab content / scripts list scrolls

**Pinned tab bars in the right-panel tools and navigation panes plus ScriptsPanel scroll ownership: static toolbar and Linked Rails nav, scripts list as the sole scroll region, delete-confirmation dialog outside it, inspector in scroll flow**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-05T08:44:35Z
- **Completed:** 2026-09-05T08:56:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Moved the tools and navigation tablists out of their pane-level SidebarScrollArea so each tabbed pane is a flex column: static tablist header (flex: 0 0 auto) above a scroll area wrapping only the tab panel — the tab bar no longer scrolls away with the content.
- Gave the ScriptsPanel its own scroll ownership: the toolbar and Linked Rails nav stay pinned, only the scripts list scrolls inside its own SidebarScrollArea, and the delete-confirmation dialog is an absolute-overlay sibling AFTER the scroll area (fully visible and reachable).
- Wrapped the selected-loop-clip inspector view in a SidebarScrollArea so its short content stays in scroll flow under the pinned pane tab bar.
- Made the secondary pane render the ScriptsPanel directly for the scripts tab (no pane-level scroll area) while keeping the pane-level scroll area for the onion/motion tabs — the source still contains exactly three pane scroll areas, so the RightSidebar count assertions stay valid.
- Added hierarchy regression tests (marker-div SidebarScrollArea mock + source-text ordering) and kept the full suite green (3448 passed) with a clean `tsc --noEmit`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin the tab bars in both tabbed panes** - `7d12e96f` (feat)
2. **Task 2: Give the ScriptsPanel its own scroll ownership** - `8752499e` (feat)
3. **Task 3: Add the hierarchy regression tests + full suite/type check** - `3be8a3e1` (test)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - Tablists moved out of the pane-level SidebarScrollArea in the tools and secondary panes; secondary pane renders the ScriptsPanel directly for the scripts tab and keeps the pane-level scroll area for onion/motion.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` - Normal view: static toolbar + static Linked Rails nav + list in its own SidebarScrollArea + confirmation dialog outside the scroll region; inspector view wrapped in a SidebarScrollArea.
- `app/src/components/physic-paint/physicsPaintStudio.css` - flex-column tabbed panes, flex: 0 0 auto tablists, scripts-panel/list scroll-ownership rules, new `.physics-paint-scripts-list-scroll-area`.
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` - Marker-div SidebarScrollArea mock + hierarchy tests (tablists are siblings of the scroll areas, tab panel inside them, primary pane chrome-less).
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` - Updated list CSS assertion + compact-sidebar top-level children assertion; new source-text hierarchy tests.

## Decisions Made
- The two tabbed panes are flex columns: the tablist is a direct child of the pane div (flex: 0 0 auto) above a SidebarScrollArea wrapping only the tab panel.
- The ScriptsPanel owns its scroll: static toolbar + static Linked Rails nav above a SidebarScrollArea wrapping only the scripts list; the delete-confirmation dialog is an absolute-overlay sibling AFTER the scroll area.
- The secondary pane renders the ScriptsPanel directly for the scripts tab and keeps the pane-level scroll area for onion/motion; the three pane scroll-area occurrences stay in the source so the RightSidebar count assertions remain valid.
- The inspector view wraps its short content in a SidebarScrollArea so it stays in scroll flow under the pinned pane tab bar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the compact-sidebar top-level children assertion in PhysicsPaintScriptsPanel.test.ts**
- **Found during:** Task 2 (ScriptsPanel scroll ownership)
- **Issue:** The plan only flagged the list CSS assertion at L179 for update, but the "compact sidebar contract" test also asserted the scripts list is the direct child immediately after the toolbar (`listIndex === toolbarIndex + 1`). Wrapping the list in its own SidebarScrollArea moved the list out of the panel's top-level children, so that assertion failed.
- **Fix:** Updated the assertion to check the toolbar is the first direct child and the SidebarScrollArea (class `physics-paint-scripts-list-scroll-area`) is the next direct child — reflecting the new pinned-chrome + scroll-owner structure.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
- **Verification:** PhysicsPaintScriptsPanel.test.ts passes (33 tests).
- **Committed in:** 8752499e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The auto-fix was necessary for the test suite to stay green after the intended restructure. No scope creep.

## Issues Encountered
- During the Task 2 secondary-pane edit I initially left a duplicate SidebarScrollArea wrapper in the source (the old pane-level scroll area plus the new conditional one). Caught it by reading the restructured JSX and removed the stale wrapper before running the verify — the Task 2 verify then passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The right panel now keeps its tab bars and the Actions toolbar/Linked Rails nav pinned with only the tab content / scripts list scrolling; the delete-confirmation dialog stays fully visible.
- Native UAT (user drives): in the Actions tab the tab row, icon toolbar, and Linked Rails nav stay pinned while only the scripts list scrolls (EFX thumb); the Paint option tab is pinned with its sliders scrolling; the Onion and Motion tabs are pinned; both 32px resize handles stay smooth; the delete confirmation is fully visible without scrolling; the Color pane behaves exactly as before.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/quick/260905-epb-right-panel-keep-tab-bars-and-the-action/260905-epb-SUMMARY.md`
- Commit `7d12e96f` (Task 1) found in git log
- Commit `8752499e` (Task 2) found in git log
- Commit `3be8a3e1` (Task 3) found in git log

---
*Phase: quick-260905-epb*
*Completed: 2026-09-05*
