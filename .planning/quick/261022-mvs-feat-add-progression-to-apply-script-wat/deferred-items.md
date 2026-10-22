# Deferred items — quick-261022-mvs

Out-of-scope, pre-existing failures observed in the full app suite (2026-10-22).
None import the modules touched by this quick; they are recorded, not fixed.

| Test file | Failing test | Area |
|---|---|---|
| `app/src/lib/exportEngine.test.ts` | `solo narrows the scan to the soloed visible track (a visible-not-soloed track cannot block)` | export preflight solo semantics |
| `app/src/lib/paperPass.frameGuard.test.ts` | `P4(f) both flattened getters delegate to the ONE _resolveFlattenedFrame seam` (`getFlattenedFrameExcluding(` missing from the store source) | stale source-scan guard |
| `app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts` | matrix row 8 (one soloed track) and row 9 (multiple soloed tracks) | compositor solo matrix |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` | `renders a pinned header column with a label cell for every row including the active lane` | workflow strip header |

Full-suite result at execution time: 5 failed | 5376 passed | 1 skipped | 96 todo.
