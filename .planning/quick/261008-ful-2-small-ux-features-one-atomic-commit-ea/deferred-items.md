# Deferred Items — quick 261008-ful

Out-of-scope discoveries logged during execution (scope-boundary rule: pre-existing, unrelated files, NOT fixed).

## 1. Pre-existing typecheck failures (3 errors)

- **Discovered:** Task 1 verification (`pnpm --filter efx-motion-editor run typecheck`)
- **Status:** pre-existing at plan base `ce5f6744` (proven by tsc in a detached worktree at HEAD), identical after both quick commits
- **Errors:**
  - `app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts(95,51)`: TS2322 — `Type '"move"' is not assignable to type 'ToolType'`
  - `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx(63,34)`: TS2367 — comparison between `'ToolType'` and `'"move"'` has no overlap
  - `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx(124,42)`: TS2345 — `'"move"'` not assignable to `ToolType`
- **Origin:** quick 261004-dn5 (`move` tool arm) — `ToolType` union never gained `'move'`
- **Route to:** a follow-up quick in the 261004-dn5 cluster (e.g. next small-fix queue), NOT this quick

## 2. Pre-existing full-suite failure (1 test file)

- **Discovered:** final full `vitest run`
- **Status:** fails identically at baseline `ce5f6744` and after this quick — no NEW failures (baseline 243 files: 1 failed/240 passed/2 skipped → final 245 files: 1 failed/242 passed/2 skipped; +2 = this quick's new passing tests)
- **Failure:** `app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — `TypeError: _setPaintMarkDirtyCallback is not a function` at `app/src/stores/projectStore.ts:1152`
- **Origin:** paintStore ↔ projectStore markDirty wiring
- **Route to:** the same follow-up queue; out of scope for 261008-ful
