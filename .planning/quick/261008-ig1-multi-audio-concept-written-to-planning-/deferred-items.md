# Deferred items — quick 261008-ig1 (Multi-audio concept, core slice)

## Pre-existing failures discovered during Task 1 (out of scope, NOT fixed)

### 1. `src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — collection-level circular-init failure

- **Kind:** pre-existing defect (baseline HEAD `1362a19d`)
- **Error:** `TypeError: _setPaintMarkDirtyCallback is not a function` at
  `src/stores/projectStore.ts:1153` reached from `src/stores/paintStore.ts:7`
  (paintStore → projectStore ESM init cycle: when paintStore is evaluated
  first, projectStore's module body calls into paintStore before its
  function exports are bound).
- **Baseline evidence:** run against a detached read-only worktree of the
  pre-task commit (`git worktree add /tmp/gsd-baseline-ig1 --detach HEAD`,
  HEAD = `1362a19d`, ledger base) — the test fails there identically:
  `FAIL src/components/physic-paint/view/PhysicsPaintStudioView.test.ts`
  with the same stack. Baseline full suite: `2 failed suites / 0 failed
  tests` (this file + `src/viteBuild.test.ts`, the latter an artifact of the
  symlinked-node_modules worktree environment — it passes in the main
  checkout).
- **Scope decision:** no import line changed anywhere in 261008-ig1's diff
  (`git diff | grep '^[+-]import'` is empty), so the module graph of this
  test is identical to baseline — the failure cannot be caused by this
  quick. Deviation rules scope boundary: pre-existing, logged, not fixed.
- **Follow-up suggestion:** late-bind the projectStore → paintStore wiring
  (e.g. move `_setPaintMarkDirtyCallback(...)` behind a microtask or import
  paintStore lazily) in a dedicated quick.
