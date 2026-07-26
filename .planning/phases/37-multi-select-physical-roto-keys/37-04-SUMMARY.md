---
phase: 37-multi-select-physical-roto-keys
plan: 04
subsystem: roto-timeline-ui
tags: [physics-paint, roto, selection, group-operations, timeline-ui, preact]

requires:
  - phase: 37-multi-select-physical-roto-keys
    plan: 01
    provides: move-key-group resolver intent, conflictingAppFrames failure data, movedKeyIds/grabbedKeyId drag metadata
  - phase: 37-multi-select-physical-roto-keys
    plan: 02
    provides: selectedKeyIds / selectionAnchorKeyId Studio signals, toggle/extend/collapse pure reducers, selectAllRotoKeys shared callback
  - phase: 37-multi-select-physical-roto-keys
    plan: 03
    provides: prepareRotoKeyGroupDrag / commitRotoKeyGroupDrag frozen-publication pair, canSelectAllKeys / selectAllKeysDisabledReason computeds, release-time publication contract owned by this plan
provides:
  - Strip selection gesture props (rotoSelectedKeyIds, onToggleRotoKeySelection, onExtendRotoKeySelection, onCollapseRotoSelectionToKey) with modifier-branch click handling — no navigation steal, no drag arming on modifiers (D-01/D-02/D-05, Pitfall 6)
  - Secondary selected cell treatment (.selected 2px #F2F5F7 outline, aria-selected, 'Selected key' tooltip composer) subordinate to the .current orange ring (D-04)
  - Group drag session reusing the UAT-hardened gesture mechanics with the 37-03 prepare/commit pair, moved-set preview, resolver-driven blocked-target preview, cannot-drop cursor, and exactly-once release-time reject publication (D-06..D-09, D-22)
  - Guarded Select All icon (ListChecks, 'All') at the end of the key-utilities pill after Delete (D-03, Pitfall 7)
affects: [37-05, 37-06]

tech-stack:
  added: []
  patterns:
    - "Modifier-click selection gestures branch before the navigate fallback and never arm a drag session; the pointer-down guard rejects modifier presses so a modifier-click is selection-only (Pitfall 6)"
    - "Group drag reuses the single-key gesture session byte-verbatim (threshold, pointer capture, edge-scroll, Escape, validity key); only the prepare/commit calls and failure-detail retention branch on session.groupDrag"
    - "Blocked-target preview renders only resolver-supplied conflictingAppFrames — the view never re-derives collision data (Pitfall 1)"
    - "Selection state lives only in controller signals; the strip receives the keyId set as a prop and emits keyId intents only (D-05)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "Group arming is decided at pointer-down from the controller selection prop: grabbed key in a >= 2 selection starts a group session; grabbing an unselected real key first collapses the selection to it and follows the unchanged single-key path (D-06)"
  - "Release-time reject publication fires only when session.groupDrag AND session.candidateDetail is non-null (a resolver-level reject); classification-level invalids (outside/locked) and single-key releases stay silent exactly as before (T-37-04-03)"
  - "Shift-click current-key anchor fallback is implemented at the Studio wiring layer (selectionAnchorKeyId ?? selectedKeyId) because the 37-02 range reducer returns unchanged state on a null anchor"
  - "The Select All icon shares the Studio selectAllRotoKeys callback with the Cmd/Ctrl+A dispatcher route so both paths produce exactly one 'All keys selected' feedback line per invocation (D-03)"

requirements-completed: [37-UI-INTEGRATION, 37-GROUP-DRAG, 37-SELECT-ALL, 37-MULTI-SELECT-IDENTITY]

coverage:
  - id: D1
    description: "Cmd/Ctrl-click toggles selection through the 37-02 reducer with zero navigation steal and zero drag arming; plain click collapses a >= 2 selection then navigates; generated/empty cells ignore selection gestures"
    requirement: 37-MULTI-SELECT-IDENTITY
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (exit 0) + navigate-count gate (2, unchanged) + modifier-guard greps + toggle trace derivation (below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Secondary selected cells render .selected + aria-selected + 'Selected key' tooltip while the current key keeps the strongest orange highlight; CSS uses the 36.15-09 z-index lift with unchanged geometry"
    requirement: 37-UI-INTEGRATION
    verification:
      - kind: other
        ref: "typecheck + presence greps (.selected CSS, getRotoCellSelectedTooltipCopy, aria-selected)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Group drag flows through the 37-03 prepare/commit pair with moved-set preview, resolver-supplied blocked cells plus cannot-drop cursor, and exactly-once release-time reject publication; single-key path provably unchanged"
    requirement: 37-GROUP-DRAG
    verification:
      - kind: other
        ref: "typecheck + greps (prepare/commit group pair = 1 each; single prepareRotoKeyDrag = 1; keydown listeners = 1; escaped selectors = 2) + GD-1/GD-2 derivations (below)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Select All sits guarded at the end of the key-utilities pill after Delete, consumes the 37-03 availability computeds, and shares one feedback line with Cmd/Ctrl+A; Shift-click range branch completes the D-01 gesture set"
    requirement: 37-SELECT-ALL
    verification:
      - kind: other
        ref: "typecheck + placement evidence (Key, Duplicate, Insert, Copy, Paste, Delete, All | Key spacing) + native-disabled gate (5 = baseline) + Shift+Arrow scan 0"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-26
status: complete
---

# Phase 37 Plan 04: Multi-Selection UI Integration in the Workflow Strip Summary

**Modifier-click / Shift-click / plain-click selection gestures wired from strip cells through the 37-02 reducers with no navigation steal and no drag arming on modifiers, the `.selected` secondary cell treatment with `Selected key` tooltip and aria-selected, the group drag session over the 37-03 prepare/commit pair with moved-set preview and resolver-driven blocked-target preview plus exactly-once release-time reject publication, and the guarded Select All icon at the end of the key-utilities pill — all single-key paths provably unchanged, typecheck green, zero test artifacts.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-26T21:20:32Z
- **Completed:** 2026-07-26T21:35:30Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Strip props gained `rotoSelectedKeyIds`, `onToggleRotoKeySelection`, `onExtendRotoKeySelection`, `onCollapseRotoSelectionToKey`, `onSelectAllRotoKeys`, and `onRotoGroupDragRejected` — all optional, so existing hosts compile unchanged; `RotoTimelineCellButton` forwards the click `MouseEvent` and renders `aria-selected` only when its new prop is true
- `handleRotoCellClick` branches modifiers before the navigate fallback: Cmd/Ctrl-click on a real-key cell toggles via the 37-02 reducer and returns (no navigation steal); Shift-click extends the anchor-to-target range and returns; plain click on a real key collapses a >= 2 selection first, then navigates exactly as before; generated/empty/non-editable cells skip every selection branch
- `handleRotoCellPointerDown` rejects modifier presses, so selection gestures never arm a drag session (Pitfall 6); the capture-phase Escape listener count is unchanged (1) and no listener was added anywhere (Pitfall 4)
- Secondary selected real-key cells render the new `.physics-paint-roto-cell.selected` class (2px `#F2F5F7` outline at 1px offset, z-index 1 lift mirroring `.current`), `aria-selected="true"`, the ` Selected.` aria-label suffix, and the new pure `getRotoCellSelectedTooltipCopy` composer (`Selected key` / `Selected key — {base}`); the current editing key keeps only its `.current` orange ring (D-04)
- Group drag session: grabbing a selected real key with a >= 2 selection arms a group session through the reused gesture mechanics; grabbing an unselected real key first collapses the selection and follows the byte-verbatim single-key path (D-06); `updateRotoDragCandidate` branches to `prepareRotoKeyGroupDrag` and retains `conflictingAppFrames` + `detail` on group preparation failure while publishing nothing at hover time (37-03 contract)
- Release path: signature-equality gate unchanged; group sessions commit through `commitRotoKeyGroupDrag` with the retained publication passed unchanged (D-09); a group release on a resolver-level invalid target fires `onRotoGroupDragRejected(reason, detail)` exactly once — the Studio routes the concise copy to the status capsule and the full detail to the console diagnostic channel (D-26, 36.15 D-15 arbitration)
- `getRotoDragPreviewViewModel` assigns role 'moved' to every identity in `drag.movedKeyIds` with the single-key `drag.movedKeyId` fallback — a pure re-projection of proposal cells, no legality derivation (D-22, Pitfall 2)
- Blocked-target preview: cells whose appFrame appears in the resolver-supplied `conflictingAppFrames` render `roto-drag-target-blocked` (destructive-family 1px dotted `rgba(255, 176, 184, 0.85)` outline over the existing invalid fade), and the grabbed key renders `roto-drag-cannot-drop` (`cursor: not-allowed`) while the group mapping is invalid (D-08); valid group drags keep the grabbing cursor and every green D-23 treatment
- Guarded Select All icon (`ListChecks` at size 18, visible label `All`, tooltip `Select all keys` via `buildGuardedActionTooltipCopy`) sits immediately after Delete inside the key-utilities pill and before the Key spacing form (Pitfall 7 placement); aria-disabled only with the sr-only verbatim controller reason, activation blocked before the controller call (36.15 D-28); availability consumes the 37-03 `canSelectAllKeys` / `selectAllKeysDisabledReason` computeds

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): end-to-end modifier-click selection** — `e01c2f6e` (feat)
2. **Task 2: group drag session + blocked-target preview + release-time reject publication** — `b9390f25` (feat)
3. **Task 3: Select All guarded icon + Shift-click range branch + plan-level gates** — `81bada54` (feat)

Tracer feedback gate (autonomous run): tracer `<verify>` re-run post-commit — all greps pass (with the documented object-literal adaptation), `pnpm --dir app typecheck` exit 0. Tracer verified end-to-end — expansion tasks proceeded.

## Wiring Derivations (static evidence)

Baseline: A@1, B@3, C@5, D@10 (physical frames).

**Task 1 toggle trace (selection {B}, current B; Cmd/Ctrl-click C's cell):** `RotoTimelineCellButton` forwards the MouseEvent -> `handleRotoCellClick(5, vm, event)`. The pointer-down guard rejected the modifier press, so no drag session exists and `suppressNextRotoClickRef` is false. C is a real key (not generated, editable) -> first branch skipped. `cellKeyId = keyIdByAppFrame.get(5) = 'C'`. `event.metaKey||ctrlKey` true, shift false -> `props.onToggleRotoKeySelection('C')` and RETURN — `onNavigateToSyncedFrame` is never called. Studio: `toggleRotoKeySelection({['B'], anchor 'B'}, ['A','B','C','D'], 'C', 'B')` -> C absent -> `{ selectedKeyIds: ['B','C'], anchorKeyId: 'C' }`, currentKeyId 'B' unchanged. Signals assigned -> strip prop -> `rotoSelectedKeyIdSet` {B,C} size 2 -> C's cell: in set, size >= 2, no 'current' overlay -> `isSecondarySelected` true -> `.selected` class + `aria-selected="true"` + `Selected key` tooltip + ` Selected.` aria suffix. B keeps `.current` (orange ring, `Real key` tooltip). A second Cmd/Ctrl-click on C -> toggle removes C -> remaining ['B'] non-empty -> size 1 -> `.selected` disappears everywhere. **Matches D-01/D-02/D-04/D-05 exactly.**

**GD-1 wiring (selection {B,C}, grab B, drop on empty frame 7):** pointer-down on B: no modifiers, drag eligible -> `selectedSet` {B,C} size 2 >= 2 and contains 'B' -> `groupDrag: true` on the session. Hover frame 7: classify -> valid `physical-cell` target -> `session.groupDrag` -> `prepareRotoKeyGroupDrag('B', { physical-cell, 7 })` -> 37-03 frozen publication (GD-1 map A@1, B@7, D@8, C@9; `movedKeyIds` ['B','C']). Preview carries `groupDrag: true`, conflicts null; `getRotoDragPreviewViewModel` builds `movedSet` {'B','C'} -> cells at 7 (B) and 9 (C) role 'moved', D at 8 role 'shifted', vacated 3/5 via the current-cell diff — complete-mapping preview with no new color (D-22/D-23). Release on frame 7: re-classify matches the retained target signature -> `commitRotoKeyGroupDrag(retainedPublication)` -> the 37-03 coherence checks pass -> coordinator accepts -> focus follows B at its accepted appFrame through the existing `cssEscape`-escaped selector (D-24). The moved group stays selected with B current via the 37-02 D-17 aftermath — the strip adds no selection-aftermath logic. **Matches the GD-1 locked mapping end-to-end.**

**GD-2 wiring (selection {B,C}, grab B, hover frame 6):** `prepareRotoKeyGroupDrag` fails with `duplicate-destination-frame`, `conflictingAppFrames: [8]`, reason `Move rejected — key in the way`, and the full resolver text as `detail`. The session retains `candidateConflicts: [8]` and `candidateDetail`; the preview renders `roto-drag-target-blocked` on the frame-8 cell (resolver-supplied only — Pitfall 1) and `roto-drag-cannot-drop` plus the existing invalid fade on the grabbed source cell (groupDrag && !candidateValid && isDragSource). Release: re-classify yields a valid target but the retained publication is null -> signature gate fails -> `session.groupDrag && session.candidateDetail !== null` -> `onRotoGroupDragRejected('Move rejected — key in the way', detail)` fires EXACTLY ONCE -> capsule shows the concise copy, console carries the full detail -> `restoreSourceFocus`, zero mutation, zero history entry. **Matches the GD-2 locked mapping and the UI-SPEC reject copy.**

## Plan-Level Gates (verbatim outputs)

- **Gate a — D-18:** `git status --porcelain` shows no `.test.` path (count 0; no test file created, modified, deleted, renamed, or executed; no vitest run; no dev server, browser, or native process launched).
- **Gate b — D-19 added-line scan:** `git diff -U0 850b8bc5 -- <four touched files> | grep -E '^\+' | grep -cE 'sourceFrame|displayFrame|inBetweenCount'` -> **0**.
- **Gate c — transaction-authority scan:** `git diff -U0 850b8bc5 -- PhysicsPaintWorkflowStrip.tsx | grep -E '^\+' | grep -c 'physicPaintBridge'` -> **0**.
- **Gate d — deferred-idea scan:** `grep -cE "shiftKey.*Arrow|Arrow(Left|Right).*shiftKey" PhysicsPaintWorkflowStrip.tsx` -> **0** (no Shift+Arrow keyboard range extension).
- **Safety invariants:** navigate-call count inside `handleRotoCellClick` = **2** (unchanged); `addEventListener('keydown'` count = **1** (unchanged, the existing capture-phase drag-cancel listener); `data-roto-key-id="${cssEscape` count = **2** (unchanged — no new unescaped selector); native `disabled=` count = **5** (unchanged from baseline 5; aria-disabled count 9 = baseline 8 + 1 for the new Select All icon).
- **Full typecheck:** `pnpm --dir app typecheck` -> exit 0 with all four files in final state.

## Select All Placement Evidence

Key-utilities pill ordering (icon labels in DOM order): **Key, Duplicate, Insert, Copy, Paste, Delete, All** — then the Key spacing form (`physics-paint-roto-force-spacing-controls`). Select All sits immediately after Delete inside the pill and before the Key spacing group (Pitfall 7). The Key spacing form and every other action-row control are byte-untouched: `git diff 850b8bc5 -- PhysicsPaintWorkflowStrip.tsx | grep -cE '^[-+].*force-spacing'` -> **0**.

## Flagged Assumption for 37-05 Native UAT (carried from 37-02)

**Shift-click current-transfer semantics (must_haves.assumptions):** shift-click makes the clicked key the current editing key, and toggle-out-of-the-current-key transfers current to the next selected key in identity order (previous-key fallback) — planner-defined interpretations of D-01/D-02/D-04 implemented in the 37-02 reducers and wired here exactly as defined. **Flagged for explicit confirmation at native UAT in plan 37-05. Not silently covered.** The three UI-SPEC backstop rows (blocked-preview distinctness, secondary-selected distinctness at 18px, action-row fit with the added icon) are also 37-05 native-UAT anchors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Interpretation] Studio wiring verify greps written as JSX patterns**
- **Found during:** Task 1 and Task 3 verification
- **Issue:** The plan's `<verify>` greps `rotoSelectedKeyIds={selectedKeyIds.value}` and `onSelectAllRotoKeys={selectAllRotoKeys}` in PhysicsPaintStudio.tsx, but the Studio composes the strip props through an object-literal view model (`workflow: {...}` in the view model, spread as `<PhysicsPaintWorkflowStrip {...workflow} />` in PhysicsPaintStudioView.tsx) — JSX attribute syntax cannot appear in an object literal, so the plan's patterns necessarily return 0 with correct wiring.
- **Fix:** Verified the semantically identical object-literal wiring instead: `rotoSelectedKeyIds: selectedKeyIds.value` (1) and `onSelectAllRotoKeys: selectAllRotoKeys` (1). The prop round-trip is unchanged — the view spreads the workflow object verbatim into the strip.
- **Files modified:** none (verification interpretation only)

**2. [Rule 1 - Interpretation] `disabled=` substring gate counts the required aria-disabled**
- **Found during:** Task 3 verification
- **Issue:** The plan's gate `grep -c "disabled="` must equal the pre-plan baseline (13), but the substring `disabled=` also matches inside `aria-disabled=`, and the new Select All icon's REQUIRED `aria-disabled` (36.15 D-28 guarded-control contract) increments the count 13 -> 14. The plan simultaneously mandates the aria-disabled attribute and the unchanged substring count — literally unsatisfiable.
- **Fix:** Applied the gate's stated intent ("no native disabled introduced anywhere in this plan"): native-only pattern `(^|[^a-zA-Z-])disabled=` returns **5** both before and after the plan; aria-disabled count 8 -> 9 (exactly +1 for the new icon). No native disabled attribute was introduced.
- **Files modified:** none (verification interpretation only)

**3. [Rule 3 - Blocking] Shift-click anchor fallback implemented at the wiring layer**
- **Found during:** Task 3
- **Issue:** The plan states "when selectionAnchorKeyId is null the reducer treats the current editing key as anchor (37-02 contract)", but the shipped 37-02 `extendRotoKeySelectionRange` returns unchanged state with a null current when the anchor is null — the fallback does not exist in the reducer.
- **Fix:** Implemented the fallback at the Studio wiring layer exactly per the plan's intent: the state passed to the reducer uses `selectionAnchorKeyId.peek() ?? selectedKeyId.peek()`, so a null anchor resolves to the current editing key before the reducer runs. No 37-02 module edit (out of this plan's file scope).
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Verification:** `pnpm --dir app typecheck` exit 0

---

**Total deviations:** 3 auto-fixed (2 verification-interpretation, 1 blocking-wiring)
**Impact on plan:** No scope creep; identical final behavior to the plan's intent; all gates green at every commit boundary.

## Issues Encountered

Only the deviation items above; all gesture, preview, and publication wiring matched the locked mappings on first derivation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **37-05** owns native UAT anchors: the D-01 gesture set (Cmd/Ctrl-toggle, Shift-range, plain-collapse), the three UI-SPEC backstops (blocked-preview destructive dotted outline + cannot-drop cursor distinctness; secondary-selected vs current vs drag-preview distinctness at 18px across semantic fills; action-row fit-content with the added All icon and unchanged 155px/18px geometry), Select All availability + shared status line, GD-1..GD-3 gesture-level flows, and the flagged shift-click current-transfer assumption.
- **37-06** owns post-UAT regression tests over the group presentation view model (blocked conflicts, moved-set roles) and selection-gesture wiring.
- No blockers.

## Self-Check: PASSED

- FOUND commit `e01c2f6e` (Task 1), `b9390f25` (Task 2), `81bada54` (Task 3)
- FOUND app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
- FOUND app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
- FOUND app/src/components/physic-paint/physicsPaintStudio.css
- FOUND app/src/components/physic-paint/PhysicsPaintStudio.tsx

---
*Phase: 37-multi-select-physical-roto-keys*
*Completed: 2026-07-26*
