---
phase: 37-multi-select-physical-roto-keys
plan: 02
subsystem: roto-multi-selection
tags: [physics-paint, roto, selection, signals, preact]

requires:
  - phase: 37-multi-select-physical-roto-keys
    plan: 01
    provides: group operation kinds ('move-key-group', 'delete-key-group', scoped 'force-spacing') admitted through the resolver/wire/history allowlists — the D-17 aftermath resolver keys on these literals
provides:
  - RotoKeySelectionState type (selectedKeyIds + anchorKeyId), pure keyId-only
  - selectAllRotoKeyIds / collapseRotoKeySelection / toggleRotoKeySelection / extendRotoKeySelectionRange pure reducers (fail-closed membership validation)
  - resolvePostAcceptanceRotoSelection (D-17 aftermath, plain-string kind parameter)
  - selectedKeyIds / selectionAnchorKeyId session-local Studio Signals (Pattern 5; never persisted, never bridged)
  - selectAllRotoKeys / collapseRotoSelection Studio controller actions
  - Escape-collapse and strip-focus-scoped Cmd/Ctrl+A keyboard dispatcher branches
affects: [37-03, 37-04, 37-05]

tech-stack:
  added: []
  patterns:
    - "Multi-selection state at the controller boundary: Studio-owned Signals beside selectedKeyId, keyId-only identity, session-local, never in the view, never across the bridge (Pattern 5; D-02/D-05)"
    - "Pure selection-reducer module with zero Preact/store imports; reducers validate membership against the store-ordered real-key identity list fail-closed"
    - "D-17 post-acceptance aftermath keyed on a plain-string operation kind so the module compiles standalone before the union extension"
    - "Keyboard dispatcher branches behind optional action callbacks; no new listeners, strip-focus scoping for Cmd/Ctrl+A (Pitfalls 4/5)"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts

key-decisions:
  - "Final exported names match the plan's discretion names exactly: RotoKeySelectionState, selectAllRotoKeyIds, collapseRotoKeySelection, toggleRotoKeySelection, extendRotoKeySelectionRange, resolvePostAcceptanceRotoSelection; Studio signals selectedKeyIds / selectionAnchorKeyId; actions selectAllRotoKeys / collapseRotoSelection"
  - "Toggle-removal that would empty the set is a no-op (equivalent to 'keep the current key' whenever the current key is the sole member); toggle-out-of-current transfers current to the next selected key in identity order with previous-key fallback; anchor loss falls back to the current key"
  - "Cmd/Ctrl+A dispatcher branch and selectAllRotoKeys wiring were committed inside the tracer commit (Rule 3): noUnusedLocals forbids an unreferenced callback at the Task-1 scoped-tsc gate, and the keyboard path is the tracer's natural end-to-end select-all trigger in wave 1"

requirements-completed: [37-MULTI-SELECT-IDENTITY, 37-SELECT-ALL]

coverage:
  - id: D1
    description: "Select-all over the store-ordered real-key identity set yields every keyId in physical-frame order; empty input yields an empty selection and never fabricates an identity (D-03/D-05)"
    requirement: 37-SELECT-ALL
    verification:
      - kind: other
        ref: "scoped tsc (zero new errors vs baseline) + acceptance greps (selectedKeyIds/selectionAnchorKeyId >= 2 in Studio; export selectAll present; purity greps 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Toggle/collapse/extend reducers are pure, keyId-only, fail-closed; collapse never empties while a real key exists; range extension is anchor-stable and contiguous over the identity list (D-01/D-02)"
    requirement: 37-MULTI-SELECT-IDENTITY
    verification:
      - kind: other
        ref: "scoped tsc + greps (export collapse|toggle|extend >= 3; launch-reset and consumeBridgeApplyResult selectedKeyIds.value assignments present)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-17 aftermath applied at the accepted-output seam; launch replacement resets set + anchor in both branches; Escape-collapse and strip-scoped Cmd/Ctrl+A wired with mutation-lock and focus guards"
    requirement: 37-MULTI-SELECT-IDENTITY
    verification:
      - kind: other
        ref: "scoped tsc + greps (resolvePostAcceptanceRotoSelection call site; 'move-key-group'/'delete-key-group' literals; Escape branch; closest('.physics-paint-workflow-strip'); addEventListener count 0)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-26
status: complete
---

# Phase 37 Plan 02: Multi-Selection State Layer at the Studio Controller Boundary Summary

**Pure keyId-only selection-reducer module plus session-local `selectedKeyIds`/`selectionAnchorKeyId` Signals at the Studio controller boundary, with launch-replacement reset, the D-17 post-acceptance aftermath rules, and Escape-collapse / strip-scoped Cmd/Ctrl+A keyboard branches — the selection model every 37-03/37-04 group operation reads.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-26T20:52:32Z
- **Completed:** 2026-07-26T21:02:12Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `physicsPaintRotoMultiSelection.ts`: pure module (zero Preact/store imports) exporting `RotoKeySelectionState`, `selectAllRotoKeyIds`, `collapseRotoKeySelection`, `toggleRotoKeySelection`, `extendRotoKeySelectionRange`, and `resolvePostAcceptanceRotoSelection`; every reducer validates membership against the ordered real-key identity list fail-closed (T-37-02-01)
- Studio signals `selectedKeyIds` / `selectionAnchorKeyId` beside `selectedKeyId` (Pattern 5): session-local, never persisted, never bridged; `PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS` untouched in all touched files (T-37-02-02)
- Launch-replacement reset extended in both `setLaunchContext` branches (operationId/layerId change and startFrame re-derivation) so a replaced launch never inherits a stale set or anchor
- D-17 aftermath at `consumeBridgeApplyResult`: `move-key-group` keeps the set and re-anchors to the grabbed key, `force-spacing` keeps the set (keyIds survive retiming), `delete-key-group` and every other kind collapse to the accepted `selectedKeyId`; plain-string kind parameter for wave-1 standalone compile
- Keyboard: Escape-collapse (no modifiers, no repeat, bubble-phase only — drag capture listener keeps precedence, Pitfall 4) and Cmd/Ctrl+A scoped to `.physics-paint-workflow-strip` focus with `mutationLocked` guard (Pitfall 5); zero new `addEventListener`

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): end-to-end select-all** — `1c65182c` (feat): pure module (state type + select-all reducer), Studio signals + `selectAllRotoKeys` callback, Cmd/Ctrl+A dispatcher branch + wiring
2. **Task 2: collapse/toggle/extend reducers, launch reset, D-17 aftermath** — `bc62aeb8` (feat)
3. **Task 3: Escape-collapse dispatcher branch with Studio wiring** — `ed823168` (feat)

Tracer feedback gate (autonomous run): tracer `<verify>` re-run post-commit — scoped tsc filtered output empty (identical to baseline), all acceptance greps pass. Tracer verified end-to-end — expansion tasks proceeded.

## tsc Baseline vs Final (scoped gate)

- **Baseline (pre-plan):** `tsc --noEmit 2>&1 | grep -E 'physicsPaintRotoMultiSelection\.ts|PhysicsPaintStudio\.tsx|physicsPaintStudioKeyboard\.ts'` → empty (grep exit 1); full-project `tsc --noEmit` exit 0.
- **Final (post-plan):** identical — filtered output empty, full-project exit 0. Zero new type errors in touched files at every task boundary.

## Exported Symbol Names (final)

All names match the plan's discretion names — no renames: `RotoKeySelectionState`, `selectAllRotoKeyIds`, `collapseRotoKeySelection`, `toggleRotoKeySelection`, `extendRotoKeySelectionRange`, `resolvePostAcceptanceRotoSelection`, plus `RotoKeySelectionCurrentResult` (toggle/extend result carrying the resolved current keyId). Studio signals: `selectedKeyIds`, `selectionAnchorKeyId`. Studio actions: `selectAllRotoKeys`, `collapseRotoSelection`. Keyboard action members: `selectAllRotoKeys?`, `collapseRotoSelection?`.

## Pending Native-UAT Confirmation (flagged UNRESOLVED probe assumption)

Per the plan's `must_haves.assumptions`: the toggle-out-of-the-current-editing-key transfer semantics (current moves to the next selected key in frame order, falling back to previous; removal no-ops when it would empty the set) and shift-click making the clicked key the current editing key are planner-defined interpretations of D-01/D-02/D-04, implemented exactly as specified here and **flagged for explicit confirmation at native UAT in plan 37-05**. Not silently covered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cmd/Ctrl+A branch and `selectAllRotoKeys` wiring committed inside the tracer commit**
- **Found during:** Task 1 (tracer)
- **Issue:** The plan assigns the keyboard routing of `selectAllRotoKeys` to Task 3, but `app/tsconfig.json` sets `noUnusedLocals: true` — an unreferenced `selectAllRotoKeys` callback at the Task-1 commit would fail the scoped tsc gate ("declared but its value is never read").
- **Fix:** Wired the end-to-end select-all path in the tracer commit (keyboard interface member `selectAllRotoKeys?` + strip-focus-scoped Cmd/Ctrl+A branch + Studio actions wiring). This is the tracer's natural end-to-end trigger in wave 1 (the strip icon arrives in 37-04). Task 3 retained the Escape-collapse branch, the `collapseRotoSelection?` member, and its Studio wiring; every Task-3 acceptance grep still passes (file-level counts satisfied).
- **Files modified:** app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts (in the tracer commit, beyond the task's listed files)
- **Verification:** scoped tsc filtered output identical to baseline at all three task boundaries; Task 3 acceptance greps re-run and passing
- **Committed in:** `1c65182c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking-sequencing)
**Impact on plan:** No scope creep; identical final state to the plan's intent; all gates green at every commit boundary.

## D-18 / D-19 / Boundary Gates

- **D-18:** `git status --porcelain` shows no `.test.` path. No test file was created, modified, deleted, renamed, or executed; verification was bounded static checks plus scoped typecheck only. No vitest run, no dev server.
- **D-19 identity hygiene:** `sourceFrame|displayFrame` count in the new module: 0. No compatibility shims, aliases, dual-write paths, or additional timing authority introduced.
- **Purity:** `from '(@preact/signals|preact)` count in the new module: 0.
- **Boundary:** `PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS` count in all three touched files: 0 (baseline 0 — allowlist untouched); no persistence/bridge call references the set. `addEventListener` count in the dispatcher: 0 (Pitfall 4).
- **Deferred ideas respected:** no Shift+Arrow range extension, no group Duplicate, no group Copy/Paste.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes beyond the plan's threat model. All four register mitigations (T-37-02-01..04) implemented as specified.

## Issues Encountered

Only the noUnusedLocals sequencing issue above; otherwise all reducers and branches landed clean on first pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 37-03 consumes `selectedKeyIds`/`selectionAnchorKeyId` for group drag/delete/scoped force-spacing availability and dispatch; the D-17 aftermath already keys on the group-kind literals 37-01 admitted.
- 37-04 consumes the reducers for Cmd/Ctrl-click toggle, Shift-click range extension, and plain-click collapse in the strip, plus the `selectAllRotoKeys` shared entry point for the Select All icon (`RotoKeySelectionCurrentResult.currentKeyId` syncs `selectedKeyId` on toggle/extend).
- 37-05 owns native UAT, including the flagged toggle/shift-click current-transfer probe assumption.
- No blockers.

## Self-Check: PASSED

- FOUND commit `1c65182c` (Task 1), `bc62aeb8` (Task 2), `ed823168` (Task 3)
- FOUND app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts
- FOUND app/src/components/physic-paint/PhysicsPaintStudio.tsx
- FOUND app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts

---
*Phase: 37-multi-select-physical-roto-keys*
*Completed: 2026-07-26*
