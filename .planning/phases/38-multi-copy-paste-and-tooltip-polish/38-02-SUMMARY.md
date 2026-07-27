---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 02
subsystem: ui
tags: [physics-paint, roto, group-paste, acknowledged-transactions, stable-identity, typescript]

requires:
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 01
    provides: RotoSessionCopiedGroupEntry structural seam {payload, sourceAppFrame, sourceKeyId} in the shared clipboard slot
  - phase: 36.14-physics-paint-roto-timeline-ui-from-pencil
    provides: five-owner semantic-operation seam (types/resolver/coordinator/bridge/history) and the 36.14-20 Duplicate/Paste protocol this plan clones
provides:
  - 'paste-key-group' literal through all five semantic-seam owners (types 5 sites, resolver 5+ sites, coordinator equality/routing/retargeting, bridge validation branch, history automatic via Exclude)
  - createPhysicPaintRotoPasteKeyGroupIntent(destinationAppFrame, entries) — throw-on-malformed factory, >= 2 entries, fresh keyIds minted exactly once, deep-frozen intent; the compile-only contract plan 38-04 consumes
  - Group candidate builder: anchor = min sourceAppFrame, dest_i = destination + relative offset, all-empty-or-reject via existing codes (duplicate-destination-frame / over-capacity / out-of-range-frame), zero ripple, earliest pasted key selected
  - Shared validator paste-key-group branch re-run identically at resolver, coordinator staging, and parent bridge boundaries (T-38-01/T-38-03)
affects: [38-04 group paste route, 38-06 native UAT]

tech-stack:
  added: []
  patterns:
    - "Group paste is a semantic (record-carrying) operation exactly like paste-key: one intent, one proposal, one transaction, one history entry — no per-key execute loop"
    - "All-empty-or-reject atomic collision policy (D-05): any occupied or mutually colliding computed destination rejects the whole proposal with zero partial mutation; the group candidate never replaces or ripples an existing record"
    - "Fresh keyIds allocated ONCE in the intent factory and never re-minted downstream; the candidate builder and staged-records builder only consume them"
    - "Structural-type seam at the resolver boundary: entry input shape {payload, sourceAppFrame, sourceKeyId} declared locally; no import from the session module (wave-1 contract with 38-01)"

key-files:
  created: []
  modified:
    - app/src/types/physicPaint.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/lib/physicPaintBridge.ts

key-decisions:
  - "D-04/D-06 honored: earliest copied key anchors the group at the paste destination; relative physical offsets derive from source appFrames at resolve time (no offset table in intent or delta, D-03); placement is exact frames with zero ripple of existing keys"
  - "D-05 honored (reversibility: costly): all-empty-or-reject collision policy reusing the existing failure-code vocabulary; no replace-style group paste, no occupied-destination overwrite"
  - "D-07 by construction: history owner required ZERO edits — Exclude<PhysicPaintRotoPhysicalEditOperationKind, 'undo' | 'redo'> picks up the literal from the types union; one executePhysicalEdit acceptance = one immutable command"
  - "Tracer feedback gate resolved as automated: plan frontmatter is autonomous:true with no checkpoint tasks, the tracer <verify> is fully automated (typecheck + grep gates, all green), and live end-to-end UAT is explicitly owned by plan 38-06 (same resolution as 38-01)"
  - "Pitfall 1 closed: semanticDeltaEquals gained an explicit per-entry paste-key-group branch in place — without it exact parent acknowledgement would never match and every group paste would silently roll back"

patterns-established:
  - "Group semantic delta declares {destinationAppFrame, entries[payload, sourceAppFrame, sourceKeyId, newKeyId]}; the SAME declared delta is proven at all three boundaries (resolver build, coordinator staging :892-908, bridge :652-663)"
  - "Coordinator staged-records builder resolves group entry payloads by newKeyId lookup and retargets through the canonical clonePayloadAtFrame — never a manual copy"

requirements-completed: [38-GROUP-PASTE]

coverage:
  - id: D1
    description: "Group paste accept path: anchor = min sourceAppFrame, relative offsets from source appFrames, exact frames, zero ripple, fresh keyIds, earliest pasted key selected, one accepted transaction"
    requirement: 38-GROUP-PASTE
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (green) + grep gates: 'paste-key-group' types=5 resolver=17 coordinator=3 bridge=1 history=0; factory export == 1; createPhysicPaintRotoKeyId 3 -> 4"
        status: pass
    human_judgment: true
    rationale: "The paste-key-group intent is compile-only after this plan (no production caller); live accept/reject behavior is user-owned native UAT in plan 38-06 per D-15 and the plan's verification section"
  - id: D2
    description: "Group paste reject paths: occupied/mutually-colliding/out-of-range/over-capacity computed destinations fail closed atomically reusing duplicate-destination-frame, over-capacity, out-of-range-frame; no new failure-code vocabulary"
    requirement: 38-GROUP-PASTE
    verification:
      - kind: other
        ref: "failure-code grep 19 -> 23 (reused codes only); typecheck green"
        status: pass
    human_judgment: true
    rationale: "Atomic rejection is proven by construction plus typecheck; live confirmation deferred to plan 38-06 native UAT"
  - id: D3
    description: "Three-boundary semantic validation and Pitfall-1 equality: resolver declares one frozen semanticDelta, coordinator revalidates before staging and matches exact parent acknowledgement via the new semanticDeltaEquals group branch, bridge independently revalidates before mutation; history needs no edit (D-07)"
    requirement: 38-GROUP-PASTE
    verification:
      - kind: other
        ref: "grep gates: coordinator 'paste-key-group' >= 2 (got 3), bridge >= 1, history == 0; authority hygiene counts unchanged (semanticDeltaEquals 2, executePhysicalEdit 3, bridge validator 2, history Exclude< 1)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-27
status: complete
---

# Phase 38 Plan 02: Group Paste — Semantic Seam Propagation Summary

**The `paste-key-group` literal now flows through all five owners of the 36.14-20 semantic-operation seam — shared types, pure resolver (intent/factory/candidate/validator/dispatch), coordinator (equality/routing/retargeting), parent bridge (validation branch), and history (automatic via Exclude) — so a group of copied real Roto keys resolves as one atomic, thrice-validated, accepted-only transaction with anchor/offset math, all-empty-or-reject collisions, and zero ripple**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-27T14:46:23Z
- **Completed:** 2026-07-27T15:01:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Shared types (`app/src/types/physicPaint.ts`, 5 sites): `'paste-key-group'` added to the operation-kind union, the semantic-delta union (entries carry `{payload, sourceAppFrame, sourceKeyId, newKeyId}`), the operation-kind validator, a fail-closed `hasOnlyKeys` delta-validator branch (entries length >= 2, per-entry payload/frame/bounded-keyId checks), and the semantic-op routing set so the delta is REQUIRED for this kind
- Resolver (`physicsPaintRotoPhysicalResolver.ts`): frozen intent union member with the structural `{payload, sourceAppFrame, sourceKeyId}` entry input declared locally (no session-module import — wave-1 seam with 38-01); new export `createPhysicPaintRotoPasteKeyGroupIntent(destinationAppFrame, entries)` that throws on malformed input, requires >= 2 entries, mints ONE fresh `createPhysicPaintRotoKeyId()` per entry in the factory, and deep-freezes intent + entries
- Group candidate builder: `anchor = min(sourceAppFrame)`, `dest_i = destinationAppFrame + (sourceAppFrame_i - anchor)`; atomic closed failures in plan order (range -> `out-of-range-frame`, capacity -> `over-capacity`, occupied/colliding -> `duplicate-destination-frame` with sorted `conflictingAppFrames`); on accept pushes N frozen records with payloads retargeted via `clonePayloadAtFrame`, selects the earliest pasted key's fresh keyId, and emits complete frozen `nextRecords` + `semanticDelta`
- Shared validator: `operationKind` input widened to `'duplicate-key' | 'paste-key' | 'paste-key-group'` plus a group branch proving nextRecords = currentRecords + exactly the N declared fresh identities at computed destinations with retargeted payloads, no existing record changed, entries match fresh records one-for-one, and selection is the anchor entry's fresh keyId at the destination
- Coordinator (`useRotoPhysicalEditCoordinator.ts`): explicit per-entry `paste-key-group` branch in `semanticDeltaEquals` (Pitfall 1 — the plan's most fragile link), `'paste-key-group'` added to `isSemanticOrdinary` routing, and per-entry payload resolution by `newKeyId` in `buildStagedRecords` retargeted through the canonical `clonePayloadAtFrame`; single-paste retargeting behavior byte-identical
- Bridge (`physicPaintBridge.ts:652`): `'paste-key-group'` added to the semantic-validation branch condition so the parent independently re-proves the SAME declared delta against authoritative records before any store mutation (T-38-03)
- History (`useRotoPhysicalEditHistory.ts`): verify-only — `Exclude<PhysicPaintRotoPhysicalEditOperationKind, 'undo' | 'redo'>` picks up the literal automatically; zero edits landed (D-07 by construction)

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end pure seam — shared types literal + resolver intent/factory/candidate/validator/dispatch** - `08264914` (feat)
2. **Task 2: Coordinator equality/routing/retargeting + bridge validation branch + history literal verify** - `a5a826c4` (feat)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/types/physicPaint.ts` — 5 fail-closed literal sites (union, delta union, kind validator, delta validator branch, routing set)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — intent member, local operation-kind union, factory, group candidate builder, validator input widening + group branch, `isResolverOperationKind`, dispatch branch
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` — `semanticDeltaEquals` group branch, `isSemanticOrdinary` routing, per-entry payload retargeting
- `app/src/lib/physicPaintBridge.ts` — semantic-validation branch condition

## Decisions Made

- Exported symbol names used (Claude's discretion per 38-CONTEXT.md, matching the plan's contract names exactly): `createPhysicPaintRotoPasteKeyGroupIntent` (factory) and `buildPasteKeyGroupCandidate` (internal candidate builder, not exported).
- Reject-check ordering inside the group candidate builder follows the plan's vocabulary order: range (`out-of-range-frame`) -> capacity (`over-capacity`) -> occupancy/collision (`duplicate-destination-frame`); the capacity check precedes collision so it remains reachable under the pigeonhole principle.
- The group candidate passes sorted `conflictingAppFrames` to `fail('duplicate-destination-frame', ...)`, reusing the Phase 37 blocked-target preview metadata channel.
- Tracer feedback gate resolved as automated per the 38-01 precedent: `autonomous: true`, no checkpoint tasks, fully automated `<verify>`, live UAT owned by plan 38-06.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's scoped tsc verify command is vacuous in this environment; canonical typecheck script used instead**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<verify>` runs `cd app && pnpm exec tsc --noEmit 2>&1 | grep -E '<files>'`. In this environment `pnpm exec tsc --noEmit` prints the tsc help banner (argument-forwarding failure) instead of compiling, so the filtered grep is vacuously empty both before and after the task — the gate cannot detect errors as written.
- **Fix:** Used the app's canonical typecheck script `pnpm --dir app typecheck` (which runs the identical `tsc --noEmit` through the app package.json, the same gate 38-01 used). Full-project typecheck is GREEN after each task (exit 0, zero errors), which satisfies the scoped "filtered output identical to baseline" criterion a fortiori — zero errors anywhere means zero errors in touched files. The vacuous baseline (empty) and the vacuous post-task filter (empty) were also formally identical.
- **Files modified:** none (verification methodology only)
- **Verification:** `pnpm --dir app typecheck` exit 0 after Task 1 and again after Task 2
- **Committed in:** verified before `08264914` (Task 1) and `a5a826c4` (Task 2)

---

**Total deviations:** 1 (verification-command correction; no production behavior change)
**Impact on plan:** None on scope or behavior — the verify intent ("no new type errors attributable to touched files") is satisfied and proven by a strictly stronger green project-wide typecheck.

## Issues Encountered

None beyond the verification-command deviation above. All grep acceptance gates matched the plan's expected counts on the first run (types 5 >= 5, resolver 17 >= 5, coordinator 3 >= 2, bridge 1 >= 1, history 0; factory export exactly 1; `createPhysicPaintRotoKeyId` 3 -> 4; failure codes 19 -> 23 reusing existing vocabulary; session-import grep 0; single-paste factory count unchanged; D-16 `sourceFrame|displayFrame` counts at baseline in every touched file; authority-hygiene counts unchanged: `semanticDeltaEquals` 2, `executePhysicalEdit` 3, bridge validator call sites 2, history `Exclude<` 1).

## User Setup Required

None - no external service configuration required.

## Threat Flags

None — all mitigations in the plan's threat register were implemented as specified (fail-closed `hasOnlyKeys` strictness + factory throws T-38-01; single publish route with no per-key execute loop T-38-02; parent revalidation before mutation T-38-03; explicit equality branch T-38-04; zero installs T-38-SC). No new security-relevant surface beyond the plan's threat model: the paste-key-group intent is compile-only with no production caller yet.

## Next Phase Readiness

- Plan 38-04 can now build the `pasteKeyGroup` route against the exported `createPhysicPaintRotoPasteKeyGroupIntent` contract, replacing the fail-closed narrowing guard 38-01 installed in `pasteKey`; the coordinator/bridge/history settlement path already accepts the kind end-to-end.
- Live end-to-end confirmation (copy 2+ keys -> Paste -> anchored group lands atomically; collision rejection preserves selection/map/clipboard; one Undo step) is owned by the user-run native UAT checkpoint in plan 38-06; per CLAUDE.md the agent did not launch the server/app.
- Zero vitest invocations and zero test files touched (D-15); typecheck green.

## Self-Check: PASSED

- FOUND: `app/src/types/physicPaint.ts` (5 literal sites, grep count 5)
- FOUND: `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (factory export + candidate builder + validator + dispatch, grep count 17)
- FOUND: `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` (equality + routing + retargeting, grep count 3)
- FOUND: `app/src/lib/physicPaintBridge.ts` (validation branch condition, grep count 1)
- FOUND: `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` untouched (grep count 0, `Exclude<` count 1 = baseline)
- FOUND: commit `08264914` (Task 1) and `a5a826c4` (Task 2) in git log

---
*Phase: 38-multi-copy-paste-and-tooltip-polish*
*Completed: 2026-07-27*
