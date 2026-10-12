---
phase: quick-260919-sns
plan: 260919-sns
subsystem: ui
tags: [export, progress-feedback, preact-signals, tdd, flush]

# Dependency graph
requires:
  - phase: 52.1-modern-frame-runtime-native-hd-paint
    provides: requestPhysicPaintFlush (stale-document protection ahead of the frameMap read)
provides:
  - Export click surfaces 'Preparing export...' synchronously, before the Studio flush await
  - Cancel clicked during the flush window survives to the first checkpoint (latent resetProgress wipe repaired)
  - RED-pinned feedback contract in exportEngine.feedback.test.ts
affects: [phase-53, export, quick-260919-azh follow-up work]

# Actuals (#2632) — chars/4 over the realized diff, same scale as the plan estimate.
actuals:
  tokens: 2169
  tasks: 2
  commits: 2
plan_head_before: fa85ea01fa39051fdfafa98640c04f69cfb12ce1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deferred-promise flush mock (bare Promise with resolve captured into a vi.hoisted slot) to test ordering across an await without timers"

key-files:
  created:
    - app/src/lib/exportEngine.feedback.test.ts
  modified:
    - app/src/lib/exportEngine.ts

key-decisions:
  - "The 'preparing' write is hoisted to immediately after the output-folder guard and before the flush await — the flush IS preparation, so showing 'Preparing export...' over it is the honest stage"
  - "The old-site update is slimmed to totalFrames/currentFrame only — a redundant same-status rewrite would be a needless notification per the idempotent-setter discipline"

patterns-established:
  - "Feedback-write-before-first-await: any long invisible preparation leg must be preceded by the progress write that names it, so the modal can render during the await"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Clicking Export writes 'preparing' synchronously (before the flush resolves); frame counts stay truthful once the frame map is known; a cancel during the flush window is honored at the first checkpoint"
    verification:
      - kind: unit
        ref: "app/src/lib/exportEngine.feedback.test.ts#export feedback immediacy (260919-sns) — 3 cases"
        status: pass
      - kind: unit
        ref: "app/src/lib/exportEngine.test.ts + exportEngine.loops.test.ts + exportEngine.paintEnumeration.test.ts — regression suites, 0 failures"
        status: pass
    human_judgment: false
  - id: D2
    description: "Native UAT: visible ~100 ms feedback with Studio closed (5 s flush timeout) and open (drain), Cancel during preparation shows 'Export cancelled', truthful stage labels per format (PNG: Preparing → Rendering; video: + Encoding), WYSIWYG re-export spot check"
    verification: []
    human_judgment: true
    rationale: "Perceived latency, modal stage copy on the real surface, and pixel-identical re-export comparison require the native app — automation cannot judge them here"

# Metrics
duration: 5min
completed: 2026-09-19
status: complete
---

# Quick 260919-sns: Export Click Feedback Summary

**The 'preparing' progress write is hoisted above the Studio flush await in startExport, so Export clicks show 'Preparing export...' immediately — and a flush-window cancel now survives instead of being wiped by the late resetProgress.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-19T19:24:00Z
- **Completed:** 2026-09-19T19:28:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- RED-pinned the export feedback contract (3 cases) against pre-fix code, then flipped it green with a two-site reordering in `startExport`
- Repaired the latent cancel-wipe defect: pre-fix, a `cancel()` landing during the invisible flush window was erased by the `resetProgress()` that ran after the flush resolved, and the export ran on to 'complete'
- Closed the double-click double-export window: `isExporting` (which includes 'preparing') is now true at click time, so ExportView's `disabled` binding engages during the flush
- Zero regression: the three pre-existing export engine suites, `tsc --noEmit`, and the full app suite (216 files / 4006 tests) are all green; the exportEngine.ts diff is exactly the two-site reordering

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — pin the export feedback contract** - `259e057f` (test)
2. **Task 2: GREEN — hoist the 'preparing' write above the flush await** - `c10c6e9e` (fix)

**Plan metadata commit:** handled by the orchestrator (docs commit out of scope for this executor run).

## Files Created/Modified

- `app/src/lib/exportEngine.feedback.test.ts` — new RED-pinned contract: mock block + canvas harness copied verbatim from exportEngine.test.ts, plus a `./physicPaintFlush` mock whose bare deferred promise captures `resolve` into a hoisted slot so each test controls exactly when the flush completes
- `app/src/lib/exportEngine.ts` — `resetProgress()` + `updateProgress({ status: 'preparing' })` inserted immediately after the output-folder guard and before `await requestPhysicPaintFlush()`; the duplicate `resetProgress()` at the old site deleted; the surviving update slimmed to `{ totalFrames, currentFrame }`

## RED Proof (verbatim)

Command: `cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/lib/exportEngine.feedback.test.ts`

Result against pre-fix source — 3 failed (exit code 1), matching the plan's expected signature (two 'idle'-vs-'preparing', one 'complete'-vs-'cancelled'):

```
FAIL  src/lib/exportEngine.feedback.test.ts > export feedback immediacy (260919-sns) > writes 'preparing' synchronously on click, before the flush resolves
AssertionError: expected 'idle' to be 'preparing' // Object.is equality
Expected: "preparing"
Received: "idle"
 ❯ src/lib/exportEngine.feedback.test.ts:148:48

FAIL  src/lib/exportEngine.feedback.test.ts > export feedback immediacy (260919-sns) > keeps frame counts truthful once the frame map is known
AssertionError: expected 'idle' to be 'preparing' // Object.is equality
Expected: "preparing"
Received: "idle"
 ❯ src/lib/exportEngine.feedback.test.ts:156:48

FAIL  src/lib/exportEngine.feedback.test.ts > export feedback immediacy (260919-sns) > honors a cancel clicked during the flush window at the first checkpoint
AssertionError: expected 'complete' to be 'cancelled' // Object.is equality
Expected: "cancelled"
Received: "complete"
 ❯ src/lib/exportEngine.feedback.test.ts:172:48

 Test Files  1 failed (1)
      Tests  3 failed (3)
```

Case 3's RED is the latent defect itself: the cancel clicked during the flush window was wiped by the post-flush `resetProgress()` and the export ran to 'complete'.

## Six Correctness Invariants (verdicts from reading the final exportEngine.ts)

- **(a) Folder guard first:** PASS — the `if (!settings.outputFolder)` guard (lines 133-136) still runs before any progress write; the hoisted write is at lines 138-139. Its error surface is byte-identical.
- **(b) Flush before frameMap:** PASS — `await requestPhysicPaintFlush()` (line 143) still precedes `frameMap.peek()` (line 145). 52.1 stale-document protection intact.
- **(c) Only error exits between the write sites:** PASS — between the 'preparing' write (139) and the frame-count update (186-189), the only progress mutations are the empty-timeline and preflight error returns, both of which set status 'error' and return. Status is always still 'preparing' when the frame-count update runs.
- **(d) No isCancelled() between the sites:** PASS — the first `isCancelled()` reads are the preload interval (~line 219) and the frame-0 render-loop check (~line 246), both after the frame-count update. Moving the `cancelled` reset earlier is unobservable inside this export — except that it repairs the flush-window wipe, which is the point.
- **(e) resumeExport reads resumeFromFrame first:** PASS — `resumeExport` reads `progress.peek().resumeFromFrame` before calling `startExport`, so the earlier reset cannot eat it.
- **(f) outputPath resume-reuse order unchanged:** PASS — pre-fix, the reset (old line 183) already preceded the outputPath read (line 194); post-fix the reset (138) still precedes the read (195). Same relative order, same behavior; the pre-existing quirk is untouched.

## Law Check (diff reading, not grep)

`git diff fa85ea01..HEAD -- app/src/lib/exportEngine.ts` shows exactly two regions changed:

1. Insertion after the folder guard: `exportStore.resetProgress();` + `exportStore.updateProgress({ status: 'preparing' });`
2. Old site: duplicate `exportStore.resetProgress();` deleted; `status: 'preparing'` field removed from the surviving update (now `{ totalFrames, currentFrame }`).

The flush call, frameMap read, selectedSequenceOnly filter, empty-timeline guard, preflight, dimension math, directory creation, canvas/renderer creation, preload + AbortController leg, render loop, motion blur, encoding/download branches, sidecar/audio/notification legs, catch block, and resumeExport are all byte-identical. 3 insertions, 2 deletions.

## Wide-Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Targeted (feedback) | `vitest run src/lib/exportEngine.feedback.test.ts` | 3/3 pass |
| Export regression | `vitest run src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts src/lib/exportEngine.paintEnumeration.test.ts` | 37 tests, 0 failures (9 pre-existing it.todo unchanged) |
| Types | `tsc --noEmit` | clean (exit 0) |
| Full suite | `vitest run` | 216 files passed / 2 skipped, 4006 tests passed / 1 skipped / 101 todo, 0 failures (exit 0) |
| Scope | `git diff --name-only fa85ea01..HEAD` | exactly `app/src/lib/exportEngine.feedback.test.ts` + `app/src/lib/exportEngine.ts` |

**Pre-existing failures attribution:** none to attribute — the full suite is fully green. The 9 failures named in STATE.md Blockers (roto persistence x7, ipc base64 token, efxPaintPersistence base64, dating from 52.2-03) no longer fail at this HEAD; they were cleared by intervening 52.2 plans (07/09 carried the 'full suite green' exit criterion). Nothing was silently absorbed by this quick.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Case 3 intermediate 'preparing' assertion dropped**
- **Found during:** Task 1 (RED proof)
- **Issue:** The plan's `<behavior>` for case 3 specified an intermediate `expect(status).toBe('preparing')` before the cancel, but the plan's `<done>` required the RED signature "two 'idle'-vs-'preparing', one 'complete'-vs-'cancelled'". With the intermediate assertion, case 3 aborts at it (RED: 'idle'-vs-'preparing') and never demonstrates the cancel-wipe defect — the two plan clauses are mutually exclusive.
- **Fix:** Removed the intermediate assertion from case 3 only (with an explanatory comment); the cancel still lands synchronously while the mocked flush promise is pending, preserving the "cancel during the flush window" temporal structure. Cases 1 and 2 keep their intermediate assertions and pin the visibility contract.
- **Files modified:** app/src/lib/exportEngine.feedback.test.ts
- **Verification:** RED signature now matches `<done>` exactly (2× 'idle'-vs-'preparing', 1× 'complete'-vs-'cancelled'); all three cases pass post-fix
- **Committed in:** 259e057f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - plan internal inconsistency)
**Impact on plan:** The RED proof pins both defects the plan describes (invisible preparation, cancel wipe). No scope creep; no production file touched in Task 1.

## Issues Encountered

None beyond the deviation above. The harness copied from exportEngine.test.ts worked as-is with the added flush mock; no fixture beyond the one content entry / one content sequence was needed (empty `layers` makes the preflight a no-op by design).

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Pure sequencing reorder of two store writes, exactly as the plan's threat model scoped it. T-260919-sns-01 is mitigated by the six invariants + three RED-pinned cases; T-260919-sns-02 is closed by construction (`isExporting` true at click time); T-260919-sns-03/SC accepted per the register.

## User Setup Required

None - no external service configuration required.

## Native UAT — PASSED 2026-09-19 (user: "perfect all work!")

1. Studio window CLOSED: click Export on a paint project. Expected: 'Preparing export...' appears essentially instantly and stays through the preparation seconds (the flush burns its timeout here), then 'Rendering frame N of M'.
2. Studio window OPEN with fresh unflushed strokes: click Export. Expected: 'Preparing export...' visible during the drain, then Rendering.
3. Click Cancel while 'Preparing export...' is showing. Expected: the export cancels at the first checkpoint and the modal shows 'Export cancelled' (never runs on to completion).
4. PNG-sequence export: stages shown are Preparing → Rendering → complete. Video export: Preparing → Rendering → Encoding → complete.
5. WYSIWYG spot check: re-export a project exported before this fix and compare outputs — frames must be identical (D-05).

## Next Phase Readiness

- Export feedback contract is now pinned by tests; Phase 53 acceptance work (and the 260919-azh paint-export follow-ups) can rely on truthful stage reporting.
- No blockers. Native UAT rows above passed 2026-09-19.

## Self-Check: PASSED

- FOUND: app/src/lib/exportEngine.feedback.test.ts (created, 174 lines)
- FOUND: app/src/lib/exportEngine.ts (modified, 3+/2-)
- FOUND: commit 259e057f (Task 1 RED test)
- FOUND: commit c10c6e9e (Task 2 GREEN fix)
- Measured commits from ledger fa85ea01..HEAD: 2 (matches frontmatter)
- Working tree clean; scope gate clean

---
*Phase: quick-260919-sns*
*Completed: 2026-09-19*
