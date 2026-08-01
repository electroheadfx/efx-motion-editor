---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 04
subsystem: ui
tags: [physics-paint, roto, group-paste, selection-aftermath, acknowledged-transactions, typescript]

requires:
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 01
    provides: widened single|group clipboard union, isRotoSessionCopiedKeyGroup guard, RotoSessionCopiedGroupEntry shape, interim fail-closed narrowing guard in pasteKey
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 02
    provides: createPhysicPaintRotoPasteKeyGroupIntent factory (fresh keyIds minted once, fail-closed), paste-key-group semantic seam through resolver/coordinator/bridge/history, group candidate with earliest-pasted-key selectedKeyId
provides:
  - RotoPhysicalKeyUtilityPort.pasteKeyGroup(destinationAppFrame, entries) required port member — atomic all-empty-or-reject group variant (D-05)
  - pasteKeyGroup route in useRotoTimelineActions through runPhysicalAction: factory fail-closed gate, busy 'Pasting keys…', success 'Pasted {N} keys', locked reject copy mapping, publishDiagnostic detail leg
  - PhysicalActionRunnerInput 'paste-key-group' union member + optional rejectedCopy failure-code→concise-copy mapping
  - Hook clipboard-shape branch: group clipboards route to pasteKeyGroup at input.currentFrame; single clipboards keep the byte-identical toClipboardPayload path; 38-01 interim guard removed
  - resolvePostAcceptanceRotoSelection 'paste-key-group' branch + acceptedAddedKeyIds input (Pitfall 2 closed): pasted set selected, earliest pasted key anchor
  - Studio acceptedAddedKeyIds before/after record-diff wiring + createdSelectedDestination widened to paste-key-group for cached-reference load parity
affects: [38-06 native UAT, 38-07 post-UAT regression tests]

tech-stack:
  added: []
  patterns:
    - "Group paste activation reuses the EXISTING single-authority seam: hook shape branch -> port -> frozen factory intent -> runPhysicalAction -> coordinator -> replace-roto-physical-map -> acceptedOutput -> ONE history command; no new machinery, no per-key execute loop"
    - "rejectedCopy runner extension: failure-code → UI-SPEC locked concise line mapping supplied per-route; absent mapping preserves byte-identical resolver-text behavior for all pre-existing routes"
    - "Busy line published only after the factory succeeds and before the awaited transaction; success/reject lines always overwrite it"
    - "Post-acceptance added-set derivation from the accepted before/after record keyId diff only — no store reads, no session reads, no new authority (38-DOWNSTREAM-PARITY)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "rejectedCopy construction: runnerInput.rejectedCopy?.(failure) ?? (failure.text || fallback) in runPhysicalAction's failure branch; the publishDiagnostic leg fires for BOTH 'delete-key-group' and 'paste-key-group' via runnerInput.operationKind + ' rejected: ' construction, keeping the delete-key-group string byte-identical (36.14 D-26, T-38-02)"
  - "pasteKeyGroup route passes requiredKeyId: null per the delete-key-group precedent — the resolver is the destination-occupancy authority (every computed destination must be empty)"
  - "Group paste destination is input.currentFrame per D-07 (current editing cell, including while a multi-selection is active); no currentKeyId passed — an occupied current cell rejects via the resolver with the locked collision line"
  - "Tracer feedback gate resolved as automated per the 38-01/38-02 precedent: plan frontmatter autonomous:true, no checkpoint tasks, fully automated <verify> (typecheck + grep gates, all green), live UAT owned by plan 38-06"
  - "Defensive reducer fallback: absent or empty acceptedAddedKeyIds for 'paste-key-group' falls through to the default collapse (fail-safe, never throws, never fabricates a set)"

patterns-established:
  - "UI-SPEC locked group paste copy lives in exactly one route: 'Pasting keys…' (U+2026) busy, 'Pasted {N} keys' interpolated at route-call time (runPhysicalAction fixed-string contract unchanged), 'Paste rejected — key in the way' / 'Paste rejected — not enough room' (U+2014 em-dash) via rejectedCopy, fallback preserves resolver text"

requirements-completed: [38-GROUP-PASTE, 38-DOWNSTREAM-PARITY]

coverage:
  - id: D1
    description: "Group paste activation: group clipboard -> hook shape branch -> port -> frozen 38-02 intent -> runPhysicalAction -> coordinator -> bridge -> acceptedOutput -> ONE history command; locked busy/success/reject copy with concise-capsule + LOG-detail split"
    requirement: 38-GROUP-PASTE
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (green) + grep gates: pasteKeyGroup port=1 actions=3 hook=1; 'paste-key-group' literal=4; each locked copy line==1; rejectedCopy=3; interim guard=0; legacy replace-roto-key-frames=0 in both hook files"
        status: pass
    human_judgment: true
    rationale: "Live end-to-end behavior (paste lands all keys, one Undo/Redo, locked capsule copy) is user-owned native UAT in plan 38-06 per D-15 and the plan's verification section"
  - id: D2
    description: "Post-paste selection aftermath: pasted set becomes the selection with the earliest pasted key as anchor/current via the existing accepted-selection sync; anchor on launch startFrame loads its cached reference frame exactly like single paste (Pitfall 2 closed)"
    requirement: 38-GROUP-PASTE
    verification:
      - kind: other
        ref: "typecheck green; reducer 'paste-key-group'>=2 (got 3), acceptedAddedKeyIds reducer=4 studio=3; move-key-group/force-spacing branches ==1 each (byte-identical); studio 'paste-key'>=2, 'paste-key-group'>=1"
        status: pass
    human_judgment: true
    rationale: "Live selection/focus/reference-load behavior is user-owned native UAT in plan 38-06 per D-15"
  - id: D3
    description: "Single-key paste path byte-identical (Pitfall 7): pasteKey route, addEmptyKey, PASTE_SUCCESS_MESSAGE, toClipboardPayload path untouched; group all-empty-or-reject policy does not leak into the single path; availability stays shape-agnostic; strip untouched"
    requirement: 38-DOWNSTREAM-PARITY
    verification:
      - kind: other
        ref: "byte-identity greps: successMessage: PASTE_SUCCESS_MESSAGE==1, toClipboardPayload==1, createPhysicPaintRotoPasteKeyIntent==3; porcelain gate on strip/tooltip/CSS/scripts panel EMPTY"
        status: pass
    human_judgment: false
  - id: D4
    description: "Downstream parity authority hygiene: exactly one publish route (no per-key executePhysicalEdit loop added, zero executePhysicalEdit references in the hook, zero retired legacy key-frames publish path references); acceptedAddedKeyIds derives only from the accepted before/after diff"
    requirement: 38-DOWNSTREAM-PARITY
    verification:
      - kind: other
        ref: "git diff contains zero executePhysicalEdit references (no new coordinator call sites); hook executePhysicalEdit==0; legacy path greps==0"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-27
status: complete
---

# Phase 38 Plan 04: Group Paste Activation + Selection Aftermath Summary

**Group paste is live end-to-end: a group clipboard routes through the new `pasteKeyGroup` port member and route into the frozen 38-02 intent and the existing runPhysicalAction/coordinator/bridge seam — one atomic acknowledged transaction with UI-SPEC locked busy/success/reject copy — and the accepted pasted group becomes the selection with the earliest pasted key current, while the single-key paste path stays byte-identical**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-27T15:17:51Z
- **Completed:** 2026-07-27T15:23:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `rotoCoordinatorPorts.ts`: `RotoPhysicalKeyUtilityPort` gains the required `pasteKeyGroup(destinationAppFrame, entries)` member with a doc comment pinning the atomic all-empty-or-reject policy (D-05) versus pasteKey's replace-style single behavior; type-only import of `RotoSessionCopiedGroupEntry` from the sibling session module
- `useRotoTimelineActions.ts`: `PhysicalActionRunnerInput` gains `'paste-key-group'` and an optional `rejectedCopy` mapping; the failure branch publishes `rejectedCopy?.(failure) ?? (failure.text || fallback)` (existing routes byte-identical) and the publishDiagnostic leg now fires for both group kinds via `operationKind + ' rejected: ' + code + ' — ' + text` construction (delete-key-group string provably identical); new `pasteKeyGroup` route mirrors `pasteKey` exactly — frame guard, fail-closed factory try/catch (`The copied Roto key group is unavailable.`), busy line `Pasting keys…` (U+2026) published after the factory succeeds and before the awaited transaction, `requiredKeyId: null`, interpolated `Pasted {N} keys` success, and the locked reject mapping (`duplicate-destination-frame` → `Paste rejected — key in the way`; `over-capacity`/`out-of-range-frame` → `Paste rejected — not enough room`; fallback preserves resolver text); route added to the `physicalKeyUtilities` port object and its dep array
- `useRotoKeyUtilities.ts`: the 38-01 interim fail-closed narrowing guard is fully removed (grep for its message returns 0) and replaced with the real activation — `setKeyActionInFlight(true)`, `pasteKeyGroup(input.currentFrame, copiedKey.entries)`, catch mirroring the single path's shape with `Could not paste the copied Roto key group.`, finally releasing the busy flag; everything else in `pasteKey` byte-identical (blocked guard, shape-agnostic availability, null check, single-key `toClipboardPayload` path)
- `physicsPaintRotoMultiSelection.ts`: reducer input gains optional `acceptedAddedKeyIds`; new `'paste-key-group'` branch before the default collapse returns the pasted set as `selectedKeyIds` with the accepted selectedKeyId (earliest pasted key per the 38-02 candidate) as anchor; absent/empty input falls through to the default collapse; doc comment updated; move-key-group, force-spacing, and default branches byte-identical
- `PhysicsPaintStudio.tsx`: `consumeBridgeApplyResult` computes `acceptedAddedKeyIds` solely from the accepted before/after record keyId diff (after.records is appFrame-sorted by resolver contract — earliest-first, no extra sort) and passes it to the aftermath reducer; `createdSelectedDestination` widened to `'paste-key' || 'paste-key-group'` so the pasted anchor landing on the launch startFrame loads its cached reference frame exactly like single paste; D-17 comment updated

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end group paste activation — port member + pasteKeyGroup route + hook clipboard-shape branch** - `6ec5dcfb` (feat)
2. **Task 2: Selection aftermath — paste-key-group reducer branch + Studio acceptedAddedKeyIds wiring + cached-reference load parity** - `e78e0649` (feat)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts` — `pasteKeyGroup` required port member + type-only session import
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — runner union member + `rejectedCopy` field, failure-branch consumption + widened diagnostic leg, `pasteKeyGroup` route, port object entry
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — group clipboard-shape branch in `pasteKey` (interim guard removed)
- `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts` — `acceptedAddedKeyIds` input + `'paste-key-group'` aftermath branch + doc bullet
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — before/after diff computation, reducer call field, widened `createdSelectedDestination` condition

## Decisions Made

- Tracer feedback gate resolved as automated per the 38-01/38-02 precedent: `autonomous: true`, no checkpoint tasks, fully automated `<verify>` (typecheck + grep gates, all green), live end-to-end UAT owned by plan 38-06.
- The busy line `Pasting keys…` is published inside the route after the factory succeeds and before `runPhysicalAction` is invoked; runPhysicalAction's own early guards (no launch, already in flight) overwrite it with their fixed lines, and the success/reject lines always overwrite it on settlement — the loading-row contract holds without new machinery.
- `acceptedAddedKeyIds` is computed for every accepted operation but only consumed by the `'paste-key-group'` branch; the diff is plain render-scope logic inside the existing callback — no new signals, effects, or refs (Preact discipline).
- No focus/scroll machinery added: the 38-02 candidate sets `proposal.selectedKeyId` to the earliest pasted key's fresh keyId, so the existing accepted-selection sync makes it current and focus/scroll follow (37 D-06/D-17 pattern).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan verification inconsistency] `input.executePhysicalEdit` grep expectation vs whole-file baseline**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<verify>` expects `grep -c "input.executePhysicalEdit" useRotoTimelineActions.ts == 1`, but the baseline file already contains 11 occurrences — availability guards (`!input.executePhysicalEdit`) in runPhysicalAction/prepare/commit/force-spacing routes plus the direct coordinator calls in the drag commit routes and force-spacing. The gate's stated intent is "the one existing call inside runPhysicalAction — no per-key loop".
- **Fix:** Proved the intent directly: `git diff` for the Task 1 commit contains zero `executePhysicalEdit` references — the new route goes through `runPhysicalAction` only, adding no new coordinator call sites; the whole-file count (11) is unchanged from baseline. The hook-side gate (`executePhysicalEdit == 0` in useRotoKeyUtilities.ts) passed as written.
- **Files modified:** none (verification methodology only)
- **Verification:** `git diff HEAD~1 HEAD -- useRotoTimelineActions.ts | grep executePhysicalEdit` empty; typecheck green
- **Committed in:** `6ec5dcfb` (part of Task 1 commit)

---

**Total deviations:** 1 (verification-gate expectation correction; no production behavior change)
**Impact on plan:** None on scope or behavior — the verify intent ("one runPhysicalAction call per paste, no per-key execute loop") is satisfied and proven by the commit diff.

## Issues Encountered

None beyond the verification-gate deviation above. Typecheck passed on the first run after each task; all other grep gates matched the plan's expected counts exactly (port 1, actions 3, hook 1, `'paste-key-group'` literal 4, each locked copy line 1, rejectedCopy 3, single-path byte-identity tokens 1/1/3, interim guard 0, legacy path 0/0, reducer branches preserved).

## User Setup Required

None - no external service configuration required.

## Threat Flags

None — all mitigations in the plan's threat register were implemented as specified (fail-closed factory gate T-38-01; capsule-only concise lines with code + full text routed exclusively to `publishDiagnostic` → LOG, T-38-02; single publish route with no per-key execute loop, no direct coordinator call from the hook, and no retired legacy key-frames path, T-38-03; zero installs, T-38-SC). No new security-relevant surface beyond the plan's threat model: the plan adds no new bridge crossing — the group semantic delta crosses through the 38-02 validated seam only.

## Next Phase Readiness

- Plan 38-05 can proceed in this wave with zero file overlap (strip/tooltip/CSS/scripts panel untouched — porcelain gate empty).
- Live end-to-end confirmation for the 38-06 user-owned native UAT checklist: with a group clipboard, Paste at an all-empty destination lands all keys at exact computed frames with fresh keyIds and `Pasted {N} keys`; collision shows `Paste rejected — key in the way`; range/capacity shows `Paste rejected — not enough room`; the pasted group is selected with the earliest pasted key current; one Undo step reverses the paste; single-key Copy/Paste/`+ Key` unchanged; save/reopen, caches, playback, onion/reference, preview/export derive from the accepted map only.
- Zero vitest invocations and zero test files touched (D-15); typecheck green.

## Self-Check: PASSED

- FOUND: `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts` (pasteKeyGroup port member, grep count 1)
- FOUND: `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` (route + runner extension, pasteKeyGroup grep count 3)
- FOUND: `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` (group branch, interim guard grep count 0)
- FOUND: `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts` (paste-key-group branch, grep count 3)
- FOUND: `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (acceptedAddedKeyIds wiring, grep count 3)
- FOUND: commit `6ec5dcfb` (Task 1) and `e78e0649` (Task 2) in git log

---
*Phase: 38-multi-copy-paste-and-tooltip-polish*
*Completed: 2026-07-27*
