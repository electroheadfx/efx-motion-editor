# Deferred items — quick 261022-mne

## Pre-existing failures (verified against HEAD, out of scope)

The full Vitest suite has 5 failures in 4 files. They were reproduced against the
unmodified HEAD sources (production files temporarily restored from `git show
HEAD:<path>`), so they are not caused by this quick:

| Suite | Failing test | Pre-existing cause (suspected) |
|-------|--------------|-------------------------------|
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` | renders a pinned header column... (line 834) | Still expects the per-track solo chip removed by 261022-iff |
| `app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts` | matrix row 8 (line 520) | Still arms solo through the now-inert document `solo` flag |
| `app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts` | matrix row 9 (line 541) | Same |
| `app/src/lib/exportEngine.test.ts` | solo narrows the scan... (line 405) | Still arms solo through the document `solo` flag |
| `app/src/lib/paperPass.frameGuard.test.ts` | P4(f) both flattened getters... (line 104) | Store no longer has two `return _resolveFlattenedFrame(` occurrences |

All targeted suites for this quick (PhysicsPaintStudio, keyboard, solo arm,
program monitor) are green: 4 files / 329 tests.
