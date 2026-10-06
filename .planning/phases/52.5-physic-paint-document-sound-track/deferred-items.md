# Phase 52.5 — Deferred / out-of-scope discoveries

Items found during execution that are NOT caused by the active plan's changes
(scope boundary rule). Logged, not fixed.

## 1. Pre-existing typecheck errors — `ToolType '"move"'` (3 errors)

- **Found during:** 52.5-01a Task 1 GREEN (full `pnpm --filter efx-motion-editor run typecheck`)
- **Files:**
  - `app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts:95` — `Type '"move"' is not assignable to type 'ToolType'`
  - `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:63` — comparison of `ToolType` with `'"move"'` has no overlap
  - `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:124` — `'"move"'` not assignable to `ToolType`
- **Why out of scope:** unrelated to the document `sound` member; the files are not in this plan's file list; caused by an earlier tool-rail/move-tool change that left `'move'` outside the `ToolType` union.
- **Action needed:** add `'move'` to the `ToolType` union (or remove the dead usages) in a dedicated fix.

## 2. Pre-existing test suite failure — `PhysicsPaintStudioView.test.ts` (collection error)

- **Found during:** 52.5-01a Task 1 GREEN (full `vitest run`: 4443 passed, 1 failed suite)
- **Failure:** `TypeError: _setPaintMarkDirtyCallback is not a function` at `app/src/stores/projectStore.ts:1125` during module init — a `paintStore` ↔ `projectStore` circular-import init-order issue (`paintStore.ts:7` imports `projectStore`, whose body calls the `paintStore` export before it is established). Fails in isolation ("no tests", collect phase).
- **Why out of scope:** none of the 52.5-01a files participate in this cycle; the last commits touching the chain are `quick-261004-hwa` (paintStore fg/bg swatch state) — before this phase. The 52.5 changes are additive-only to the document model and do not alter module import order.
- **Action needed:** break the `paintStore` ↔ `projectStore` cycle (lazy import or move the wiring call) or adjust the test's mock hoisting.
