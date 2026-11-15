---
phase: 63-brush-tip-pipeline
plan: 12
subsystem: paint
tags: [preact-signals, bridge-transport, tauri-events, wr-04, tip-01, named-refusals, tdd]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-05's injectable import handler and bridge tests, 63-02's encode command, and 63-10's request/result wire guards"
provides:
  - "A caught publish port: the bridge injects `publishPhysicPaintBrushCatalog().catch(...)`, so a failed notification settles the awaited port instead of rejecting the answer"
  - "A total `applyRequest`: a handler throw answers `{ok:false, reason:'encode-failed'}`, leaving no unhandled rejection on any of the three registrations"
  - "A total `emitResult`: a Tauri `emitTo` failure is logged, never thrown into a listener body"
  - "A non-fatal publish step in `applyBrushImportRequest`: rejection or synchronous throw is logged and the landed import still answers `{ok:true, entry}`"
  - "TIP-01 boundary pins at both seams: the wire guard admits exactly 36,864 decoded bytes and refuses one byte either side; the handler refuses 36,865 before any IPC or publish"
affects: [63-brush-tip-pipeline, v2.2.0]

actuals:
  tokens: 4606
  tasks: 2
  commits: 4
  plan_head_before: 1482d563f5130b774496f9ae1768a41eaf47536e
  plan_head_after: 5409a4c4f2c0533d29d0b3c58ac19c41d0346403

tech-stack:
  added: []
  patterns:
    - "The publish is a notification, not part of the answer: the mutation batch is the commit point, so a notification failure is logged and the answer still reports the landed work"
    - "Totality at the answer seam: the producer (`applyRequest`) and the emitter (`emitResult`) catch their own failures, so every registration is rejection-free without per-registration try/catch"
    - "Boundary laws are pinned symmetrically one byte either side of the exact count, at the wire guard and at the handler"

key-files:
  created: []
  modified:
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/efxPaintBrushImport.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/lib/efxPaintBrushImport.test.ts

key-decisions:
  - "The publish port is wrapped at injection (`publishPhysicPaintBrushCatalog().catch(...)`) and RETURNED, not voided: `applyBrushImportRequest` awaits it to preserve the pinned request → catalog → result order, and `.catch` settles only after the publish attempt does"
  - "The encode-rejection answer reuses the result type's existing catch-all `encode-failed` rather than adding a new refusal reason — the wire result union stays unchanged"
  - "The handler owns the answer for its own publish failure too (try/catch around `await ports.publishCatalog()`), so any caller — not only the bridge — gets the D-15 law; defence in depth at the seam the plan names"
  - "A throwing handler is answered inside `applyRequest` rather than in each registration: one total producer and one total emitter make all three transports rejection-free by construction"

patterns-established:
  - "A notification step is wrapped where the consequence lives: the port is caught at injection for transport ordering, and again at the handler for the domain law"
  - "A structurally valid request always produces a result — success or a named refusal — so no 15 s timeout can stand in for an answer"

requirements-completed: [TIP-01, TIP-05]

coverage:
  - id: D1
    description: "An import whose catalog publish rejects after the mutation landed still answers the Studio `{ok:true, entry}`: the catalog row, registered mask and remembered bytes survive, and the failure is logged (WR-04)"
    requirement: TIP-05
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#import round trip through the main realm > answers success when the catalog publish rejects after the mutation landed (WR-04)"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintBrushImport.test.ts#applyBrushImportRequest — a publish failure is never the import failure (WR-04) > a rejecting publish port still answers success and keeps the landed mutation"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintBrushImport.test.ts#applyBrushImportRequest — a publish failure is never the import failure (WR-04) > a port that throws synchronously is treated the same as a rejection"
        status: pass
    human_judgment: false
  - id: D2
    description: "A handler throw (the encode IPC rejecting) answers `{ok:false, reason:'encode-failed'}` through both the Tauri listener and the window CustomEvent registration, leaving no unhandled rejection or silent timeout (WR-04)"
    requirement: TIP-05
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#import round trip through the main realm > answers {ok:false, reason:encode-failed} when the encode IPC rejects (WR-04)"
        status: pass
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#import round trip through the main realm > answers a named failure through the window CustomEvent registration (WR-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The import mask boundary is exact at both seams: the wire guard is true at exactly 36,864 decoded bytes and false at 36,863/36,865; the handler refuses 36,865 with `bad-mask` before any IPC call, publish or mutation (TIP-01)"
    requirement: TIP-01
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#catalog payload guard (T-63-04) > pins the import wire guard at exactly 36,864 decoded mask bytes (TIP-01)"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintBrushImport.test.ts#applyBrushImportRequest — refusals are total (T-63-04) > a mask one byte above 36,864 is refused the same way (TIP-01 boundary)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The success path keeps its pinned order: the catalog publish completes before the result event (request → catalog → result), and the result still carries status and identity only"
    requirement: TIP-05
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#import round trip through the main realm > answers success when the catalog publish rejects after the mutation landed (WR-04) (ledger order [request, catalog, result])"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintBrushImport.test.ts#applyBrushImportRequest — the one mutation path > publishes AFTER the mutation and BEFORE the answer"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintBrushImport.test.ts#applyBrushImportRequest — the one mutation path > the result carries status and identity only — no mask and no bytes"
        status: pass
    human_judgment: false

duration: ~8min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 12: Gap Closure WR-04 / TIP-01 Summary

**An import that already landed can no longer be reported as a 15 s timeout because its catalog push or its encode call failed: every structurally valid request now answers success or a named failure, and the 36,864-byte mask boundary is pinned at both seams**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-11-15T15:44:00Z
- **Completed:** 2026-11-15T15:51:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- **WR-04 closed at the bridge:** `installPhysicPaintBrushImportListener` now injects `publishPhysicPaintBrushCatalog().catch(...)` — logging `'[physicPaintBridge] Brush catalog publish failed'` — and RETURNS that caught promise, so `applyBrushImportRequest`'s await still orders the catalog push ahead of the result event without ever rejecting the answer path. `applyRequest` wraps the handler call in try/catch and answers `{operationId, ok:false, reason:'encode-failed'}` on a throw. `emitResult` catches a Tauri `emitTo` failure and logs it. With producer and emitter total, none of the three registrations (Tauri listener, window CustomEvent, origin-checked message) has a rejection path.
- **WR-04 closed at the handler:** `applyBrushImportRequest` wraps `await ports.publishCatalog()` in try/catch, logs `'[efxPaintBrushImport] Brush catalog publish failed'`, and still returns `{ok:true, entry}`. The mutation batch (registerMask, addCustomBrushTip, rememberBrushAsset, markDirty) is the commit point (D-15 — an import is not undoable); a failed notification can no longer misreport it. The ports docstring now states the contract: a publish implementation may reject or throw synchronously, and the handler owns the answer.
- **TIP-01 boundary pinned at both seams:** the wire guard admits exactly 36,864 decoded mask bytes and refuses 36,863 and 36,865; the handler refuses 36,865 with `bad-mask` before any IPC call, publish or mutation (mirroring the existing 36,863 pin).
- **Plan verification:** `pnpm --filter @efxlab/efx-watercolor build` succeeded; `pnpm --filter efx-motion-editor exec vitest run src/lib/physicPaintBridge.test.ts src/lib/efxPaintBrushImport.test.ts` → 2 files, 192 passed, 1 skipped.
- **Threat mitigation applied and pinned:** T-63-30 (Repudiation) — a landed mutation is never reported as a failure or timeout; a publish or emit rejection cannot kill the answer path; tests cover the publish-failure, encode-rejection and window-transport paths. T-63-SC holds: no dependency change.

## Task Commits

Each task was committed atomically; Task 2 followed the TDD test-then-feat sequence:

1. **Task 1: End-to-end — an import whose catalog publish fails still answers the Studio** — `cef515bc6` (feat) → `ed2d9bc04` (test: load-tolerant answer-wait budget)
2. **Task 2: Handler law — a publish failure is never the import's failure** — `bc22709c4` (test, RED) → `5409a4c4f` (feat, GREEN)

_Note: TDD tasks may have multiple commits (test → feat → refactor). Only Task 2 carried `tdd="true"`; Task 1 is the plan's tracer slice._

## Files Created/Modified

- `app/src/lib/physicPaintBridge.ts` — caught publish port injection in `installPhysicPaintBrushImportListener`; try/catch around the handler call in `applyRequest` answering `encode-failed`; try/catch around the Tauri `emitTo` in `emitResult`
- `app/src/lib/efxPaintBrushImport.ts` — explicit `publishCatalog` port contract in the docstring; non-fatal publish step that logs and always answers `{ok:true, entry}`
- `app/src/lib/physicPaintBridge.test.ts` — TIP-01 wire-guard boundary pin; publish-rejection success test (ledger order request → catalog → result, mutation retained); encode-rejection test through the Tauri harness; window-transport named-failure test with a load-tolerant wait
- `app/src/lib/efxPaintBrushImport.test.ts` — the WR-04 describe (rejecting async port, synchronously-throwing port: success answer, catalog identity, mask identity, warning) and the 36,865-byte refusal pin

## Decisions Made

- **Wrap the port at injection AND at the handler.** The bridge-level `.catch` is what preserves the pinned request → catalog → result order without a rejection reaching the answer; the handler-level try/catch makes the same law hold for any other caller. The plan asked for both, and the duplication is intentional defence at different seams.
- **Reuse `encode-failed` for a thrown handler.** The result union already has a catch-all refusal; adding a new reason would widen the wire contract the Studio validates.
- **One total producer and one total emitter instead of per-registration catches.** Three registrations that cannot take a rejection is a stronger invariant than three identical catches, and it is pinned through both transport paths.
- **The RED evidence uses the full qualified test name.** The classifier matches on `file > suite > test`; the leaf name alone produced `INVALID_RED`/`no_target_test_failure` until the identity was corrected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Hoisted `vi.doMock` factory cannot reference module constants**
- **Found during:** Task 1 (bridge tests, publish-rejection path)
- **Issue:** the `vi.doMock('@tauri-apps/api/event', ...)` factory is hoisted above the module's imports, so referencing `PHYSIC_PAINT_BRUSH_CATALOG_EVENT` inside it threw `ReferenceError`.
- **Fix:** compare against the literal `'physic-paint:brush-catalog'` inside the factory, with a comment tying it to the constant's value.
- **Files modified:** `app/src/lib/physicPaintBridge.test.ts`
- **Verification:** the publish-rejection test passes and the ledger order assertion holds.
- **Committed in:** `cef515bc6` (part of Task 1 commit)

**2. [Rule 1 - Bug] Load-tolerant budget for the window-transport answer wait**
- **Found during:** Task 1 tracer feedback gate
- **Issue:** one full-file run of the bridge tests exited non-zero at 8.68 s (vs the usual ~1.7 s); the new window-transport test polls for the dispatched result CustomEvent, and under unusual load the wait could exhaust its default budget.
- **Fix:** gave `vi.waitFor` an explicit `{ timeout: 5_000 }` budget.
- **Files modified:** `app/src/lib/physicPaintBridge.test.ts`
- **Verification:** 9 consecutive full-file runs green after the change; the failure never reproduced.
- **Committed in:** `ed2d9bc04` (separate test commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** No scope change; both fixes keep the planned behavior and only make the pins reliable.

## TDD Gate Compliance

Plan frontmatter is `type: execute`; Task 2 carries `tdd="true"` (`task.is-behavior-adding` returned true before execution).

- **RED:** the two WR-04 publish-failure pins plus the 36,865-byte refusal pin were committed as `bc22709c4` after `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` against `63-12-red-evidence-task2.json` (exit 1, 14 tests: 12 pass, 2 fail — both publish-failure pins failed with the raw `catalog push refused` / `sync refusal` errors escaping the handler, exactly as WR-04 describes).
- **GREEN:** the handler change followed as `5409a4c4f`; the same file then reported 14/14 passing.

## Issues Encountered

- **RED evidence reporter mismatch:** `--reporter=tap` yields nested TAP whose only top-level entry is the file-level `not ok`, which the classifier cannot match to a test. Re-captured with `--reporter=tap-flat` (14 flat entries) and the full qualified `file > suite > test` name as `targetTest`; the record then validated `RED_EVIDENCE_OK`. The capture was regenerated from a fresh run, never hand-edited.
- **TAP stdout pollution:** on exit 1 pnpm appends `undefined` plus its `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` banner after the TAP report; the evidence record was cut at the `undefined` line so the report starts and ends as TAP (`report_errors` empty).
- **Unreproduced flake:** one tracer-gate run was slow and non-zero (8.68 s); 9 re-runs were green. Hardened the affected wait (deviation 2) and documented it rather than chasing a phantom.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - no new surface. T-63-30 mitigated and pinned (publish/emit failures are logged, handler throws answer a named refusal, the landed mutation is never misreported), T-63-SC holds (no dependency change).

## Next Phase Readiness

- With this plan, all 14 phase-63 plans have SUMMARYs; the phase is ready for verification. The phase remains in its current branch state, no migration needed.
- Any future transport added to the brush import must keep the two invariants this plan installed: the producer and emitter are total, and the publish step never owns the answer.
- The handler's port contract is now documented, so future publishers can reject freely knowing the failure is logged and non-fatal.

---

*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- All four modified files, this SUMMARY and the Task 2 RED evidence record exist on disk.
- Commits `cef515bc6`, `ed2d9bc04`, `bc22709c4` and `5409a4c4f` are ancestors of HEAD.
