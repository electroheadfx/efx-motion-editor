---
phase: 59-rail-motion-channels-v7-interface
plan: 22
subsystem: physics-paint roto rail motion
tags: [preact, signals, vitest, tdd, rail-motion, loop-clip, copy-paste, ownership]

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: rail motion records, identity transitions, commit-point reconciler, key-rail segmentation, rail-set copy engine
provides:
  - CR-01 fix — reveal bakes reconcile motion against the Loop Clip they are about to append
  - fail-closed guard for a duplicate pending reveal loopId
  - collectRailMotionGroupOwnedKeyIds — the one group-ownership projection (sourceKeyIds + frameOverrides[].keyId)
  - rail-set copy payloads that segment with the document's real group ownership
  - loop copy members that carry their own source entries (Option B cross-track carrier)
affects: [59-23, 59-24, 59-25, verify-work, rail-motion UAT]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 15080
  tasks: 3
  commits: 6
  plan_head_before: 87ee0f355bcb5ae67a7a1db3edb6adc7ec2e09ec
  plan_head_after: 8af7d1fc2

tech-stack:
  added: []
  patterns:
    - One exported ownership authority consumed by the reconciler, the copy payload builder and the store copy path
    - Loop Clip members carry their own source entries instead of a synthetic key-rail carrier

key-files:
  created: []
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/efxPaintStore.reveal.test.ts
    - app/src/stores/trackIsolation.test.ts
    - app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
    - app/src/types/physicPaint.ts
    - app/src/lib/physicPaintBridge.test.ts

key-decisions:
  - "Option B (human decision): extend the copy contract instead of removing the loop-source carrier — loop members carry sourceEntries, cross-track allocation covers them, and the proposer materializes them with the same destination-frame law as the same-track path."
  - "sourceEntries is a required loop-member field validated by the semantic-delta whitelist; without it every Option B paste payload would reject at bad-semanticDelta."
  - "Unresolvable clip source ids are omitted from sourceEntries but stay on clip.sourceKeyIds, so a cross-track paste still fails closed with loop-source-outside-pasted-set."
  - "collectRailMotionGroupOwnedKeyIds is the single ownership authority: reconciler segment derivation, payload builder, copyTrackSelection and _resolveRotoRailMotionProjection all consume it."

patterns-established:
  - "One ownership authority: every rail-motion consumer derives group ownership from collectRailMotionGroupOwnedKeyIds, never a local projection."
  - "Loop-carried sources: a fully selected Loop Clip yields ONE loop member whose sourceEntries are the fresh real keys; a clip-owned key is never a Key Rail member."

requirements-completed: [MOTN-05, MOTN-12]

coverage:
  - id: D1
    description: "Reveal bakes reconcile rail motion against a next snapshot that already owns the baked keys, and a duplicate pending loopId fails closed before rendering."
    requirement: MOTN-12
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.reveal.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rail-set copy payloads segment with real group ownership; a clip-following Key Rail copies with only its own keys and frozen motion; loop members carry their own source entries."
    requirement: MOTN-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Store copyTrackSelection and the resolver projection derive ownership from the shared collector, so cross-track paste/duplicate/cut/move keep working with the production member shape."
    requirement: MOTN-05
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts"
        status: pass
    human_judgment: false

duration: 58min
completed: 2026-11-07
status: complete
---

# Phase 59 Plan 22: CR-01 + WR-06 gap closure Summary

**Reveal bakes now reconcile motion against the Loop Clip they are about to append, and every rail-set copy segments Key Rails with one shared group-ownership authority so clip-following rails copy with their own keys and frozen motion.**

## Performance

- **Duration:** ~58 min (09:09Z task-1 RED start → 10:08Z summary)
- **Started:** 2026-11-07T09:09:46Z
- **Completed:** 2026-11-07T10:08:00Z
- **Tasks:** 3
- **Files modified:** 9 (app source + tests)

## Accomplishments
- CR-01 closed: `commitRevealBake` sees the pending reveal Loop Clip in the reconciliation's next snapshot, so a neighbouring Key Rail is no longer re-anchored onto a key the new clip immediately owns; the record keeps its railId at the surviving key.
- A duplicate pending reveal `loopId` fails closed with `reveal loop clip already exists` before `renderRotoRevealFrames` — zero record, break, clip or motion written.
- WR-06 closed: `buildRotoRailSetCopyPayload`, `copyTrackSelection` and `_resolveRotoRailMotionProjection` all derive group ownership from the exported `collectRailMotionGroupOwnedKeyIds`.
- Option B: Loop Clip copy members carry `sourceEntries`, and cross-track paste allocates + materializes them with the same destination-frame law as the same-track path — cross-track paste/duplicate/cut/move keep working without a synthetic key-rail carrier.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Reveal bake reconciles against the clip it appends** — `f4862e65b` (test RED), `fe5a8cef0` (feat GREEN)
2. **Task 2: One rail-set copy ownership authority** — `449cdb3c9` (test RED), `52bdb28ff` (feat GREEN)
3. **Task 3: Store copy/projection ownership** — `d000d80b0` (test RED), `8af7d1fc2` (feat GREEN)

**Plan metadata:** committed separately after this summary (docs: complete 59-22 plan)

## Files Created/Modified
- `app/src/stores/physicPaintStore.ts` — `RevealLoopClipTemplate` + `RevealBakeInput.pendingLoopClip`, duplicate-loopId guard, pending clip in the next snapshot, shared ownership collector in `copyTrackSelection` and `_resolveRotoRailMotionProjection`.
- `app/src/stores/efxPaintStore.ts` — `createRevealRail` mints `loopId` before the bake and passes one shared clip base as the pending template and the appended clip.
- `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts` — exported `collectRailMotionGroupOwnedKeyIds`; `groupOwnedKeyIdsFor` delegates to it.
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` — ownership segmentation, loop `sourceEntries`, cross-track allocation + materialization, loop-member validation.
- `app/src/types/physicPaint.ts` — semantic-delta validator accepts and validates loop-member `sourceEntries`.
- Tests: `efxPaintStore.reveal.test.ts`, `physicsPaintRotoRailSetCopy.test.ts`, `trackIsolation.test.ts`, `physicPaintBridge.test.ts` fixture parity.
- Planning evidence: `red-evidence-59-22-task{1,2,3}.json`, `red-evidence/red-59-22-task{1,2,3}.xml`.

## Decisions Made
- **Option B — Extend the copy contract (human decision after a Rule 4 architectural checkpoint).** Removing the synthetic key-rail carrier without a replacement would break cross-track paste/duplicate/cut/move for every clip-bearing track, because `allocateFreshIdentities` skipped loop-source allocation when `crossTrack`. The loop member now carries its own sources.
- `sourceEntries` is required on `RotoRailSetCopyLoopMember`; the semantic-delta validator whitelist includes it and validates every entry with the existing key-rail entry guard.
- Unresolvable source ids are omitted from `sourceEntries` (no fresh identity) but remain on `clip.sourceKeyIds`, preserving the `loop-source-outside-pasted-set` rejection.
- Cross-track materialization mirrors the same-track law exactly and skips source keys already covered by a key-rail member; `memberFirstFrames` still starts a new segment at the loop's first fresh source.

## Deviations from Plan

### Rule 4 — Architectural change (human-approved: Option B)

**1. [Rule 4 - Architectural] Loop copy members carry their own source entries**
- **Found during:** Task 2 (copy payload ownership)
- **Issue:** The plan's minimal fix (segment with real ownership, change nothing else) breaks cross-track paste/duplicate/cut/move: `allocateFreshIdentities` skipped loop-source allocation when `crossTrack`, so a fully selected Loop Clip with no key-rail carrier could never be re-pointed.
- **Fix:** Human selected Option B — extend `RotoRailSetCopyLoopMember` with `sourceEntries`, allocate them on cross-track, materialize real-key records at `destinationStart + (source offset)` before `repointLoopClipSources`, and update the affected tests to the production member shape.
- **Files modified:** `physicsPaintRotoRailSetCopy.ts`, `physicsPaintRotoRailSetCopy.test.ts`, `trackIsolation.test.ts`, `physicPaintStore.ts`
- **Verification:** copy suite 38/38, track isolation 32/32, cross-track re-pointing / duplicate / cut / move rows green
- **Committed in:** `52bdb28ff`, `8af7d1fc2`

### Auto-fixed Issues

**2. [Rule 2 - Missing Critical] Semantic-delta validator accepts loop source entries**
- **Found during:** Task 2 (Option B implementation)
- **Issue:** `isRotoRailSetCopyMemberValue` whitelisted only `kind|loopId|placementStart|clip|effectiveEndExclusive|repeat`; every Option B payload would reject at `bad-semanticDelta` at the bridge, breaking all cross-track pastes.
- **Fix:** added `sourceEntries` to the loop-member whitelist and validated each entry (`isRotoRailSetCopyEntryValue`).
- **Files modified:** `app/src/types/physicPaint.ts`
- **Verification:** bridge suite 158 passed / 1 skipped, semantic-delta suite green
- **Committed in:** `52bdb28ff`

**3. [Rule 3 - Blocking] Hand-built bridge payload fixture updated for the required field**
- **Found during:** Task 2 (`pnpm typecheck`)
- **Issue:** `physicPaintBridge.test.ts` hand-builds a loop copy payload; the now-required `sourceEntries` made the literal fail typecheck.
- **Fix:** added the k0 source entry (production shape) to that fixture.
- **Files modified:** `app/src/lib/physicPaintBridge.test.ts`
- **Verification:** typecheck clean; bridge suite green
- **Committed in:** `52bdb28ff`

---

**Total deviations:** 1 Rule 4 (human-approved Option B), 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Option B is the human's chosen contract; the validator and fixture changes are required for it to function. No unrelated scope creep.

## Issues Encountered
- A `memberFirstFrames` push used the wrong shorthand property name (`freshFirstKeyId` vs `firstFreshKeyId`); the first copy-suite run caught it (`ReferenceError`), fixed immediately, all 38 tests green afterwards.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None.

## Threat Flags
None — no new network, auth, file-access or schema surface. T-59-60 (copy ownership tampering) is mitigated by the single exported collector plus the clip-following success row and the clip-owned-member `stale-member` control.

## Next Phase Readiness
- Final verification suite green: `efxPaintStore.reveal.test.ts` (46), `physicsPaintRotoRailSetCopy.test.ts` (38), `trackIsolation.test.ts` (32) = 116/116; `tsc --noEmit` clean.
- Plan greps: `pendingLoopClip` 6 (≥ 3), `collectRailMotionGroupOwnedKeyIds` present in all three modules, zero empty `groupOwnedKeyIds: new Set()` in production, exactly 1 `reveal loop clip already exists`.
- CR-01 and WR-06 are ready for phase-level re-verification; no blockers carried forward from this plan.

---
*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-07*

## Self-Check: PASSED

- SUMMARY and all RED evidence artifacts exist on disk.
- All six task commits (f4862e65b, fe5a8cef0, 449cdb3c9, 52bdb28ff, d000d80b0, 8af7d1fc2) are ancestors of HEAD.
- Plan verification greps pass; typecheck clean; 116/116 plan verification tests green.
