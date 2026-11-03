---
phase: 58-rail-editing-regressions
plan: 05
subsystem: physics-paint studio Key Rail inspector wiring
tags: [preact, physics-paint, key-rail, scripts-panel, inspector, signals, memoization, vitest, rail-editing]

# Dependency graph
requires:
  - phase: 58
    plan: 02
    provides: openKeyRailCycleEdit returning Promise<RotoPlayScriptLoopOpResult> on every path and the 'key-rail-create' controller mode
  - phase: 58
    plan: 03
    provides: SelectedKeyRailInspectorPresentation, projectSelectedKeyRailInspector, the Scripts panel takeover, the Key Rail double-click/Enter intent, and the WorkflowStrip forwarding prop
provides:
  - Stable selectedKeyRailInspector useMemo with the rail-set anchor fallback (D-03)
  - handleOpenRotoKeyRailCycleEdit (select-then-open, Promise on every path) and handleCloseRotoKeyRail (clears both selection layers)
  - Right-panel scripts props and WorkflowStrip onOpenKeyRailCycleEdit wiring
affects: [58-verify-work, Studio Key Rail UAT]

actuals:
  tokens: 4906
  tasks: 1
  commits: 1
  plan_head_before: e561404847152ac13694c3415628d893c01cd781
  plan_head_after: 9af22dd8e3fa73801a2ff469e30a41729e39be89

tech-stack:
  added: []
  patterns:
    - "Stable derived projection: the panel-facing inspector is a useMemo whose deps are exactly the identity-stable reconciled selection, the memoized segment map, a primitive anchor, and the set size"
    - "One anchor rule: the rail-set key-rail anchor expression is a single Studio const consumed by both the inspector memo and the WorkflowStrip bundle"
    - "Close dismisses every layer that can re-supply the inspector — the single-rail signal AND the rail set"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The inspector memo depends on effectiveRailSetMembers.length and the railSetAnchorKeyRailId primitive (never the members array), so an unchanged selection keeps one object identity across unrelated Studio renders and the right-panel identity memo does not rebuild."
  - "The anchor fallback `effectiveSelectedRotoKeyRail?.firstKeyId ?? railSetAnchorKeyRailId` is what makes D-03 reachable: modifier gestures null the single-rail signal but populate the set, and the projection then carries setSize >= 2 and the disabled reason."
  - "handleOpenRotoKeyRailCycleEdit returns Promise.resolve on the missing-segment refusal, so the Promise-on-every-path contract satisfies 58-03's (firstKeyId: string) => Promise<unknown> | void prop type and the strip's void-returning prop."
  - "handleCloseRotoKeyRail clears selectedRotoKeyRail AND railSetSelection — clearing only the single-rail signal would let the D-03 anchor re-supply the dismissed rail and keep the takeover alive."
  - "The inline key-rail anchor ternary in the WorkflowStrip bundle was replaced by the shared railSetAnchorKeyRailId const, so there is exactly one anchor definition in the Studio."
  - "Edit Rail selects first, then delegates to rotoPlayScript.openKeyRailCycleEdit, mirroring handleOpenRotoLoopEdit so the panel already shows the inspector when the modal closes."

requirements-completed: [RAIL-01]

coverage:
  - id: D1
    description: "selectedKeyRailInspector is a useMemo with exactly the four stable inputs and the projection is called once, inside the memo callback (no render-body projection, no per-render object)"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#projects the inspector exactly once, inside a useMemo with the four stable inputs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A 2+ rail set whose anchor is a Key Rail still projects through the shared railSetAnchorKeyRailId const, carrying setSize >= 2 and the disabled reason; the strip and the memo read one anchor rule"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#resolves the rail-set anchor through ONE shared const so a 2+ set still projects (D-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Edit Rail/double-click/Enter reach one handler that assigns selectedRotoKeyRail before calling rotoPlayScript.openKeyRailCycleEdit and returns a Promise on the missing-segment refusal"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#selects before opening and returns a Promise on the missing-segment refusal"
        status: pass
    human_judgment: false
  - id: D4
    description: "Close clears BOTH selectedRotoKeyRail and railSetSelection, so a null anchor yields a null presentation and the Scripts panel renders its normal content"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#clears BOTH selection layers on Close so the takeover is dismissible (D-01/D-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The right-panel scripts object carries selectedKeyRail/onOpenKeyRailEdit/onCloseKeyRail, the identity memo lists the presentation and both handlers, and the WorkflowStrip bundle carries onOpenKeyRailCycleEdit"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#threads the presentation and both handlers into the right-panel scripts props"
        status: pass
    human_judgment: false
  - id: D6
    description: "In the live Studio, selecting a Key Rail shows the takeover, Edit Rail opens the reduced Cycle dialog, double-click/Enter opens it, Close dismisses it (plain and 2+ rail-set), and the multi-select Edit Rail is visibly disabled with its reason"
    requirement: RAIL-01
    verification: []
    human_judgment: true
    rationale: "Source pins prove the wiring shape but not the live Preact render, the modal round-trip, or the disabled tooltip in the Studio window; phase UAT owns that confirmation."

duration: 4 min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 05: Key Rail inspector Studio wiring summary

**A selected Key Rail now feeds the Scripts panel a memoized three-fact inspector — including the rail-set anchor with its D-03 disabled reason — while Edit Rail selects then opens the controller entry and Close clears both selection layers.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-03T12:25:00Z
- **Completed:** 2026-11-03T12:28:00Z
- **Tasks:** 1
- **Files modified:** 2 (1 production source, 1 spec)
- **Commits:** 1 (measured from `e56140484..9af22dd8e`)

## Accomplishments

- `keyRailSegmentByFirstKeyId` is a memoized `Map<firstKeyId, KeyRailSegment>` beside `keyRailSegments`, so the lookup identity is usable as a memo dependency and shared by the inspector and the open handler.
- `railSetAnchorKeyRailId` extracts the `:10951` inline ternary into one Studio const; the inspector memo and the WorkflowStrip bundle now read the same anchor rule, and the whole file contains exactly one `effectiveRailSetMembers[0]?.kind === 'key-rail'` expression.
- `selectedKeyRailInspector` is a `useMemo` over exactly `[effectiveSelectedRotoKeyRail, keyRailSegmentByFirstKeyId, railSetAnchorKeyRailId, effectiveRailSetMembers.length]`, applying the `?? railSetAnchorKeyRailId` fallback and `setSize: effectiveRailSetMembers.length`, so a 2+ rail set projects the anchor's segment with `Select a single rail to edit it.` and an unchanged plain selection keeps one object identity.
- `handleOpenRotoKeyRailCycleEdit` reads the segment from the memoized map, assigns `selectedRotoKeyRail` first, then returns `rotoPlayScript.openKeyRailCycleEdit(...)`; the missing-segment branch returns `Promise.resolve({ ok: false, reason: 'This Key Rail no longer exists.' })`, so the always-Promise contract holds.
- `handleCloseRotoKeyRail` assigns both `selectedRotoKeyRail.value = null` and `railSetSelection.value = null`; with the anchor gone, the memo returns null and 58-03's panel branch falls through to the normal Scripts content.
- The right panel receives `selectedKeyRail`, `onOpenKeyRailEdit`, and `onCloseKeyRail`, with the presentation and both handlers added to the `rightPanelPropsMemo` dependency array; the WorkflowStrip bundle carries `onOpenKeyRailCycleEdit` and the shared anchor const.
- Verification: the Studio spec passes 336/336, the four neighboring Key Rail/panel/strip/presentation specs pass 240/240, and `tsc --noEmit` is clean.

## Task Commits

1. **Task 1: Studio wiring — stable inspector projection, handlers, and prop bundles** - `9af22dd8e` (feat)

**Plan metadata:** `PENDING` (docs: complete plan)

_Note: this task was declared `type="auto"` without `tdd="true"`; the canonical behavior-adding predicate returned `is_behavior_adding: false`, so a RED commit was not required. The new pins are source-string consequence pins over the wiring, which cannot fail meaningfully before the wiring exists as a separate testable unit._

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — added the segment map memo, the shared anchor const, the inspector memo, both handlers, the right-panel scripts props/deps, and the strip bundle entry; replaced the inline anchor ternary with the const.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — five new pins covering the memo shape and single projection call, the single anchor rule and 2+ set projection, the select-then-open Promise contract, the two-layer Close, the consequence (null anchor → null presentation → normal panel), and the right-panel/strip threading; plus one existing pin updated for the expanded named import.

## Decisions Made

- The inspector memo's deps are the reconciled selection object, the memoized segment map, the primitive anchor, and the member count — never the members array — because `createIdentityMemo` compares with `Object.is` and the plan prohibits an un-memoized projection in the dependency array.
- The handler resolves its segment from `keyRailSegmentByFirstKeyId` (not from the passed id alone), so the assignment always carries the current ordered `keyIds` the controller revalidates.
- `handleCloseRotoKeyRail` uses setter-only writes and an empty dependency array, mirroring the existing key-selection clear path in `handleSelectRotoSpacingProxy`.
- No `useEffect` was introduced: selection and modal opening happen inline in the click/double-click/Enter handlers (efx-preact-reactivity: apply selection in the click handler).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the 43.4-06 import pin for the expanded named import**
- **Found during:** Task 1 verification (first Studio spec run)
- **Issue:** `PhysicsPaintStudio.test.ts:592` asserted the exact literal `import { deriveKeyRailSegments } from './view/physicsPaintKeyRailPresentation';`. The task legitimately extends that import with `projectSelectedKeyRailInspector`, so the obsolete literal failed while the intent (the Key Rail presentation module owns the import) still held.
- **Fix:** The pin now asserts the extended named import and documents why, keeping the same module-ownership intent.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Studio spec 336/336 passed; typecheck clean.
- **Committed in:** `9af22dd8e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/test-pin correction)
**Impact on plan:** No production behavior changed beyond the plan; the pin correction was forced by the planned import change and preserves its original assertion intent. No scope creep.

## Issues Encountered

- None beyond the stale import pin above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RAIL-01 is wired end-to-end in the Studio: selection → inspector → Edit Rail/double-click/Enter → controller, and Close → normal panel.
- `.planning/config.json` was intentionally left uncommitted (orchestrator-owned gate toggle).
- The live Studio surface (takeover rendering, modal round-trip, disabled tooltip, 2+ set behavior) remains for phase UAT; all automated anchors are green.
- No `.mce`, schema, store, parser, CSS, or Rust changes; `PhysicsPaintRightPanel.tsx`, `PhysicsPaintWorkflowStrip.tsx`, and the controller are untouched by this plan.

## Self-Check: PASSED

All modified files exist on disk, and the task commit `9af22dd8e` is an ancestor of HEAD. Full verification passed: Studio spec 336/336, neighboring Key Rail specs 240/240, and `tsc --noEmit` clean.

---
*Phase: 58-rail-editing-regressions*
*Completed: 2026-11-03*
