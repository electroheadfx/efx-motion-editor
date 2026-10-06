# Deferred items — quick 261006-bdk

## Pre-existing (out of scope, not caused by this quick)

1. **`app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — suite fails at module load**
   - Failure: `TypeError: _setPaintMarkDirtyCallback is not a function` thrown from `app/src/stores/projectStore.ts:1125` (the `_setPaintMarkDirtyCallback(() => projectStore.markDirty())` wiring line), surfaced through `app/src/stores/paintStore.ts` — a circular-import initialization order issue between `paintStore` and `projectStore`.
   - Attribution: reproduced at base `06db7a46` with the base versions of both files this quick touches (`sequenceStore.ts`, `sequenceStore.test.ts`) restored — the failure is identical. This quick changed no imports and no store wiring; it only inverted a placement ternary in `sequenceStore.createFxSequence` and added one test case.
   - Impact: full app suite is 235/238 files green, 4430 tests passed; every suite this quick touches (`sequenceStore.test.ts`, `projectStore.efxPaintCutover.test.ts`) is green and typecheck is clean.
   - Action: none — logged per executor scope-boundary rule; needs its own targeted quick/debug (likely an import-order or `vi.mock` harness issue) if the behavior is treated as a regression.
