# Deferred items — quick 260924-koa

## Pre-existing (out of scope, not caused by this quick)

1. **`packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts` — 1 failing test**
   - Test: `EfxPaintEngine live alpha cache boundary > preserves displayed wet alpha when local pre-stroke preparation bakes a distant stroke`
   - Failure: `expect(Array.from(dryData)).toEqual(Array.from(displayed))` (line 152) — dryData all zeros vs displayed with baked values.
   - Attribution: reproduced at base `f92254f7` both with HEAD files and with the base versions of `canvas.ts`/`EfxPaintEngine.ts` restored — fails in isolation with zero code from this quick involved.
   - Impact: package suite is 13/14 files, 138/139 tests green; all suites this quick touches are green.
   - Action: none — logged per executor scope-boundary rule; needs its own targeted quick/debug if the behavior is actually a regression.
