---
phase: quick-260920-j5r
plan: 260920-j5r
subsystem: playback
tags: [playback-engine, frameMap, scrub, active-sequence, gap-entries, 52.3-wr-01, tdd]

# Dependency graph
requires:
  - phase: 52.3-paint-content-export-per-frame-compositor-enumeration
    provides: dense FrameEntry enumeration (content | paint | gap) — the gap arm's `sequenceId: ''` is the input this guard discriminates on
  - phase: 52.3-paint-content-export-per-frame-compositor-enumeration
    provides: paint-frame activation pin in playbackEngine.test.ts:284-304 (the describe this quick extends)
provides:
  - syncActiveSequence never reaches sequenceStore.setActive for ownerless gap entries (leading gaps and inter-fx gaps alike)
  - activeSequenceId + selectedKeyPhotoId survive a scrub onto a gap frame — the pre-52.3 contract restored
  - RED-pinned gap-scrub contract in playbackEngine.test.ts (leading-gap preservation; inter-fx gap preservation + anti-over-suppression forward leg)
affects: [phase-53, 52.3 review close-out, playbackEngine, any future syncActiveSequence redesign]

# Actuals (#2632) — chars/4 over the realized diff, same scale as the plan estimate.
actuals:
  tokens: 1163
  tasks: 2
  commits: 2
plan_head_before: 649c5a46730b03bf1551dd2d1a6e97eb0eb717af

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-sided guard: fix the consumer (playback read) rather than the producer (frameMap enumeration) when the emitted sentinel value is itself the contract"

key-files:
  created: []
  modified:
    - app/src/lib/playbackEngine.test.ts
    - app/src/lib/playbackEngine.ts

key-decisions:
  - "Guard the outer condition in syncActiveSequence (`entry && entry.sequenceId !== ''`) rather than special-casing `''` inside — the block becomes a complete no-op for gap frames, exactly matching the pre-52.3 `entry === undefined` path for unowned positions"
  - "frameMap gap enumeration stays byte-identical: gap entries keep `sequenceId: ''`; only the playback consumer learns to ignore the sentinel (one-sided guard)"
  - "The forward owner-transition leg is pinned deliberately (fx-a -> fx-b still activates and still clears selectedKeyPhotoId) so the guard cannot over-suppress real activations (threat T-260920-j5r-01)"

patterns-established:
  - "Gap-frame no-op parity: an ownerless frame must behave in playback exactly as an ownerless position behaved pre-52.3 — no store write at all, not a write of the empty sentinel"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Scrubbing (drag-scrub or plain seek) onto a leading gap or an inter-fx gap preserves activeSequenceId and selectedKeyPhotoId; moving onto a paint entry owned by a different fx sequence still activates it (52.3-02 Pitfall-3 behavior preserved); frameMap gap enumeration, setActive, uiStore, timelineStore and the tick loop are untouched"
    verification:
      - kind: unit
        ref: "app/src/lib/playbackEngine.test.ts#playbackEngine paint-frame activation (52.3-02, Pitfall 3) — 'scrubbing onto a leading gap preserves the active sequence and key-photo selection' + 'scrubbing through an inter-fx gap keeps the previous owner and still activates the next one'"
        status: pass
      - kind: unit
        ref: "vitest run src/lib/playbackEngine.test.ts src/lib/frameMap.test.ts src/components/timeline/TimelineInteraction.test.ts — 3 files, 44 passed / 7 todo"
        status: pass
      - kind: unit
        ref: "vitest run (full app suite) — 216 files passed / 2 skipped, 4008 passed / 1 skipped / 101 todo"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit — exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Native UAT: sidebar keeps the fx sequence (and its properties) when the playhead is scrubbed onto a leading gap in a paint-only project with inFrame > 0; the export dialog's selected sequence survives the same scrub; the first fx stays selected through an inter-fx gap and the second activates on entering its span"
    verification: []
    human_judgment: true
    rationale: "Selection survival in the real sidebar/export dialog depends on the native WKWebView surface and on the sequence actually having properties worth losing — automation cannot judge the visible outcome, only the store writes it derives from"

# Metrics
duration: 2min
completed: 2026-09-20
status: complete
---

# Quick 260920-j5r: WR-01 Gap Scrub Guard Summary

**A scrubbed playhead landing on an ownerless gap entry no longer deselects the active sequence — one condition in `syncActiveSequence` restores the pre-52.3 behavior for gap frames while paint entries still activate their owning fx sequence.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-09-20T11:52:43Z
- **Completed:** 2026-09-20T11:54:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- RED-pinned the gap-scrub contract (2 cases) against pre-fix code, failing on exactly the two defects WR-01 names: `setActive('')` on a leading-gap scrub, and `activeSequenceId` collapsing to `''` on an inter-fx gap scrub
- Flipped both green with a single semantic change — `if (entry && entry.sequenceId !== '')` — leaving `setActive`, `uiStore.selectSequence` and `timelineStore.ensureTrackVisible` byte-identical inside the block, so a gap frame is a complete no-op
- Pinned the anti-over-suppression leg: a genuine owner transition (`fx-a` → `fx-b`) still activates and still clears `selectedKeyPhotoId`, proving the guard discriminates on the sentinel rather than suppressing activation generally (threat T-260920-j5r-01)
- Zero regression: the three-suite gate, `tsc --noEmit`, and the full app suite (216 files / 4008 tests) are all green; the `playbackEngine.ts` diff is exactly one condition line plus its comment

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — pin the gap-scrub preservation contract** - `86db2c19` (test)
2. **Task 2: GREEN — guard syncActiveSequence against ownerless gap entries** - `8f178095` (fix)

**Plan metadata commit:** handled by the orchestrator (docs commit out of scope for this executor run).

## Files Created/Modified

- `app/src/lib/playbackEngine.test.ts` — two cases appended to the existing `describe('playbackEngine paint-frame activation (52.3-02, Pitfall 3)')` (new cases at lines 306 and 341; file 369 lines). Both reuse that describe's existing harness — no new mocks, no new imports — and swap the frameMap mock with the established `(frameMap as unknown as {value: FrameEntry[]}).value = entries` pattern
- `app/src/lib/playbackEngine.ts` — `syncActiveSequence` (declared line 188): the outer condition at line 198 became `if (entry && entry.sequenceId !== '')`, preceded by a 7-line WR-01 rationale comment. Nothing else in the file changed (8 insertions / 1 deletion)

## RED Proof (verbatim)

Command: `cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/lib/playbackEngine.test.ts`

Result against pre-fix source — exactly the two new cases fail (exit code 1), every pre-existing case green:

```
 RUN  v2.1.9 /Users/lmarques/Dev/efx-motion-editor/app

 ❯ src/lib/playbackEngine.test.ts (21 tests | 2 failed | 7 skipped) 7ms
   × playbackEngine paint-frame activation (52.3-02, Pitfall 3) > scrubbing onto a leading gap preserves the active sequence and key-photo selection 2ms
     → expected "setActive" to not be called at all, but actually been called 1 times

Received: 

  1st setActive call:

    Array [
      "",
    ]


Number of calls: 1

   × playbackEngine paint-frame activation (52.3-02, Pitfall 3) > scrubbing through an inter-fx gap keeps the previous owner and still activates the next one 1ms
     → expected '' to be 'fx-a' // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯

 FAIL  src/lib/playbackEngine.test.ts > playbackEngine paint-frame activation (52.3-02, Pitfall 3) > scrubbing onto a leading gap preserves the active sequence and key-photo selection
AssertionError: expected "setActive" to not be called at all, but actually been called 1 times

Received: 

  1st setActive call:

    Array [
      "",
    ]


Number of calls: 1

 ❯ src/lib/playbackEngine.test.ts:336:27
    334|     // selectedKeyPhotoId, sequenceStore.ts:1091-1094).
    335|     playbackEngine.scrubToFrame(1);
    336|     expect(setActive).not.toHaveBeenCalled();
       |                           ^

⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/lib/playbackEngine.test.ts > playbackEngine paint-frame activation (52.3-02, Pitfall 3) > scrubbing through an inter-fx gap keeps the previous owner and still activates the next one
AssertionError: expected '' to be 'fx-a' // Object.is equality

- Expected
+ Received

- fx-a

 ❯ src/lib/playbackEngine.test.ts:360:50
    358|     // Inter-fx gap: neither the sequence nor its key-photo selection …
    359|     playbackEngine.scrubToFrame(2);
    360|     expect(sequenceStore.activeSequenceId.value).toBe('fx-a');
       |                                                  ^

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed | 12 passed | 7 todo (21)
```

Both failures are the same coupled write: `setActive('')` ran and `activeSequenceId` became `''`. Vitest reports the first failing assertion per test, so the `selectedKeyPhotoId` reads are not separately echoed here — but `setActive`'s body (`sequenceStore.ts:1091-1094`) writes `activeSequenceId` AND `selectedKeyPhotoId = null` in one call, so the observed `''` proves the key-photo selection was cleared by the same call. That single line is exactly what the guard must never reach for a gap entry.

Case B's opening leg (`scrubToFrame(0)` → `'fx-a'`) and closing leg (`scrubToFrame(3)` → `'fx-b'`) already passed at RED time, as designed — they are the anti-over-suppression pin, not part of the failing signature.

## Four Correctness Invariants (verdicts from reading the final playbackEngine.ts)

- **(a) All four call sites funnel through the one guard:** PASS — `syncActiveSequence` is called from `stop()` (line 83), `seekToFrame()` (line 110), `stepForward()` (line 175) and `stepBackward()` (line 183); `scrubToFrame()` (line 131) delegates to `seekToFrame`, so the drag-scrub path named in WR-01 is covered without a second site. The guard lives inside the method body (declared line 188, condition line 198), so one condition covers every path.
- **(b) Only gap entries change behavior:** PASS — the only `FrameEntry` producers in `app/src` are in `frameMap.ts` (content: `sequenceId: seq.id`, lines 30-40; paint: `sequenceId: owner.id`, line 66, where `owner` comes from the `fxSeqs` filter over `sequenceStore.sequences`). Content and paint ids are always real sequence ids, never `''`; the sole `''` producer is the gap arm at `frameMap.ts:68`. A tree-wide scan for `kind: 'gap'` / `kind: 'paint'` / `sequenceId: ''` found no other `FrameEntry` constructor (the remaining hits belong to `EfxPaintBackgroundFrameResolution` and the edit-history union — different types).
- **(c) The tick loop's own read is untouched and inert:** PASS — the unguarded `timelineStore.ensureTrackVisible(entry.sequenceId)` at line 404 still runs for every frame entry outside the guarded block and is a documented no-op (`timelineStore.ts:149-151`, "Linear timeline: single content row, no per-track vertical scroll"), so `''` there remains inert. The guarded write at line 203 is inside the block the condition now gates.
- **(d) The guard is one-sided:** PASS — `frameMap.ts` is byte-identical in this diff; gaps still emit `{kind: 'gap', globalFrame: f, sequenceId: ''}`. Enumeration is unchanged; only playback's read of the sentinel changed.

## Law Check (diff reading, not grep)

`git diff 649c5a46..HEAD -- app/src/lib/playbackEngine.ts` shows exactly two regions:

1. A 7-line comment above the condition, citing WR-01 / `52.3-REVIEW.md`, the `sequenceStore.ts:1091-1094` coupled write, and the pre-52.3 contract.
2. The condition itself: `if (entry) {` → `if (entry && entry.sequenceId !== '') {`.

Inside the block, `const activeId = ...peek()`, the `entry.sequenceId !== activeId` comparison, and the three writes (`sequenceStore.setActive`, `uiStore.selectSequence`, `timelineStore.ensureTrackVisible`) are byte-identical. `frameMap.ts`, `sequenceStore.ts`, `uiStore.ts`, `timelineStore.ts`, the tick loop, and the audio/scrub paths show zero diff. Diffstat for the whole plan: 2 files changed, 72 insertions, 1 deletion — 64 of the insertions are the test file.

## Wide-Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Targeted (RED) | `vitest run src/lib/playbackEngine.test.ts` | 2 failed / 12 passed / 7 todo (the RED proof above) |
| Targeted (GREEN) | `vitest run src/lib/playbackEngine.test.ts` | 21 tests — both new cases pass, every pre-existing case green |
| Regression | `vitest run src/lib/playbackEngine.test.ts src/lib/frameMap.test.ts src/components/timeline/TimelineInteraction.test.ts` | 3 files passed, 44 passed / 7 todo (baseline 42 + the 2 new cases) |
| Types | `pnpm --filter efx-motion-editor exec tsc --noEmit` | clean (exit 0) |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | 216 files passed / 2 skipped, 4008 passed / 1 skipped / 101 todo, 0 failures (exit 0) |
| Scope | `git diff --name-only 649c5a46..HEAD` | exactly `app/src/lib/playbackEngine.test.ts` + `app/src/lib/playbackEngine.ts` |

**Pre-existing failures attribution:** none to attribute — the full suite is fully green at this HEAD. The 9 failures named in STATE.md Blockers (roto persistence x7, the `base64ToBytes` frame-transport token in `app/src/lib/ipc.ts`, `efxPaintPersistence` base64) do not fail here; they were cleared by intervening 52.2/52.3 work. Nothing was silently absorbed by this quick and nothing here was fixed for them.

## Threat Register Outcome

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-260920-j5r-01 (over-broad guard suppresses legitimate activation) | mitigate | CLOSED — Case B's closing leg asserts `fx-a` → `fx-b` still calls `setActive('fx-b')` and that its documented `selectedKeyPhotoId` clear still runs; green in the targeted and regression gates |
| T-260920-j5r-02 (stale active sequence after the fix) | accept | As planned — only frames owning no sequence are skipped; every paint/content entry still syncs, matching pre-52.3 behavior for unowned positions |
| T-260920-j5r-03 (sidebar/export selection persistence) | accept | As planned — no new data surfaced or persisted; no state leaves the process |
| T-260920-j5r-SC (package installs) | accept | No dependency changes — no package-legitimacy gate required |

## Deviations from Plan

None — plan executed exactly as written. The two cases landed inside the existing describe with its harness reused verbatim, the production change was the single condition plus its comment, and no assertion was weakened or deleted.

## Issues Encountered

None. The harness swap worked as-is; the plan's line references (`syncActiveSequence` at 188-199) held against the pre-edit file, and the guard now sits at line 198 (the comment shifted the tick loop read from 397 to 404, which is why verdict (c) cites both numbers).

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. One boolean condition on an in-process playback→store sync path, exactly as the plan's threat model scoped it.

## User Setup Required

None - no external service configuration required.

## Native UAT — PENDING (owed by the user; NOT claimed as passed)

1. Paint-only project with an fx sequence whose `inFrame > 0`: select that fx sequence in the sidebar, then drag-scrub the playhead onto the leading gap before its span. Expected: the sidebar keeps the fx sequence selected with its properties (no selection loss), and the export dialog's selected sequence stays that fx sequence.
2. Same project (or one with two paint spans): scrub across the inter-fx gap. Expected: the first fx stays selected through the gap, and the second fx activates when the playhead enters its span.
3. Regression: scrub into a paint span still auto-selects its owning fx sequence (52.3-02 Pitfall-3 behavior preserved).

## Next Phase Readiness

- WR-01 (52.3 review Warning) is implementation-complete and test-pinned; only native UAT remains before it can be closed in the 52.3 review ledger.
- The remaining 52.3 review items (WR-02 D-06 clear / cold-decode anti-flicker, WR-03 single-owner vs composite-all, WR-04 preload clamp, WR-05's overlapping-fx enumeration test, IN-01..IN-05) are untouched by this quick and stay open.
- No blockers. Phase 53 acceptance work can rely on gap frames no longer deselecting the active sequence.

## Self-Check: PASSED

- FOUND: app/src/lib/playbackEngine.test.ts (modified, +64 lines; new cases at 306 and 341)
- FOUND: app/src/lib/playbackEngine.ts (modified, 8 insertions / 1 deletion; guard at line 198)
- FOUND: commit 86db2c19 (Task 1 RED test)
- FOUND: commit 8f178095 (Task 2 GREEN fix)
- Measured commits from ledger 649c5a46..HEAD: 2 (matches frontmatter)
- Working tree clean (code); scope gate clean; no untracked files introduced

---
*Phase: quick-260920-j5r*
*Completed: 2026-09-20*
