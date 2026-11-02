---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 08
subsystem: engine
tags: [watercolor, aquarelle, bake-host, flush-survives-navigation, webp-cache, tdd, cuisson]

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room (56-06)
    provides: AquarellePayloadEvent one-payload-union, Dry events, toStudioStroke, DIFFUSION_CAP, EngineAdapter.applyStroke/stepTick/captureFrame
  - phase: 55-efx-paint-host-engine-1-host-split (55-07)
    provides: createBakeHost consumer API, BakeTurnMode 'flush-survives-navigation', BAKE_TURN_CONCURRENCY, generation-stale commit guard
provides:
  - createAquarelleBake(adapter, options) — the createBakeHost consumer (mode 'flush-survives-navigation')
  - AquarelleBakeFrame / AquarelleBakeOptions / AquarelleBakeResult commit types
  - lean @efxlab/efx-watercolor ./bake sub-export
  - aquarelle consume branch in physicsPaintRotoPlayScriptController (engineId 'efx-watercolor')
  - dispose() flush-settles long aquarelle cuissons (never abort-on-dispose)
affects: [56-09, 56-10]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# commits: MEASURED via git rev-list --count plan_head_before..HEAD (#3968, includes this
# closing metadata commit; plan_head_after is the last content commit 6897cc30).
actuals:
  tokens: 14353
  tasks: 2
  commits: 4
plan_head_before: 67225ce2189930137872a025065b1f74db6fef2d
plan_head_after: 6897cc3031bca7fa9e4250edfc698772c3ed4319

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Aquarelle bake consumes createBakeHost (never re-ports the queue): one BakeHostTurn per stroke, mode 'flush-survives-navigation', publish IS the commit body (generation-stale guard = cancel guarantee)"
    - "Adapter mutations serialize on a promise chain (applyStroke/stepTick/captureFrame never interleave mid-capture); WebP encode overlaps inside the 2-slot pool"
    - "FIFO commit barrier released on turn settle (committed OR cancelled) — a later stroke never commits before an earlier one, and a cancelled head never wedges the tail"
    - "Overlapping flush() calls share one drain promise (AQUA-05 / 52.2-15); dispose() on an aquarelle bake calls flush() to settle, never abort"
    - "Lean ./bake sub-export keeps the fluid engine out of the UI chunk (56-05/56-07 sub-export law)"

key-files:
  created:
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
    - packages/efx-watercolor/src/bake/index.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - packages/efx-watercolor/src/index.ts
    - packages/efx-watercolor/package.json
    - packages/efx-watercolor/tsup.config.ts

key-decisions:
  - "One captured WebP frame per stroke turn (applyStroke -> stepTick over cuisson -> captureFrame -> bytes); a zero-diffusionFrames stroke bakes exactly one frame (AQUA-07 empty). The PlayScript cadence mapping onto progressive/static schedules is a later plan — this plan's turn shape is the plan's own arrow chain."
  - "diffusionFrames is clamped to DIFFUSION_CAP = 600 inside aquarelleBake before stepTick (defense in depth on top of toStudioStroke's clamp) — the bake window is per-stroke, never wall clock (D-19)."
  - "Dry events fire on the shared adapter chain BETWEEN stroke turns (reserved at walk time, not produce-start time) so recorded order is preserved even though the host defers produce behind the slot take (D-15)."
  - "Publish IS the commit body — a cancelled/interrupted turn never reaches it because the bake host's generation-stale guard skips commit (T-56-24). onCommit is the only publication sink."
  - "Controller dispose() calls aquarelleBake.flush() (settle in-flight turns, keep committed frames) and leaves abortController.abort() for the engine-1 renderer only — consume branch, not a rewrite (AQUA-07 / D-21)."
  - "Fail-closed when the bake's frame count does not match the requested Play Script span — never silently pad or truncate. Cadence mapping is named as the next surface, not faked."

patterns-established:
  - "createBakeHost consumer shape for engine bakes: schedule adapter work at walk time, submit turns with mode 'flush-survives-navigation', publish in commit, FIFO-commit via settle-released barrier"
  - "Long-cuisson dispose contract: dispose() -> flush() (settle), never abort; engine-1 abort-on-dispose stays on its own path"

requirements-completed: [AQUA-05, AQUA-07, AQUA-08]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "aquarelleBake submits one createBakeHost turn per stroke in mode 'flush-survives-navigation'; a long cuisson survives dispose() and still commits"
    requirement: AQUA-07
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#every turn survives dispose (mode flush-survives-navigation) and still commits"
        status: pass
    human_judgment: false
  - id: D2
    description: "A cancelled/interrupted bake turn never publishes its frames (generation-stale commit guard)"
    requirement: AQUA-07
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#a cancelled/interrupted turn never publishes its frames"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bake window is per-stroke diffusionFrames clamped to 600; zero-diffusionFrames bakes one frame; no forced Dry at frame boundaries"
    requirement: AQUA-05
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#diffusionFrames is clamped to DIFFUSION_CAP before stepTick (D-19)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Baked frames stay transparent (alpha 0) where unpainted; Dry events fire in recorded order between stroke turns"
    requirement: AQUA-08
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#baked frames have alpha 0 in unpainted regions (AQUA-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Controller routes engineId 'efx-watercolor' through createAquarelleBake; engine-1 path unchanged; dispose() on an in-flight aquarelle bake keeps committed frames and does not throw"
    requirement: AQUA-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-10-16
status: complete
---

# Phase 56 Plan 08: aquarelle WebP bake through createBakeHost Summary

**Aquarelle bake runs through createBakeHost in mode `flush-survives-navigation` — a long fluid cuisson survives leaving the frame, publishes only committed WebP frames, and keeps unpainted regions transparent.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-16T00:01:48Z
- **Completed:** 2026-10-16T00:08:40Z
- **Tasks:** 2 completed
- **Files modified:** 11

## Accomplishments

- `createAquarelleBake` consumes the already-ported `createBakeHost` (55 D-21) with one `BakeHostTurn` per stroke in mode `flush-survives-navigation` — never re-ports the finalizationQueue, never introduces a Web Worker.
- Bake window is per-stroke `diffusionFrames` clamped to `DIFFUSION_CAP = 600` before `stepTick` (D-19); Dry events fire in recorded order between stroke turns (D-15); unpainted pixels stay alpha 0 (AQUA-08).
- PlayScript controller consume branch routes `engineId: 'efx-watercolor'` through `createAquarelleBake`; `dispose()` settles in-flight cuissons via the bake host's `flush()` and never discards committed frames. The engine-1 path is byte-stable.

## Task Commits

Each task was committed atomically:

1. **Task 1: aquarelleBake through createBakeHost (flush-survives-navigation)** - `05701238` (test: RED) + `0d56e021` (feat: GREEN)
2. **Task 2: Wire aquarelle bake into the PlayScript controller** - `6897cc30` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

_Note: Task 1 is TDD (`tdd="true"`), so it carries a RED test commit then a GREEN implementation commit._

## Files Created/Modified

- `packages/efx-watercolor/src/bake/aquarelleBake.ts` - createBakeHost consumer: one turn per stroke, flush-survives-navigation, FIFO commits, shared flush, generation-stale publish guard
- `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` - 11 standing pins (dispose survival, cancel-no-publish, shared flush, alpha 0, Dry order, clamp, FIFO, idempotency)
- `packages/efx-watercolor/src/bake/index.ts` - lean ./bake sub-export
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` - aquarelle consume branch + dispose flush-settle
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` - routing / engine-1 isolation / dispose-survives-committed pins
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` - optional `engineId` on RotoPaintScript
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` - deepFreezeSnapshot preserves `engineId`
- `packages/efx-watercolor/src/index.ts`, `package.json`, `tsup.config.ts` - ./bake export surface

## Decisions Made

- **One WebP frame per stroke turn.** The plan's turn arrow chain is `applyStroke → stepTick over cuisson → captureFrame → WebP bytes` (singular capture), and the flagged empty case says a zero-diffusionFrames stroke bakes a single captured frame. The PlayScript-cadence mapping onto progressive/static schedules is explicitly left as the next surface (fail-closed count check, no silent pad).
- **Adapter work reserved at walk time.** Dry events and stroke produces are enqueued on one adapter chain in script order, not at produce-start order — the host defers produce behind the slot take, so walk-order reservation is what keeps Dry between strokes (D-15).
- **FIFO commit via settle-released barrier.** Each stroke reserves a commit slot; the slot opens when that turn settles (committed OR cancelled). A later encode can finish first without committing first, and a cancelled head never blocks the tail.
- **Publish = commit body.** The only publication path is `commit` → `onCommit` / frames[]. The bake host's generation-stale guard is what makes "cancelled turn never publishes" structural (T-56-24), not a flag.
- **dispose() flushes, engine-1 aborts.** Aquarelle long cuissons settle through `bake.flush()`; the existing `abortController.abort()` stays for the PlayScript renderer's own dispose semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] RotoPaintScript needed an engine discriminator**
- **Found during:** Task 2 (Wire aquarelle bake into the PlayScript controller)
- **Issue:** The consume branch must route on `engineId === 'efx-watercolor'`, but `RotoPaintScript` carried no engine field and `deepFreezeSnapshot` would have dropped one.
- **Fix:** Added optional `engineId?: string` (absent = engine-1 byte-stable default) to `RotoPaintScript` and preserved it in `deepFreezeSnapshot`.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts`
- **Verification:** existing controller tests (149) still pass; bake pins cover both branches
- **Committed in:** `6897cc30` (part of Task 2 commit)

**2. [Rule 2 - Missing critical functionality] Adapter factory needed a DI seam to keep the fluid engine out of the UI chunk**
- **Found during:** Task 2
- **Issue:** `createAquarelleEngineAdapter` pulls the fluid engine; a static import would pressure the 2000 kB vite ceiling (memory law). Tests also need to inject a fake adapter.
- **Fix:** Optional `createAquarelleBake` / `createAquarelleAdapter` ports with a lazy `import('@efxlab/efx-watercolor')` default adapter factory; `createAquarelleBake` itself comes from the lean `./bake` sub-export.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- **Verification:** bake pins inject fakes; typecheck clean; chunk path stays lean
- **Committed in:** `6897cc30` (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 2)
**Impact on plan:** Both were the minimum wiring the consume branch needs. No scope creep — no new subsystem, no second bake queue.

## Issues Encountered

- **TDD RED at suite-load first.** The initial test run failed on `Failed to load url ./aquarelleBake` (module missing). Resolved by scaffolding an intentionally unimplemented `aquarelleBake.ts` stub so the pins fail on assertions (per the 56-06 RED pattern), then re-capturing TAP evidence. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- **Vitest resolve of `@efxlab/efx-watercolor/bake`.** The new sub-export points at `dist/`; tests failed to resolve until `pnpm --filter @efxlab/efx-watercolor build` produced `dist/bake.mjs`. Build is a normal workspace step (56-07 did the same for `./brushes` / `./payload`).
- **Test deadlock on a held bake gate.** The first bake-pin draft awaited `confirm()` before releasing the fake bake's gate (confirm awaits bake). Fixed by resolving the gate from the test side and by making the fake's `flush()` settle the gate (which is also the D-21 semantic being pinned).

## Known Stubs

None. No placeholder values, no TODO/FIXME, no unwired data source in the production path. The fail-closed `frames.length !== count` throw is a named limitation (see Deferred), not a stub.

## Deferred Issues

- **PlayScript cadence mapping.** `bakeAquarelleScript` publishes one baked frame per stroke onto consecutive timeline frames and refuses when the count does not match the requested span. Mapping stroke-keyed bake output onto the progressive/static PlayScript cadence (repeat/hold schedules, motion wiggle) is the natural next surface — this plan's contract is the bake host consume + dispose law, and faking the cadence would have been a stub.
- **Wall-clock / multi-frame cuisson capture.** One capture per stroke turn (end of cuisson). Capturing intermediate ticks as separate timeline frames is a later refinement if A3's "bloom visible in baked frames" needs per-tick sampling.

## User Setup Required

None.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Task 1 unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/bake/aquarelleBake.test.ts src/adapter/engineAdapter.test.ts` | 17 passed |
| Task 1 package suite | `pnpm --filter @efxlab/efx-watercolor exec vitest run` | 100 passed |
| Task 2 pins | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` | 3 passed |
| Task 2 engine-1 regression | `...physicsPaintRotoPlayScriptController.test.ts` | 149 passed |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | clean |
| Overall plan verification | see `<verification>` in 56-08-PLAN.md | pass |

## Self-Check: PASSED

- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — FOUND
- `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` — FOUND
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` — FOUND
- Commit `05701238` (test RED) — FOUND in history
- Commit `0d56e021` (feat GREEN) — FOUND in history
- Commit `6897cc30` (feat Task 2) — FOUND in history
