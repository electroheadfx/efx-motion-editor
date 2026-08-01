---
phase: 37-multi-select-physical-roto-keys
plan: 03
subsystem: roto-timeline-action-bundle
tags: [physics-paint, roto, selection, group-operations, preact]

requires:
  - phase: 37-multi-select-physical-roto-keys
    plan: 01
    provides: move-key-group / delete-key-group / scoped force-spacing resolver intents, conflictingAppFrames failure data, group drag presentation metadata, lockstep wire/history allowlist admission
  - phase: 37-multi-select-physical-roto-keys
    plan: 02
    provides: controller-owned selectedKeyIds / selectionAnchorKeyId Studio signals, selectAllRotoKeys shared callback, Cmd/Ctrl+A dispatcher route
provides:
  - RotoTimelineActionsInput.getSelectedKeyIds + publishDiagnostic input ports (D-05 read-only selection port; D-26 detail leg)
  - prepareRotoKeyGroupDrag / commitRotoKeyGroupDrag — one frozen move-key-group publication through the acknowledged commit seam with zero recomputation (D-06..D-09)
  - Group-aware deleteRotoFrame: one shared delete-key-group transaction for every delete route with 'Keys deleted' copy (D-13)
  - Scope-aware applyForceSpacing per D-10 (>= 2 selected -> scopeKeyIds; else null = byte-identical 36.14 path) with 'Spacing rejected — not enough room' scoped reject copy
  - canSelectAllKeys / selectAllKeysDisabledReason computeds with three verbatim guarded reasons (D-03, 36.15 D-28)
  - 'All keys selected' status entry on the shared selectAllRotoKeys callback
affects: [37-04, 37-05, 37-06]

tech-stack:
  added: []
  patterns:
    - "Group operations reuse the single-key publication / opaque-retention / target-signature commit contract; the exact retained proposal object passes to executePhysicalEdit unchanged (D-09)"
    - "Selection set is only ever READ from the controller port (getSelectedKeyIds); never derived from frames, never mutated, never persisted or bridged (D-05)"
    - "Reject copy split per D-26: concise UI-SPEC text via publishStatus (capsule), full code + text via the new publishDiagnostic port"
    - "Prepare never publishes during the gesture; release-time reject publication is 37-04's gesture-timing contract"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "Fail-closed selection-set validation in prepareRotoKeyGroupDrag (size >= 2, bounded, unique, grabbed membership) is defense-in-depth; the 37-01 resolver remains the membership authority (T-37-03-01)"
  - "commitRotoKeyGroupDrag performs exactly four coherence checks (operation kind, grabbed match, moved-set shallow equality by index-wise identity, non-empty launch tuple); a stale or tampered publication returns false instead of committing an unseen mapping (T-37-03-02)"
  - "requiredKeyId stays null on the group delete runner call because the resolver's 'unknown-operation-identity' guard rejects absent/unknown members fail-closed"
  - "publishDiagnostic routes to console.error mirroring the coordinator's logDiagnostic style (PhysicsPaintStudio.tsx:448) — the retired-LOG-tab surviving diagnostic channel; flagged for 37-05 native-UAT confirmation"

requirements-completed: [37-GROUP-DRAG, 37-GROUP-DELETE, 37-GROUP-FORCE-SPACING, 37-ATOMIC-TRANSACTIONS, 37-SELECT-ALL]

coverage:
  - id: D1
    description: "prepareRotoKeyGroupDrag mirrors the single-key guard order, resolves one move-key-group intent, and returns one frozen publication; commit passes the retained publication unchanged with operationKind 'move-key-group' after four coherence checks"
    requirement: 37-GROUP-DRAG
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (exit 0) + acceptance greps + GD-1 wiring derivation (below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "deleteRotoFrame routes >= 2 selection to one delete-key-group transaction ('Keys deleted'); single-key path byte-identical; rejects publish capsule + diagnostic detail; both Studio delete routes untouched"
    requirement: 37-GROUP-DELETE
    verification:
      - kind: other
        ref: "typecheck + greps ('delete-key-group' >= 3, rotoPhysicalActions.deleteRotoFrame = 2 in Studio) + GDel-1 derivation (below)"
        status: pass
    human_judgment: false
  - id: D3
    description: "applyForceSpacing computes scopeKeyIds from selection size (D-10); scoped wall/capacity rejects publish 'Spacing rejected — not enough room' plus diagnostic detail; null scope byte-identical (GFS-3)"
    requirement: 37-GROUP-FORCE-SPACING
    verification:
      - kind: other
        ref: "typecheck + scopeKeyIds grep (3) + GFS-1/GFS-3 derivations (below)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every group operation flows through runPhysicalAction or the prepare/commit seam into the one generic executePhysicalEdit coordinator; authority scan proves zero direct bridge imports in added lines"
    requirement: 37-ATOMIC-TRANSACTIONS
    verification:
      - kind: other
        ref: "gate (c) transaction-authority scan = 0 + typecheck"
        status: pass
    human_judgment: false
  - id: D5
    description: "canSelectAllKeys / selectAllKeysDisabledReason derive from launch/pending/record-count with three verbatim reasons; 'All keys selected' publishes once per successful select-all invocation"
    requirement: 37-SELECT-ALL
    verification:
      - kind: other
        ref: "typecheck + greps (canSelectAllKeys = 4 hook file; 'All keys selected' = 1 Studio)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-26
status: complete
---

# Phase 37 Plan 03: Group Operations Wired into the Physical Timeline Action Bundle Summary

**Group drag prepare/commit pair (one frozen move-key-group publication through the acknowledged seam, zero recomputation), group-aware deleteRotoFrame sharing one transaction across every delete route, scope-aware applyForceSpacing per D-10, Select All availability computeds with verbatim guarded reasons, and D-26 reject routing (concise capsule copy + diagnostic detail) — all single-key paths provably unchanged, typecheck green, zero test artifacts.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-26T21:07:20Z
- **Completed:** 2026-07-26T21:22:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `RotoTimelineActionsInput` gained `getSelectedKeyIds?: () => readonly string[]` (read-only controller selection port, D-05) and `publishDiagnostic?: (message: string) => void` (D-26 detail leg); the Studio composition wires `getSelectedKeyIds: () => selectedKeyIds.value` and a console diagnostic mirroring the coordinator's `logDiagnostic` style
- `RotoDragPublication` gained optional frozen `movedKeyIds` (present on group publications, absent on single-key); the `RotoDragPreparationResult` failure branch gained optional `conflictingAppFrames` and `detail`
- `prepareRotoKeyGroupDrag` mirrors the single-key guard order exactly (launch -> ports -> pending -> bounded grabbed -> selection-set fail-closed -> unique grabbed record -> resolve -> no-change reject -> target signature -> frozen publication), builds the `move-key-group` intent with a frozen copied set, maps `duplicate-destination-frame` -> 'Move rejected — key in the way' and `over-capacity`/`out-of-range-frame` -> 'Move rejected — not enough room', and never calls publishStatus during the gesture (37-04 owns release-time publication)
- `commitRotoKeyGroupDrag` performs the four wrapper-coherence checks and hands the exact retained proposal to `executePhysicalEdit` with `operationKind: 'move-key-group'` — no resolver call, no cloning, no mapping recomputation (D-09)
- `deleteRotoFrame` is group-aware: selection size >= 2 routes one `delete-key-group` intent (frozen keyId set, `requiredKeyId: null`, success 'Keys deleted'); < 2 executes the pre-task single-key body verbatim; both Studio delete route references (keyboard dispatcher and strip prop) are byte-untouched (D-13)
- `runPhysicalAction` adds the `publishDiagnostic` detail leg ONLY for `delete-key-group` rejects; every other kind's published output is unchanged (D-26)
- `applyForceSpacing` computes `scopeKeyIds` from the controller selection set (>= 2 -> frozen set; else null) and adds it to the existing force-spacing intent; scoped wall/capacity rejects publish 'Spacing rejected — not enough room' via publishStatus plus full detail via publishDiagnostic; null-scope behavior is byte-identical to 36.14 (GFS-3); the no-change and success branches are unchanged for both scopes (D-10..D-12)
- `canSelectAllKeys` / `selectAllKeysDisabledReason` computeds derive Select All availability from launch presence, idle pending state, and at least one real key record, with the three verbatim guarded reasons; availability stays eligible when every key is already selected (idempotent Select All)
- The Studio `selectAllRotoKeys` callback publishes 'All keys selected' via `setApplyMessage` on the successful path only; toggle/range/collapse paths publish nothing (UI-SPEC status contract)

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): end-to-end group drag wiring** — `2b1ab3d4` (feat)
2. **Task 2: group-aware deleteRotoFrame + scope-aware applyForceSpacing** — `77f3130e` (feat)
3. **Task 3: Select All availability computeds + 'All keys selected' status entry + plan-level gates** — `6c5d3fad` (feat)
4. **Formatting restoration (deviation fix)** — `5bd19577` (style)

Tracer feedback gate (autonomous run): tracer `<verify>` re-run post-commit — all greps pass, `pnpm --dir app typecheck` exit 0. Tracer verified end-to-end — expansion tasks proceeded.

## Locked-Mapping Wiring Derivations (static evidence)

Baseline for all mappings: A@1, B@3, C@5, D@10 (physical frames); selection {B,C}; grab B.

- **GD-1 wiring (group drag accept, target physical-cell 7):** `prepareRotoKeyGroupDrag('B', { kind: 'physical-cell', appFrame: 7 })` — launch present; ports present; no pending; `'B'` bounded; `getSelectedKeyIds()` -> `['B','C']`: length 2 >= 2, contains `'B'`, all bounded and unique -> passes fail-closed validation; records contain B exactly once; `movedKeyIds = Object.freeze(['B','C'])`; resolver intent `{ kind: 'move-key-group', movedKeyIds: ['B','C'], grabbedKeyId: 'B', target: { physical-cell, 7 } }` reaches the 37-01 resolver, which produces the GD-1 map (A@1, B@7, D@8, C@9) with `selectedKeyId = B` and drag metadata `movedKeyIds ['B','C']` / `grabbedKeyId 'B'`; `status.changed` true -> one frozen publication with `movedKeyId: 'B'`, the same frozen `movedKeyIds` array, target signature `{ physical-cell, 7, null }`, and `proposalVersion` from the physical content revision plus launch tuple. `commitRotoKeyGroupDrag(publication)`: executePhysicalEdit present; `proposal.status.operationKind === 'move-key-group'`; `drag.movedKeyId 'B' === publication.movedKeyId 'B'`; `publication.movedKeyIds` shallow-equals `drag.movedKeyIds` (length 2, index-wise identity); launch tuple non-empty -> `executePhysicalEdit({ proposal: publication.proposal, expectedLaunch: publication.expectedLaunch, operationKind: 'move-key-group', selectedKeyId: proposal.selectedKeyId, selectedAppFrame: proposal.selectedAppFrame })` — the exact retained objects, zero recomputation -> coordinator -> exact parent ack -> one accepted-only history entry through the 37-01-extended `isOrdinaryOperationKind` guard. **Matches the GD-1 locked mapping end-to-end.**
- **GDel-1 wiring (group delete, set {B,C}):** `deleteRotoFrame()` reads `getSelectedKeyIds()` -> `['B','C']`, length 2 >= 2 -> one `runPhysicalAction({ intent: { kind: 'delete-key-group', keyIds: Object.freeze(['B','C']) }, operationKind: 'delete-key-group', requiredKeyId: null, successMessage: 'Keys deleted' })`. Guards pass; the 37-01 resolver produces the GDel-1 proposal (A@1, D@8, survivor `selectedKeyId = D`, `removedKeyIds = [B,C]`); one coordinator execution -> accepted -> `publishStatus('Keys deleted')`; exactly one accepted history entry. Both delete routes — the Backspace/Delete keyboard dispatcher wiring and the strip `onDeleteRotoFrame` prop — already reference this one bundle action and are byte-untouched (`grep -c "rotoPhysicalActions.deleteRotoFrame"` on the Studio = 2). Reject leg: `publishStatus(resolution.failure.text)` plus `publishDiagnostic('delete-key-group rejected: ' + code + ' — ' + text)`. **Matches the GDel-1 locked mapping and the D-13 shared-transaction requirement.**
- **GFS-1 wiring (scoped Force Spacing accept, set {B,C}, N=2):** `applyForceSpacing()` — after the records snapshot, `getSelectedKeyIds()` -> `['B','C']`, length >= 2 -> `scopeKeyIds = Object.freeze(['B','C'])`; intent `{ kind: 'force-spacing', emptyFrames: 2, selectedKeyId, scopeKeyIds: ['B','C'] }` -> the 37-01 resolver anchors earliest selected B@3 and maps C -> 6 (GFS-1 map A@1, B@3, C@6, D@10); success publishes `proposal.status.text` unchanged after acceptance. **Matches the GFS-1 locked mapping.**
- **GFS-3 wiring (single selection -> full timeline):** selection size < 2 -> `scopeKeyIds = null`; intent carries `scopeKeyIds: null`, which the resolver treats as the untouched 36.14 full-timeline path (A@1, B@4, C@7, D@10 for N=2); the failure branch publishes exactly what it published pre-task (raw failure text via publishStatus, no diagnostic call). **GFS-3 byte-identical behavior preserved.**

## Plan-Level Gates (verbatim outputs)

- **Gate a — D-18:** `git status --porcelain` shows no `.test.` path (`D-18 OK`; no test file created, modified, deleted, renamed, or executed; no vitest run; no dev server).
- **Gate b — D-19 added-line scan:** `git diff -U0 -- app/src/components/physic-paint/hooks/useRotoTimelineActions.ts app/src/components/physic-paint/PhysicsPaintStudio.tsx | grep -E '^\+' | grep -cE 'sourceFrame|displayFrame|inBetweenCount'` -> **0**.
- **Gate c — transaction-authority scan:** `git diff -U0 -- app/src/components/physic-paint/hooks/useRotoTimelineActions.ts | grep -E '^\+' | grep -c 'physicPaintBridge'` -> **0** (no direct bridge import or send added; every group op flows through runPhysicalAction or the prepare/commit seam into the one generic coordinator).
- **Gate d — full typecheck:** `pnpm --dir app typecheck` -> exit 0 with all plan edits in final state.
- **View-layer confirmation:** `git status --porcelain | grep 'view/'` -> no output (no strip/view file touched; strip integration is 37-04). Final porcelain: clean.

## Flagged Assumption for 37-05 Native UAT

**LOG routing surface (must_haves.assumptions):** 36.15-11 retired the right-panel LOG tab, so 36.14 D-26's 'detail goes to LOG' leg routes through the surviving diagnostic channel — the new optional `publishDiagnostic` input port wired in the Studio to `console.error('[PhysicsPaintStudio] physical edit:', message)`, mirroring the coordinator's `logDiagnostic` style (PhysicsPaintStudio.tsx:448). No new LOG surface was built. **Flagged for native-UAT confirmation in 37-05.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inadvertent line-join in computeForceSpacingAvailability during Task 3 edits**
- **Found during:** Task 3 (post-commit review)
- **Issue:** An intermediate edit collapsed the newline between the `computeForceSpacingAvailability` signature line and its first return statement, leaving two statements on one line (valid TS, but a formatting change to an untouched pre-existing function).
- **Fix:** Restored the exact pre-plan newline; verified `git diff 850b8bc5 -- useRotoTimelineActions.ts` shows no change at `computeForceSpacingAvailability`.
- **Files modified:** app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
- **Verification:** `pnpm --dir app typecheck` exit 0; diff-vs-pre-plan grep empty
- **Commit:** `5bd19577` (style)

---

**Total deviations:** 1 auto-fixed (formatting bug introduced and repaired within the plan; net diff at the function is zero)
**Impact on plan:** None — final state matches the plan's intent exactly; all gates green at every commit boundary.

## Issues Encountered

Only the formatting issue above; all wiring matched the locked mappings on first derivation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **37-04** consumes: the prepare/commit group drag pair for the strip group drag session; `conflictingAppFrames` + `detail` on preparation failures for the blocked-target preview; release-reject publication of the returned reason (gesture-timing contract documented in Task 1); `canSelectAllKeys` / `selectAllKeysDisabledReason` for the Select All guarded icon, which calls the shared Studio `selectAllRotoKeys` callback.
- **37-05** owns native UAT anchors GD-1..GD-3 (drag wiring), GDel-1/GDel-2 (shared delete transaction), GFS-1..GFS-3 (scoped spacing), Select All availability + status entry, plus the flagged retired-LOG-tab diagnostic-routing assumption.
- **37-06** owns post-UAT regression tests over preparation/commit wiring and availability derivation.
- No blockers.

## Self-Check: PASSED

- FOUND commit `2b1ab3d4` (Task 1), `77f3130e` (Task 2), `6c5d3fad` (Task 3), `5bd19577` (style fix)
- FOUND app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
- FOUND app/src/components/physic-paint/PhysicsPaintStudio.tsx

---
*Phase: 37-multi-select-physical-roto-keys*
*Completed: 2026-07-26*
