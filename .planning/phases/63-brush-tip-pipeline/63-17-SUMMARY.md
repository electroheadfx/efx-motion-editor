---
phase: 63-brush-tip-pipeline
plan: 17
subsystem: ui
tags: [preact, vitest, snapshot-controller, close-path, withheld-save, tdd]

requires:
  - phase: 63-16
    provides: "CR-02 refused-restore latch plus the CR-01 withhold notice and report ports"
provides:
  - "Close refusal acknowledged once per latch episode (withheldEpisode + pure admitsWithheldClose gate + Studio per-episode ref)"
  - "hasWithheldContent() durable-base arm scoped to this track's live keys and session anchors, conservative on unknown identity"
affects: [63-verification, studio-close-path, snapshot-controller]

actuals:
  tokens: 4466
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Latch-episode identity: a bind-keyed counter exposed to the close path and compared through a pure gate, so disclosure is behaviourally testable without rendering the Studio"
    - "Own-key scoping for launch-scoped cross-track maps: filter by live-key-plus-anchor ownership, conservative when the identity set is unknown"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The acknowledgement is keyed on the controller's latch episode (a bind-incremented counter) rather than resetting a Studio boolean on track switch — a rebind is the disclosure boundary and the gate stays framework-agnostic."
  - "An unknown (null/absent) live key map counts every durable base: scoping must never under-count withheld content the save would write."
  - "Widened the 52.2-15 close-sequence source slice from 3600 to 4200 characters after the planned close-step expansion pushed the last pinned step outside the window."

requirements-completed: []

coverage:
  - id: D1
    description: "Close refusal acknowledged once per latch episode — a rebind to a second refused track refuses again, a same-episode second close is admitted, and the refusal states that closing again discards the unsaved script"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-03: a rebind to a second latched track refuses its first close again"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-03: the episode is stable inside one binding"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#CR-03: the close refusal acknowledges once per latch episode"
        status: pass
    human_judgment: false
  - id: D2
    description: "hasWithheldContent() counts only this bound track's durable bases — a foreign track's base alone does not refuse the close or name the destructive clear, while own, anchor-owned and unknown-identity bases stay counted"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#WR-15: a base owned by this track’s live key counts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#WR-15: a foreign track’s base alone does not refuse the close"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#WR-15: an unknown live key map stays conservative"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#WR-15: a base owned by a session anchor counts"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-11-17
status: complete
commits: 4
plan_head_before: 68619703f0e9faf913a398473dc7e79c2d82d667
plan_head_after: 6aff782e94958b5d751fce478a42bc8adb814ecd
---

# Phase 63 Plan 17: CR-03 and WR-15 Gap Closure Summary

**Per-latch-episode close refusal plus an own-track durable-base scope close Phase 63 truths 22 and 25 without touching the save withholding law.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-17T11:50:11Z
- **Completed:** 2026-11-17T11:54:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- CR-03: the controller now exposes a latch episode (`latchEpisode` incremented on every `bind()`, read through `withheldEpisode()`) and a pure exported `admitsWithheldClose(acknowledged, current)` gate. The Studio replaces the per-window boolean with `closeWithheldAcknowledgedEpisodeRef`: a rebind to a second refused track refuses its first close again, while a same-episode second close is the user's explicit choice. The refusal message now states that closing again will discard the unsaved script and still names the resume remedy.
- WR-15: `hasWithheldContent()`'s durable-base arm counts only keys this binding owns — the live key ids plus the session anchors' VALUES, matching the save's scope. A foreign track's durable base alone no longer refuses the close or steers the user toward the destructive whole-track clear. An unknown (null/absent) live key map stays conservative: every base counts.
- No dependency, Rust, IPC, format, manifest or save-path change. The CR-02 latch, the save withholding path, the debounce, the FIFO queue and the close-gate predicate are untouched.

## Task Commits

Each task was committed atomically (RED then GREEN):

1. **Task 1: CR-03 — close refusal acknowledged once per latch episode** — `414221903` (test, RED) → `0c01d089c` (feat, GREEN)
2. **Task 2: WR-15 — hasWithheldContent() counts only this bound track's durable bases** — `796f31a39` (test, RED) → `6aff782e9` (fix, GREEN)

**Plan metadata:** docs(63-17) complete plan (the final metadata commit).

## TDD Evidence

- **Task 1 RED** — `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts --reporter=tap-flat` (via the app-local vitest binary): verdict `RED_EVIDENCE_OK` (`target_test_failed`), 88 tests / 86 pass / 2 fail. Both CR-03 pins failed with `TypeError: controller.withheldEpisode is not a function` — the planned API did not exist yet. Semantic assessment: target tests executed inside the CR-03 describe, module loaded, no setup/collection/import/syntax failure.
- **Task 2 RED** — same runner on the controller suite: verdict `RED_EVIDENCE_OK` (`target_test_failed`), 92 tests / 91 pass / 1 fail. Only the foreign-base case failed (`expected true to be false`) while own, unknown-identity and anchor-owned cases passed, proving the RED is the unfiltered map size and not a broken fixture. Semantic assessment: assertion failure on the planned behaviour, no fixture or load fault.

## Files Created/Modified

- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` — `latchEpisode` counter incremented in `bind()`, `withheldEpisode()` (interface member, implementation, returned API), exported pure `admitsWithheldClose`, and the rewritten own-key durable-base arm in `hasWithheldContent()`.
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts` — the CR-03 per-episode describe (rebind refusal, same-episode admission, episode stability) and the WR-15 own-track durable-bases describe (own, foreign-only, unknown-identity, anchor-owned).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — imports `admitsWithheldClose`, replaces the per-window boolean with `closeWithheldAcknowledgedEpisodeRef`, and rewrites the withheld close step to read the episode, gate on it, record it, re-report and throw the informed refusal.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — the `CR-03: the close refusal acknowledges once per latch episode` source pin, plus the 52.2-15 close-sequence slice widened to keep its pinned steps in range.

## Decisions Made

- The acknowledgement is keyed on the controller's latch episode (a bind-incremented counter) rather than resetting a Studio boolean on track switch — a rebind is the disclosure boundary, and the gate stays framework-agnostic and behaviourally testable without rendering the Studio.
- An unknown (null/absent) live key map counts every durable base: scoping must never under-count withheld content the save would write, so the conservative arm wins over a silent close.
- The WR-15 scope iterates `getWatercolorKeyAnchors().values()`, not the Map entries — the review's sketch form would have added `[frame, keyId]` tuples to the id set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Widened the 52.2-15 close-sequence source slice from 3600 to 4200 characters**
- **Found during:** Task 1 (CR-03 Studio wiring)
- **Issue:** The `52.2-15` close-order pin slices the Studio source at a fixed offset from `usePhysicsPaintCloseFlush(`. The planned close-step expansion moved `flushDocumentSyncRef.current()` to offset 3624, outside the 3600-character window, so the pin reported `[3148, 3509, -1, -1]`.
- **Fix:** Widened the slice to 4200 characters, keeping the assertion (all four steps present and in order) unchanged.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Both target suites green (525 tests).
- **Committed in:** `0c01d089c` (part of the Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to keep an existing close-order pin measuring the same close sequence; no scope creep and no runtime behaviour change.

## Issues Encountered

- The 52.2-15 source pin's fixed-length window silently truncated the close sequence after the planned step expansion. Resolved by widening the window (documented above). No other problems.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Truths 22 and 25 now have deterministic red-first pins; `63-VERIFICATION.md` can be regenerated from the current tree.
- WR-14 and IN-01..IN-16 remain recorded as `open` in `63-REVIEW-DISPOSITION.md`; ROADMAP SC2 wording and the 4K import responsiveness stay with the human/UAT decision path. Neither is re-planned here.

---
*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-17*

## Self-Check: PASSED
