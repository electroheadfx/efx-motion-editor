---
phase: quick-260905-hfd
plan: 260905-hfd
subsystem: ui
tags: [preact, signals, physics-paint, scripts-panel, a11y, css-specificity]

# Dependency graph
requires:
  - phase: quick-260905-f3v
    provides: guarded IconButton helper, explicit Linked Rails nav, readable script rows
provides:
  - Scoped .physics-paint-script-name:disabled override neutralizing the global button:disabled grey-out
  - Contextual Edit Rail removed from the list view and the Studio wiring
  - One-line compact Linked Rails nav (heading + two icon-only chevron buttons)
  - Single 4-button inspector top action row (Edit Rail · Previous · Next · Close) above the scroll area
  - descriptionId wired on Delete Action and Refresh Actions so sr-only disabled reasons are announced
affects: [quick-260905-f3v, PhysicsPaintScriptsPanel, PhysicsPaintStudio]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 8860    # chars/4 over the realized diff (35438 chars)
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scoped :disabled override at higher specificity (0-2-0) to beat a global element rule (0-1-1) instead of editing the global rule"
    - "Pinned chrome: a top-row div placed before the flex-1 min-h-0 SidebarScrollArea stays outside the scroll area"
    - "IconButton label/title props carry the accessible name and tooltip copy; no visible label span for icon-only compact buttons"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts

key-decisions:
  - "Neutralize the disabled script-title grey-out with a scoped .physics-paint-script-name:disabled override (0-2-0) rather than editing the global button:disabled rule — the override keeps the disabled rename affordance's behavior while restoring white full-opacity titles"
  - "Remove the contextual Edit Rail entirely (list view + Studio derivation/handler/wiring) instead of attempting to fix its detection — Previous/Next suffice"
  - "Compact list nav to one row with icon-only chevron buttons; the accessible name and tooltip copy live in the IconButton label/title props, not visible label spans"
  - "Inspector actions consolidated into a single 4-button top row above the scroll area (pinned chrome), removing the old bottom actions row and the nav buttons container"

patterns-established:
  - "Pattern: scoped override beats global rule at higher specificity for disabled affordances that must keep their disabled behavior but not the grey-out"
  - "Pattern: pinned chrome rows sit before the SidebarScrollArea (flex-1 min-h-0) so they never scroll"

requirements-completed: [ACC-01]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Disabled script titles render white at full opacity with no dark strip via a scoped .physics-paint-script-name:disabled override; the global button:disabled rule is untouched"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#neutralizes the disabled script-title grey-out with a scoped override (260905-hfd)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Contextual Edit Rail removed from the list view and the Studio (no cursorOnCurrentLinkedRail derivation, no onEditCurrent wiring, memo deps trimmed)"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#no longer derives cursorOnCurrentLinkedRail or wires onEditCurrent through the Studio memo (260905-hfd)"
        status: pass
    human_judgment: false
  - id: D3
    description: "List-view Linked Rails nav is one compact row: heading left, two icon-only chevron buttons right; Go to Group stays for total === 1"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#compacts the list-view Linked Rails nav to one row with two icon-only chevron buttons (260905-hfd)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Inspector shows a single 4-button top action row (Edit Rail · Previous · Next · Close) above the scroll area; old bottom actions row and nav buttons container gone; Edit Rail + Close only when linkedGroupNavigation is null"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#renders a single 4-button top action row above the inspector scroll area (260905-hfd)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Delete Action and Refresh Actions expose descriptionId so their sr-only disabled reasons are announced"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#wires descriptionId on every toolbar IconButton so sr-only disabled reasons are announced (260905-hfd)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-05
status: complete
---

# Phase quick-260905-hfd: Amendment to quick-260905-f3v — fix the gray script-title cascade, remove the contextual Edit Rail, compact the Linked Rails nav, inspector top action row

**Scoped CSS override restores white full-opacity script titles, the contextual Edit Rail is gone, the list-view Linked Rails nav is one compact row, the inspector gets a single 4-button top row, and Delete/Refresh sr-only reasons are now announced**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-05T12:38:00Z
- **Completed:** 2026-09-05T12:41:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `.physics-paint-script-name:disabled { color: inherit; opacity: 1; background: transparent; cursor: default; }` (specificity 0-2-0) beating the global `button:disabled` rule (0-1-1) — disabled rename buttons render white at full opacity with no dark strip while keeping their disabled behavior; the global rule is untouched and a contract test pins both sides
- Removed the contextual Edit Rail from the list view and the Studio: `cursorOnCurrentRail`/`onEditCurrent` dropped from the `linkedGroupNavigation` props interface, the `cursorOnCurrentLinkedRail` derivation and `handleEditCurrentLinkedGroup` useCallback deleted, wiring and memo deps trimmed
- Compacted the list-view Linked Rails nav to one horizontal line: heading left, two icon-only chevron buttons (Previous/Next) right via new `physics-paint-loop-clip-nav-compact*` CSS; `Go to Group` stays for `total === 1`
- Consolidated the inspector actions into a single 4-button top row (`physics-paint-loop-clip-inspector-top-actions`) above the scroll area — Edit Rail · Previous · Next · Close — removing the old bottom actions row and the nav buttons container; the `<dl>` and heading scroll inside, the top row stays pinned
- Wired `descriptionId` on Delete Action and Refresh Actions so their sr-only disabled reasons are announced via `aria-describedby`

## Task Commits

Each task was committed atomically:

1. **Task 1: Neutralize the disabled script-title grey-out with a scoped override + contract test** - `eab594f5` (feat)
2. **Task 2: Remove the contextual Edit Rail, compact the list nav to one row, add the inspector top action row** - `6fbf36a9` (feat)
3. **Task 3: Ride-along — wire descriptionId on Delete Action and Refresh Actions** - `9ae24727` (feat)
4. **Auto-fix: update cross-file Edit Rail assertion to the IconButton label prop form** - `d75a7305` (fix)

**Plan metadata:** `eae8bbc2` (docs: plan — committed by the orchestrator, not the executor)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` - Trimmed `linkedGroupNavigation` props interface; removed the contextual Edit Rail; compact list nav with icon-only chevron buttons; inspector top action row; `deleteReasonId`/`refreshReasonId` + `descriptionId` wiring
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Removed `cursorOnCurrentLinkedRail` derivation, `handleEditCurrentLinkedGroup` useCallback, the `linkedGroupNavigation` wiring, and the memo deps entries
- `app/src/components/physic-paint/physicsPaintStudio.css` - Added `.physics-paint-script-name:disabled` override, `physics-paint-loop-clip-nav-compact*` rules, `.physics-paint-loop-clip-inspector-top-actions`; removed dead `physics-paint-loop-clip-inspector-actions` container rules
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` - Part A contract test; removed f3v Edit Rail tests; added compact-nav, top-row, and null-navigation contracts; descriptionId assertions
- `app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts` - Updated the cross-file Edit Rail assertion to the IconButton label prop form

## Decisions Made
- Scoped override over global-rule edit: the disabled rename affordance keeps its disabled behavior (rename still requires selection) but renders white at full opacity — the global `button:disabled` rule stays untouched
- Removal over detection-fix: the contextual Edit Rail detected nothing and Previous/Next suffice, so it was removed entirely rather than patched
- Icon-only compact buttons carry their accessible name and tooltip copy in the IconButton `label`/`title` props — no visible label spans

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cross-file test pinned the old Edit Rail source string**
- **Found during:** Post-task full-suite run (after Task 3)
- **Issue:** `PhysicsPaintRightSidebar.test.ts` asserted `aria-label={`Edit Rail — ${selectedLoopClip.displayName}`}` — the native-button form that Task 2 replaced with the IconButton `label` prop form, breaking the full app suite
- **Fix:** Updated the assertion to `label={`Edit Rail — ${selectedLoopClip.displayName}`}`
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
- **Verification:** Full app suite green (3459 passed), typecheck clean
- **Committed in:** d75a7305

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the suite to stay green after the planned inspector restructure. No scope creep.

## Issues Encountered
- None beyond the auto-fixed cross-file assertion above

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three planned tasks complete; the PhysicsPaintScriptsPanel suite (47 tests), the full app suite (3459 passed), and `tsc --noEmit` are green
- Native UAT is user-driven (no server started by Claude): verify white script titles at full opacity, no contextual Edit Rail, one-line compact list nav, 4-button inspector top row, Go to Rail/Go to Group intact for `total === 1`, unchanged rename/delete flows, and announced Delete/Refresh reasons

---
*Phase: quick-260905-hfd*
*Completed: 2026-09-05*

## Self-Check: PASSED
- SUMMARY.md exists at `.planning/quick/260905-hfd-amendment-to-quick-260905-f3v-fix-the-gr/260905-hfd-SUMMARY.md`
- Commits verified: eab594f5 (Task 1), 6fbf36a9 (Task 2), 9ae24727 (Task 3), d75a7305 (auto-fix)

## UAT Follow-up (2026-09-05, approved)
- Native UAT passed. One design change from user feedback: the inspector top row's Edit Rail / Previous Rail / Next Rail buttons now show visible text labels (`.physics-paint-loop-clip-nav-compact-button.labeled` grows the button to fit); Close stays icon-only and the list-view chevrons stay icon-only. Commit `ddb4ebde`. Suite still green (3459 pass), `tsc` clean.
