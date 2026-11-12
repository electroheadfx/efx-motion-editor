---
phase: 261112-lq4-ui-stroke-vector-modal-redesign
plan: 01
subsystem: ui
tags: [preact, signals, stroke-settings, tabs, aquarelle, vector, vitest]

# Dependency graph
requires:
  - phase: 61
    provides: per-vertex vector anchors, Anchor width / Curve / Corner controls, Edit path session
  - phase: 261111-vg4
    provides: Geometry | Stack sheet, tool-dropdown filter entry point
  - phase: 261101-jmm
    provides: the list-first sheet whose view gate this task retires
provides:
  - Four-key tab law (List | Geometry | Stack | Curve) rendered as ONE always-visible pinned row
  - Pure `activeSettingsTab` derivation with no write-back (requested Curve returns after an availability dip)
  - Single `AnchorWidthControl` mount inside the Curve tab (`stroke-settings-curve-anchor-width`)
  - Fine filters merged to the top of the List body; tool dropdown is the sheet's only filter entry point
  - Edit path and Preview stroke size in the Draft strip; cache caption deleted
  - The 261101-jmm view law deleted from the model, with every toggle/ref/invalidation marker gone
affects: [61, PhysicsPaintStudio, stroke-settings follow-ups, Studio regression pins]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 31414
  tasks: 3
  commits: 3
plan_head_before: d7a0e64f136ba4683e8b5536291b3b0f597bf80f
plan_head_after: 153c82c052cd31c6400bc0073a08ad5d3c2b830d

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure render-derived tab with availability fallback and no write-back
    - One structural gate per context-gated tab; each control block keeps its own gate
    - Ref-held session tab with compare-then-write click handler

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts

key-decisions:
  - "The requested tab is a PURE render derivation (settingsTabAvailable + defaultSettingsTab); an unavailable tab is never rendered and the fallback writes nothing, so a requested Curve returns when a vector stroke is reselected — the shipped Stack precedent."
  - "List availability is watercolor-only and the default there; brush keeps Geometry | Stack with no List and no Curve tab."
  - "Curve availability (one selected vector stroke + the anchor read) gates the whole tab structurally; the Vertex size, Curve and Corner blocks keep their own gates and write through the shipped bundle ports."
  - "The fine filters moved to the top of the List container, inside the scroll area, keeping the tool select as the ONE filter entry point and never importing the top-bar setter."
  - "The 261101-jmm view-law helpers were deleted from the model rather than deprecated — internal seams get no backward compatibility."

patterns-established:
  - "Content-gated tabs: a tab is hidden by `settingsTabAvailable(tab.key)` and the body renders one independent section per tab in source order."
  - "Source-pin deletion tests assert the absence of the retired identifiers in BOTH the dialog and the model, and the doc comments avoid naming them literally."

requirements-completed: [QUICK-261112-LQ4]

coverage:
  - id: D1
    description: "The Paint | Eraser | All segmented row and its chrome are gone; the tool dropdown is the sheet's one filter entry point and still re-resolves the tip on change while the top-bar type filter stays read-only."
    requirement: QUICK-261112-LQ4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#quick 261112-lq4 — the four-tab sheet > deletes the segmented type row — the tool dropdown is the one entry point"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#the tool dropdown is the one filter entry point the deleted row left behind"
        status: pass
    human_judgment: false
  - id: D2
    description: "One always-visible tab row List | Geometry | Stack | Curve: List default for watercolor (filters, summary, rows), Geometry trimmed to seed/Opacity/transforms, Stack unchanged and gated, Curve hosting Vertex size + Curve + Corner and gated on one selected vector stroke; Stack and Curve fall back to List, brush has Geometry | Stack only."
    requirement: QUICK-261112-LQ4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#261112-lq4 four-tab stroke settings sheet (defaults to the List tab; adds the Curve tab only for one selected vector stroke; omits the Stack tab without a reorder seam and falls back to List; switch content per tab)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#quick 261112-lq4 — the four-tab sheet"
        status: pass
    human_judgment: true
    rationale: "Native UAT row 2 — live tab order/visual placement, the Curve tab appearing when a vector stroke is selected, and the Stack/Curve fallbacks need a real selection pass in the app; CI cannot observe the rendered sheet."
  - id: D3
    description: "The list ↔ settings view machinery is fully deleted (no toggle, view ref, invalidation marker, or model view helpers) while the dismissal and path-edit exit laws are untouched."
    requirement: QUICK-261112-LQ4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#quick 261112-lq4 — the four-tab sheet > deletes the list ↔ settings view gate root and branch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#261029-eur dialog filter row, fixed tab set and open-on-empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Draft strip reads Draft switch, Edit path, Preview stroke size, cache eye with exactly one text label and no cache caption; the header keeps icon, title, multi-selection trash and Close."
    requirement: QUICK-261112-LQ4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-11 Edit path Draft-strip button (E2)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#carries Edit path then Preview stroke size before the cache eye, with ONE text label"
        status: pass
    human_judgment: true
    rationale: "Native UAT row 3 — the strip's right alignment, fit and the two moved switches need a live visual pass."
  - id: D5
    description: "The List tab hosts the filter dropdowns above the summary and rows, with per-row delete, Shift-range and Cmd toggle unchanged."
    requirement: QUICK-261112-LQ4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#plain replaces, Cmd and Ctrl toggle, Shift takes the displayed range"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#lives inside the app scroll area and keeps the chrome sentence case"
        status: pass
    human_judgment: true
    rationale: "Native UAT row 4 — hierarchy of filters/summary/rows and the multi-select feel are judged on the live sheet."

# Metrics
duration: 39min
started: 2026-11-12T14:24:48Z
completed: 2026-11-12T15:03:08Z
status: complete
uat_approved: 2026-11-12
---

# Quick 261112-lq4: Four-tab Stroke/Vector sheet Summary

**Stroke settings is now one always-visible List | Geometry | Stack | Curve tab row, with the list ↔ settings view gate deleted from the dialog and the model and the three vector controls moved into a context-gated Curve tab**

## Performance

- **Duration:** 39 min
- **Started:** 2026-11-12T14:24:48Z
- **Completed:** 2026-11-12T15:03:08Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Merged the Paint | Eraser | All row into the tool dropdown: the segmented row, its four style objects and the `setAquarelleStrokeTypeFilter` import are gone; the dialog only reads `aquarelleStrokeTypeFilter.value` to narrow `typeRows`, and the tool select still re-resolves the tip against the new tool's rows.
- Moved Edit path and Preview stroke size into the Draft strip (after the spacer, before the cache eye), deleted the cache caption span, and reduced the header to icon, title, multi-selection trash and Close.
- Replaced the two-state view gate with the four-key tab law: `type StrokeSettingsTab = 'list' | 'geometry' | 'stack' | 'curve'`, registry in rendered order, `settingsTabRef` defaulting to `'list'`.
- Added a pure `activeSettingsTab` derivation (`settingsTabAvailable` + `defaultSettingsTab`) with no write-back, so a requested Curve falls back to List during an availability dip and returns when a vector stroke is reselected.
- Created the Curve section hosting the SINGLE `AnchorWidthControl` mount (`stroke-settings-curve-anchor-width`), the Curve row and the Corner row with their gates, captions and single-write guards unchanged; deleted the list and Geometry mounts.
- Moved the fine filters to the top of the List container inside the scroll area; List keeps the summary, empty captions, clickable rows, per-row delete and serial.
- Deleted the 261101-jmm view law from `strokeSettingsModel.ts` (`StrokeSettingsView`, `resolveStrokeSettingsView`, `StrokeSettingsViewInvalidationArgs`, `shouldInvalidateStrokeSettingsView`) and every trace of the toggle, `settingsViewRef`, invalidation marker and fallback branch from the dialog; `sawEmptySinceDismiss` and `pathEditExitRequested` are untouched.
- Repointed both suites to the new law (source deletion pins, availability pins, tab-navigation behavior, Curve availability/fallback, single mount) — no CSS, package or Studio file changed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Merge the Paint | Eraser | All row into the tool dropdown** - `f51677578` (feat)
2. **Task 2: Move Edit path and Preview stroke size into the Draft strip** - `fcb003207` (feat)
3. **Task 3: Four tabs and the view machinery deleted** - `153c82c05` (feat)

**Plan metadata:** `8f51e2eab` (docs: complete quick task)

_Measured from the plan ledger `gsd-plan-head-before-261112-lq4-01` (= `d7a0e64f`): `git rev-list --count d7a0e64f..HEAD` = 3._

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - four-tab law, unconditional tab row, merged filter, Draft-strip controls, Curve section, view machinery removed
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - the 261101-jmm view-law block deleted; every surviving helper untouched
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` - source pins repointed (four-tab registry, deletion pins, availability law, Curve relocation, single Anchor width mount, Draft-strip order)
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - behavior pins repointed (List default, tab navigation, Curve availability/fallback, List-only filters, strip order, single Curve mount)

## Decisions Made

- The active tab is a pure render derivation with no write-back (the shipped Stack precedent); the tab key is ref-held session state that survives close/reopen and is never invalidated by an empty selection.
- List availability is watercolor-only and the watercolor default; brush keeps Geometry | Stack and gains no List or Curve tab.
- Curve availability (`engineModule === 'watercolor' && selectedVectorAnchors !== null`) gates the whole tab; the three control blocks keep their own gates so no block can mount a control it cannot address.
- The fine filters stay inside the List body (scroll area) rather than the header, preserving the dialog's single filter entry point and the top-bar-owned global filter.
- The model's view-law helpers were deleted outright rather than deprecated (no backward compatibility for internal seams).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Doc comment named the retired identifier, tripping its own deletion pin**
- **Found during:** Task 3 (dialog source pins)
- **Issue:** The strict `expect(dialogSource).not.toContain('settingsViewRef')` pin failed because the rewritten doc block referenced the retired name in prose.
- **Fix:** Reworded the comment to "no view ref" and kept the pin exact — the pin tests code, not documentation.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`
- **Verification:** dialog suite green (49 tests).
- **Committed in:** `153c82c05` (Task 3 commit)

**2. [Rule 1 - Bug] Delete-to-empty test assumed a Geometry body on an empty selection**
- **Found during:** Task 3 (model suite repoint)
- **Issue:** Geometry renders no section when the selection empties (`liveCenter ? … : null`), so the test's `stroke-settings-geometry` assertion was wrong; the requested tab itself is what persists.
- **Fix:** Asserted the Geometry tab stays `aria-selected` and the List body stays absent; switching to List restores the rows.
- **Files modified:** `app/src/components/physic-paint/view/strokeSettingsModel.test.ts`
- **Verification:** model suite green (168 tests).
- **Committed in:** `153c82c05` (Task 3 commit)

**3. [Rule 1 - Bug] Empty-selection test asserted an empty-frame caption in a non-empty frame**
- **Found during:** Task 3 (model suite repoint)
- **Issue:** `stroke-settings-list-empty-frame` renders only when the frame has zero strokes; that bundle's frame carries one stroke, so the caption never appears.
- **Fix:** Asserted the rows are present and the List tab is selected instead.
- **Files modified:** `app/src/components/physic-paint/view/strokeSettingsModel.test.ts`
- **Verification:** model suite green.
- **Committed in:** `153c82c05` (Task 3 commit)

**4. [Rule 3 - Blocking] Curve commit-seam test needed the tab gate open to observe the missing seam**
- **Found during:** Task 3 (model suite repoint)
- **Issue:** A bundle without `readVectorAnchors` hides the Curve tab entirely, so the missing `applyCurveMode` seam was unobservable.
- **Fix:** Gave the seam-gate bundle `readVectorAnchors: () => []` and asserted the tab exists while the Curve row does not.
- **Files modified:** `app/src/components/physic-paint/view/strokeSettingsModel.test.ts`
- **Verification:** model suite green.
- **Committed in:** `153c82c05` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** Test-harness corrections only; no production behavior or scope changed.

## Issues Encountered

- The pre-existing pins on the retired view machinery cascaded through both suites (18 model failures and a typecheck error mid-refactor); all were repointed in Task 3 as planned, and the final state is green.

## Verification

Automated (all green, `vitest run` only):
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts` — 217 passed
- `pnpm --prefix app run typecheck` — clean
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` — 413 passed

Scope checks:
- `git diff --name-only d7a0e64f..HEAD` names only the four planned files.
- `package.json`, `pnpm-lock.yaml`, `physicsPaintStudio.css`, `PhysicsPaintStudio.tsx` and the Studio test are untouched.
- The dialog reads `aquarelleStrokeTypeFilter.value` and never imports/calls its setter.
- Exactly one `<AnchorWidthControl` mount and one `<div data-testid="stroke-settings-anchor-width">` declaration survive; the only mount wrapper carries `stroke-settings-curve-anchor-width`.

## Native UAT Rows — approved 2026-11-12

1. Watercolor Select on a frame with brush, water, pen and eraser strokes: the sheet shows ONE tool dropdown (All tools, then Brush/Water/Pen, plus Eraser when the top bar admits lift rows) and no Paint | Eraser | All row; changing the tool still re-resolves the tip and narrows the rows.
2. The sheet body shows List | Geometry | Stack, with List default; Geometry shows seed variation, Opacity (brush) and X/Y/Scale/Scale X/Scale Y/Rotation only; selecting one vector stroke adds Curve, and that tab shows Vertex size, Curve and Corner; Stack disappears without a reorder seam and Curve disappears without a single vector stroke — both land back on List.
3. The Draft strip reads Draft switch, Edit path, Preview stroke size, cache eye left to right with no caption beside the eye; the header keeps icon, title, multi-stroke trash and Close; both moved switches still toggle and the strip still fits its right alignment.
4. The List tab shows the filter dropdowns above the summary and rows; per-row delete, Shift-range and Cmd toggle are unchanged.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The four-tab sheet passed live UAT on 2026-11-12; the quick task is closed.
- No dependency, CSS or Studio seam changed, so the Studio regression suite stays a valid guard for future stroke-settings work.

---
*Phase: 261112-lq4-ui-stroke-vector-modal-redesign*
*Completed: 2026-11-12*

## Self-Check: PASSED
