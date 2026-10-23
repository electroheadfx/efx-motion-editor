---
phase: quick-261023-cxc
plan: 261023-cxc
subsystem: physic-paint-roto
tags: [preact, signals, roto, duplicate, script-apply, watercolor, tdd, tracer]
requires:
  - phase: quick-261023-bxm
    provides: the settle-then-clone fallback, its fail-closed source-paint settlement, and the empty-cell promotion seam reused unchanged
provides:
  - Script-aware bottom-timeline Duplicate for brush keys (captured live strokes applied at the blank promoted destination)
  - Watercolor duplicate bake plus a fresh-id recorded timeline copy that stays re-editable
  - Pure decision table, bounded source-frame wait, and port-driven orchestrator (physicsPaintRotoDuplicateScript)
  - Clipboard-free applyProvidedScript seam on the script clipboard controller
affects: [roto-timeline-actions, roto-key-duplicate, script-apply-flow, watercolor-record]
actuals:
  tokens: 15529
  tasks: 3
  commits: 2
plan_head_before: 20e7c8699a9ef89e950ea2348c3dc91cad267bf6
plan_head_after: 4427ec0b21c5ec77a65adbf064b861a155c54e22
tech-stack:
  added: []
  patterns:
    - "Pure decision table as the single eligibility law: only a real source key whose NEXT cell is empty and inside capacity may take the script path"
    - "Bounded signal wait (effect + one setTimeout, 2000 ms) that resolves ready / superseded / timeout — never a polling loop or ad-hoc sleep"
    - "Port-driven orchestrator: pre-navigation failure returns fallback (bxm clone runs in the same click), post-navigation failure returns aborted with an explicit message"
    - "Replace-never-mutate watercolor copy: project each event to a NEW stroke, allocate a fresh id through enqueueRecordedStroke, record with the destination playFrame"
key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
key-decisions:
  - "Only an EMPTY source+1 cell is eligible: the existing promotion seam builds a blank key there, so the script path can never double-paint a raster clone"
  - "The 261023-bxm settle-then-clone stays the fallback and keeps its module byte-identical; duplicateKey wraps it in keyActionInFlight so the sequence cannot re-enter"
  - "applyProvidedScript reuses dispatchApply and never reads or writes the script clipboard — the transient script lives only in the duplicate closure"
  - "Watercolor Dry events stay in the apply list (timeline order) but are skipped by the record copy: they are sheet actions, not per-key paint"
  - "The destination wait subscribes to rotoScript.source and aborts on any third frame, so user navigation never paints a stale key"
requirements-completed: []
coverage:
  - id: D1
    description: "Brush: Duplicate captures the source's live strokes, navigates, waits for the destination frame, and applies them so the new key is selected, painted, same-rail, and Move/Select editable"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts (26 Task 1 tests: decision table, bounded wait, orchestrator order/aborts)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts (6 applyProvidedScript tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts (7 duplicateWithScript tests)"
        status: pass
    human_judgment: true
    rationale: "Live UAT rows 1-4 are PENDING — the painted/editable result must be confirmed in the app by the user"
  - id: D2
    description: "Watercolor: the duplicate bakes the timeline and records a fresh-id copy on its own frame, so Move/Delete/stack-step edit the duplicate and never the source"
    verification:
      - kind: unit
        ref: "physicsPaintRotoDuplicateScript.test.ts (projection, Dry-skip, immutability, copy and watercolor orchestrator tests)"
        status: pass
      - kind: unit
        ref: "view/aquarelleRecordState.move.test.ts + .delete.test.ts + .reorder.test.ts (25 tests)"
        status: pass
    human_judgment: true
    rationale: "Live UAT rows 5-7 are PENDING user confirmation"
  - id: D3
    description: "Occupied/over-capacity destination or no script falls back to the unchanged 261023-bxm clone; user navigation aborts without creating a key"
    verification:
      - kind: unit
        ref: "decision-table and orchestrator tests (fallback reasons, aborted messages, superseded/timeout)"
        status: pass
      - kind: unit
        ref: "the pre-existing 261023-bxm duplicate assertions inside useRotoKeyUtilities.test.ts stay green"
        status: pass
    human_judgment: true
    rationale: "Live UAT rows 3, 4, 7, 8 are PENDING user confirmation"
duration: 15min
completed: 2026-10-23
status: complete
---

# Quick 261023-cxc: Script-aware Duplicate Summary

**Bottom-timeline Duplicate now produces an editable key when the source carries a script — captured brush strokes apply onto the blank promoted destination, and watercolor timelines are re-recorded with fresh ids — while an occupied cell, an over-capacity destination, or no script keeps the unchanged 261023-bxm settle-then-clone.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-10-23T07:26:00Z (approx.)
- **Completed:** 2026-10-23T07:41:00Z (automated gates); live UAT pending
- **Tasks:** 3 (2 committed, Task 3 gate-only)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- Added `physicsPaintRotoDuplicateScript.ts`: the locked decision table (`source-changed` → `destination-out-of-capacity` → `destination-occupied` → `no-script`), a bounded `effect`-based destination wait (2000 ms; `ready` / `superseded` / `timeout`), and `runRotoDuplicateWithScript` over explicit ports.
- The orchestrator applies only after the destination frame is the live script source; `fallback` is returned only for pre-navigation failures so the 261023-bxm clone can run in the same click, while every post-navigation failure returns `aborted` with a direct message and never clones.
- `applyProvidedScript` was added to the script clipboard controller: it reuses `dispatchApply` (validation, promotion, publication, operation lease) and never reads or writes the clipboard; the `source` signal is exposed for the wait.
- `useRotoKeyUtilities.duplicateKey` is now a guarded wrapper: `keyActionInFlight` covers the whole sequence, `handled` and `aborted` skip the clone, `fallback` runs the unchanged settle-then-clone, and a rejected port publishes the generic error while clearing the in-flight latch.
- Watercolor: `aquarelleStrokeFromScriptEvent` projects a recorded event back onto the engine-2 runtime stroke (raw points, engine payload, destination playFrame, never the source id); `copyAquarelleScriptToFrame` skips Dry, allocates one fresh id per stroke in recording order, records each stroke, and leaves the source events untouched.
- The Studio fills `recordAquarelleScriptCopy` with the same `enqueueRecordedStroke` + `recordAquarelleStroke` pair the live stroke-end path uses, returning true only when at least one stroke was recorded.
- The resolver, physical model, 261023-bxm module/tests, bridge, manifests, schema, and the duplicate +1 ripple are untouched.

## Task Commits

Each task was committed atomically (code only; the orchestrator owns the docs commit):

1. **Task 1: Script-aware decision, bounded wait, orchestrator, controller and hook wiring (tracer, TDD)** — `bad7eb1d` (feat)
2. **Task 2: Watercolor projection + fresh-id timeline copy + Studio record port (TDD)** — `4427ec0b` (feat)
3. **Task 3: Adjacent-suite gate, full-suite allowlist, guardrail audit** — no code commit (no production edit was required)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts` — decision table, bounded wait, projection/copy helpers, orchestrator, abort messages
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts` — 36 tests (decision, wait, brush + watercolor orchestration, projection, Dry-skip, immutability)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` — `source` signal + `applyProvidedScript` through the shared apply seam
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts` — 6 `applyProvidedScript` tests
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — `duplicateWithScript` port, `keyActionInFlight`, `runSettleThenClone` extraction
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts` — harness extension + 7 duplicateWithScript tests
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `duplicateWithScript` ports, late-bound navigation ref, `recordAquarelleScriptCopy`

## RED / GREEN Evidence

**RED 1 (Task 1, module and seams missing):**

```
FAIL physicsPaintRotoDuplicateScript.test.ts [ module does not exist yet ]
FAIL useRotoKeyUtilities.test.ts > duplicateWithScript > handled: neither settles the source nor runs the raster clone
FAIL useRotoKeyUtilities.test.ts > duplicateWithScript > fallback: runs the unchanged settle-then-clone ...
FAIL useRotoKeyUtilities.test.ts > duplicateWithScript > aborted: neither settles the source ...
FAIL useRotoKeyUtilities.test.ts > duplicateWithScript > publishes the generic duplicate error when the script port rejects
FAIL useRotoKeyUtilities.test.ts > duplicateWithScript > keyActionInFlight blocks a second invocation and always clears
FAIL physicsPaintRotoScriptClipboard.test.ts > applyProvidedScript (6 tests)
Test Files  3 failed (3)
     Tests  11 failed | 87 passed (98)
```

**GREEN 1 (after implementation, zero test edits):**

```
✓ physicsPaintRotoDuplicateScript.test.ts (26 tests)
✓ useRotoKeyUtilities.test.ts (30 tests)
✓ physicsPaintRotoScriptClipboard.test.ts (68 tests)
Test Files  3 passed (3) / Tests  124 passed (124)
```

**RED 2 (Task 2, projection/copy missing):**

```
✓ aquarelleStrokeFromScriptEvent > projects the engine payload ...               × 3 projection tests
✗ aquarelleStrokeFromScriptEvent > never carries the source mutation id         TypeError: ... is not a function
✗ copyAquarelleScriptToFrame (3 tests)                                          TypeError: ... is not a function
Test Files  1 failed (1)
     Tests  6 failed | 30 passed (36)
```

The four watercolor orchestrator tests were green at RED: Task 1's orchestrator already sequenced apply-before-record; Task 2 pins that order as a regression gate rather than changing it.

**GREEN 2 (after implementation):**

```
✓ physicsPaintRotoDuplicateScript.test.ts (36 tests)
✓ physicsPaintRotoScriptClipboard.test.ts (68 tests)
✓ aquarelleRecordState.move.test.ts (10 tests)
✓ aquarelleRecordState.delete.test.ts (7 tests)
✓ aquarelleRecordState.reorder.test.ts (8 tests)
Test Files  5 passed (5) / Tests  129 passed (129)
```

## Automated Gates

| Gate | Command (cwd = repo root) | Result |
|---|---|---|
| Baseline typecheck | `pnpm --filter efx-motion-editor run typecheck` | 15 pre-existing `error TS`, count captured in `/tmp/cxc-typecheck-baseline.txt` |
| Task 1 suites | `vitest run .../physicsPaintRotoDuplicateScript.test.ts .../useRotoKeyUtilities.test.ts .../physicsPaintRotoScriptClipboard.test.ts` | 3 files, 124/124 tests pass |
| Task 1 typecheck | `pnpm --filter efx-motion-editor run typecheck` → `/tmp/cxc-typecheck-task1.txt` | 15 = baseline; error set identical to baseline |
| Task 2 suites | `vitest run` duplicate-script + clipboard + aquarelle move/delete/reorder | 5 files, 129/129 tests pass |
| Task 2 typecheck | `pnpm --filter efx-motion-editor run typecheck` → `/tmp/cxc-typecheck-task2.txt` | 15 = baseline; error set identical to baseline |
| Task 3 adjacent suites | resolver + physical-edit coordinator + timeline actions + previous-key-base + play-script controller + clipboard | 6 files, 651/651 tests pass |
| Task 3 full suite | `pnpm --filter efx-motion-editor exec vitest run` → `/tmp/cxc-full-suite.txt` | 317 files: 6 failed / 309 passed / 2 skipped; 5648 tests: 9 failed / 5542 passed / 1 skipped / 96 todo |
| Task 3 typecheck | `pnpm --filter efx-motion-editor run typecheck` → `/tmp/cxc-typecheck-task3.txt` | 15 = baseline; error set identical to baseline |

**Full-suite allowlist:** all 6 failing files are the plan's known pre-existing allowlist — `PhysicsPaintRightSidebar`, `PhysicsPaintWorkflowStrip.viewport`, `efxPaintCompositorMatrix` (2 tests), `exportEngine`, `paperPass.frameGuard`, and `rotoCompletionPaintGuard` (2 tests, documented as failing at the base commit in the 261023-bxm SUMMARY). The allowlist gate expression returned 0.

## Guardrail Audit

- `git diff --stat 20e7c869..HEAD` shows exactly the plan's seven files (1290 insertions, 43 deletions); the working tree is clean.
- Empty diff confirmed for `physicsPaintRotoPhysicalResolver.ts`, `physicsPaintRotoPhysicalModel.ts`, `physicsPaintRotoDuplicateSourcePaint.ts`, `physicPaintBridge.ts`, `app/package.json`, and `pnpm-lock.yaml`.
- No `.test.tsx` file added.
- No `useState`/`useEffect` line added in any touched source file.
- No `renderFromStrokes` usage in the touched source files.
- No dependency changes; no app or dev-server run (live UAT is user-run).
- The 261023-bxm module and its tests are untouched (`git diff --name-only` shows no bxm path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Zero-brush guard in `applyProvidedScript`**
- **Found during:** Task 1
- **Issue:** `dispatchApply` starts an operation lease and only settles when a stroke completes; a provided script with neither brushes nor aquarelle events would latch `busy` forever.
- **Fix:** Return `false` before `beginOperation` when the script carries no brushes and no aquarelle events (documented in code). No behavior change for any script the capture ports can produce.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
- **Commit:** `bad7eb1d`

Otherwise the plan executed exactly as written. No architectural decisions (Rule 4) were required.

## Issues Encountered

- The first Task 1 typecheck after implementation reported 16 errors against a 15-error baseline. The single new error was a `null` `layerId` in the new `applyProvidedScript` test fixture (the provenance field is non-nullable); changing the fixture to a string restored the exact baseline error set before the Task 1 commit.
- The test harness initially failed 7 orchestrator assertions because default ports were plain functions, not spies. Wrapping every default port in `vi.fn(...)` fixed the harness; no production code changed.
- Task 2's watercolor orchestrator tests passing at RED is expected: the apply-before-record order was already implemented in Task 1 as part of the same vertical slice. The six projection/copy tests supplied the behavioral RED.

## Live UAT Matrix — PENDING

The quick stays automated-ready until every row passes in the app (user-run; the executor did not run the app).

| # | Step | Expected | Status |
|---|------|----------|--------|
| 1 | Brush: paint/apply a script on key N where N+1 is a free frame, press bottom-timeline Duplicate | Key N+1 appears selected, renders the same paint, sits on the source's rail; the Move tool selects and moves its strokes; the source key is unchanged | PENDING |
| 2 | Brush: Duplicate again after moving the duplicate's strokes | The next key carries the MOVED strokes (the duplicate's live script), not the source's original stroke positions | PENDING |
| 3 | Brush: put a real key at N+1 first, then Duplicate key N | Unchanged ripple clone: the new key lands at N+1, the previous N+1 key shifts to N+2, same rail | PENDING |
| 4 | Brush: a key with no live strokes (raster-only) on a free next frame, Duplicate | Unchanged 261023-bxm cache/display clone; no error | PENDING |
| 5 | Watercolor: a key with recorded strokes on a free next frame, Duplicate | Key N+1 appears selected and painted; Move, Alt+click Delete, and stack-step act on the duplicate; the source key is unchanged | PENDING |
| 6 | Watercolor: Duplicate again after moving the duplicate's strokes | The next key carries the moved watercolor strokes; editing it never changes the previous keys | PENDING |
| 7 | Watercolor: a key with no recorded events on a free next frame, Duplicate | Cache/display clone (261023-bxm fallback); no pixels-only key is silently presented as re-editable | PENDING |
| 8 | Any module: start Duplicate and immediately navigate to another frame | No key appears at N+1; an explicit interruption message is shown; the Studio stays usable | PENDING |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Automated evidence complete; the quick is automated-ready.
- Remaining gate: the eight live UAT rows above. Do not mark the quick closed before the user confirms them.
- Per the dispatch constraints, the SUMMARY was written but not committed, and STATE.md / ROADMAP.md were left untouched for the orchestrator's docs commit.

---
*Quick: 261023-cxc*
*Completed: 2026-10-23 (automated gates); live UAT pending*

## Self-Check: PASSED

- Both created source/test files present on disk.
- Commits `bad7eb1d` and `4427ec0b` are ancestors of HEAD.
- SUMMARY.md written at the required path with `status: complete` and all eight live UAT rows marked PENDING.
- Working tree contains only the uncommitted SUMMARY.md (docs commit deferred to the orchestrator by instruction).
