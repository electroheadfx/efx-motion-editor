---
phase: 261101-f5v-raster-for-rail-add-a-raster-rail-mode-t
plan: 01
subsystem: ui
tags: [preact, signals, physic-paint, aquarelle, raster, key-rail, snapshot]

# Dependency graph
requires:
  - phase: quick-261025-awl
    provides: the per-key Raster action, its enablement matrix and the strip leaf/dialog
  - phase: quick-261023-ors
    provides: the Memory-tab per-key + rail script purge and its one-persist snapshot contract
  - phase: 56
    provides: the aquarelle script stores (hasAquarelleScriptForFrame, purgeAquarelleFrameScript)
provides:
  - rail-scoped Raster mode behind a selected key rail (RasterRailTarget + resolveRasterRailPresentation)
  - one shared per-key capture/verify/purge core reused by the frame and rail scopes
  - one-snapshot-write rail run with skip accounting and a single summary message
affects: [physic-paint studio, workflow strip, future rail-scoped actions]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 13348
  tasks: 2
  commits: 2
  plan_head_before: 41563b3a4dbcb20dd6571a08519fefdd816875d6
  plan_head_after: a5ca470cb40ff30aa9e73d972e1319ac4df7a1ab

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated Raster scope: one nullable rail target signal reference read only by the leaf"
    - "One per-key raster core shared by the single-key and rail handlers (D-05 ordering authority)"
    - "Bounded sequential rail run: one snapshot of scripted keys, per-iteration guard re-check, one persist"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/rasterKeyPresentation.ts
    - app/src/components/physic-paint/view/rasterKeyPresentation.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Rail mode triggers on a selected key rail only; Loop Clip rails and rail sets never do (D-01/D-04)"
  - "Rail frames resolve through getRotoPhysicalProjection().framesByKeyId, deduped and ascending (D-02)"
  - "Rail enablement order: ready -> cached playback -> mutation lock -> empty rail -> no rail script (D-03)"
  - "Shared rasterOneKeyCore owns ownership -> flush -> identity re-check -> raster verify -> live-frame reload -> purge -> durable-base drop (D-05)"
  - "Degraded keys are skipped and counted; the run stops only on a session guard break, with no retry (D-06)"
  - "One finishRasterPurge per run: a single applyFrameModuleState (live frame only) and a single persistAfterPurge (D-07)"
  - "One-key rails reuse the key copy with the rail's own frame; multi-key rails name the range and the skip rule (D-08)"
  - "One rasterInFlightRef guards both scopes; the rail re-resolves the clicked firstKeyId at call time (D-09)"

patterns-established:
  - "Scope-discriminated action: a nullable target signal reference replaces a second header control"
  - "Run summary as pure copy (formatRasterRailRunCopy) so the handler only publishes one outcome"

requirements-completed: [QUICK-261101-F5V]

coverage:
  - id: D1
    description: "Rail presentation and run-summary contract: the D-03 enablement order, the range idiom and every outcome sentence"
    requirement: "QUICK-261101-F5V"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/rasterKeyPresentation.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "With a key rail selected, Raster converts every scripted key of that rail to raster-only (pixels kept, script lost), skips keys without a retained raster, stops on a session guard break and writes the snapshot once"
    requirement: "QUICK-261101-F5V"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#quick-261025-awl Raster handler (D-04)"
        status: pass
    human_judgment: true
    rationale: "The destructive purge and the retained-pixel verification only materialize in the live Tauri Studio; source pins prove the ordering but not the on-screen result."
  - id: D3
    description: "Rail-aware Raster surface: rail copy in the confirm dialog (key copy for a one-key rail), 'Raster the rail' accessible name and tooltip, empty rail disabled with its own reason, visible label unchanged"
    requirement: "QUICK-261101-F5V"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts"
        status: pass
    human_judgment: true
    rationale: "Copy, tooltip and dialog visuals are user-facing judgment calls; the structural pins prove wiring, not the rendered surface."
  - id: D4
    description: "Frame-mode Raster behavior preserved byte-for-byte when no rail is selected"
    requirement: "QUICK-261101-F5V"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#refuses in the documented guard order"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts#carries the exact dialog copy for the current key"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-01
status: complete
---

# Quick 261101-f5v: Rail-scoped Raster Summary

**A selected key rail now turns the header Raster action into a rail-wide conversion: every scripted key keeps its painted pixels and loses its Brush/Water script, with pixels verified before any purge, skips counted, one snapshot write and one summary message.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-01T10:04:00Z (approximate — not captured at spawn)
- **Completed:** 2026-11-01T10:09:54Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- `rasterKeyPresentation.ts` gained the rail contract: `RasterRailTarget`, the D-03 enablement matrix (`ready -> cached playback -> mutation -> empty rail -> no rail script`), the `first-last` range idiom and the pure run-summary copy (all / ratio / skipped / stopped / nothing).
- `PhysicsPaintStudio.tsx` gained `rasterRailTarget` (a computed over `getRotoPhysicalProjection().framesByKeyId`, selection read first so the no-rail case subscribes only to the rail selection), one shared `rasterOneKeyCore` ordering authority, `finishRasterPurge` (one module refresh for the live frame + one `persistAfterPurge`), a one-pass rail run with per-iteration guard re-checks and skip accounting, and a single `rasterInFlightRef` shared by both scopes.
- `PhysicsPaintWorkflowStrip.tsx` threads `onRasterRail` / `rasterRailTarget` through the strip and the memoized static chrome into the Raster leaf, which alone reads the target, switches to the rail enablement matrix, dispatches the clicked `firstKeyId`, names the scope in the dialog, aria-label and tooltip, and keeps the visible label `Raster`.
- The frame-only Raster path is byte-for-byte unchanged in observable behavior (same five guards, same three "nothing changed" strings, same live-frame semantics), now expressed through the shared core.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end rail raster** - `648c2a31c` (feat)
2. **Task 2: Rail surface completion (copy + pins)** - `a5ca470cb` (feat)

**Plan metadata:** handled by the orchestrator's docs commit (this SUMMARY is intentionally uncommitted).

## Files Created/Modified

- `app/src/components/physic-paint/view/rasterKeyPresentation.ts` - rail target type, rail enablement matrix, range formatting, run-summary copy
- `app/src/components/physic-paint/view/rasterKeyPresentation.test.ts` - rail matrix order, range and every run-summary sentence
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - rail props threading, rail mode in the leaf, scope-aware dialog/aria/tooltip copy
- `app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts` - structural pins for the rail plumbing, copy and dispatch
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - rail target computed, shared per-key core, rail run, in-flight guard, one persist
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - core ordering pins, rail loop bounds, frame-path preservation

## Decisions Made

Followed the plan's locked D-01..D-09 decisions without revisiting them. Two implementation details worth recording:

- The rail run counts `skipped` as `entries.length - rastered`, so an early stop also reports the un-attempted keys as skipped while the sentence appends `; the run stopped early` (the plan's literal contract).
- A one-key rail shares the key copy template with the key scope through a single `scopeFrame` value (the rail's own frame in rail mode, the current frame otherwise), so the copy is written once and cannot drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a live-graph read-count pin after adding the rail computed**
- **Found during:** Task 1 verification
- **Issue:** `PhysicsPaintStudio.test.ts` pins the number of `void rotoModelGeneration.value;` reads (the live-graph rebind law, previously 3). The new `rasterRailTarget` computed is a fourth legitimate read, so the pin failed with `expected 4 to be 3`.
- **Fix:** Raised the expected count to 4 and extended the comment to name the rail target as the fourth site.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Focused suites green; full app suite green.
- **Committed in:** `648c2a31c` (Task 1 commit)

**2. [Rule 1 - Bug] Corrected a rail-copy assertion typo while writing the new pins**
- **Found during:** Task 1 verification
- **Issue:** The new strip pin asserted `keeps the painted pixels` while D-08 and the implementation say `keeps its painted pixels`; the assertion, not the code, was wrong.
- **Fix:** Aligned the test string with D-08.
- **Files modified:** `app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts`
- **Verification:** Strip suite green.
- **Committed in:** `648c2a31c` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both were test-side corrections forced by the planned change; no production behavior or scope changed.

## Issues Encountered

None. The tracer feedback gate re-ran Task 1's `<verify>` end-to-end (both commands automated) and passed before Task 2 expanded.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None - no new network, auth, file-access or schema surface. The rail run reuses the existing store purges and the existing snapshot controller.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/rasterKeyPresentation.test.ts src/components/physic-paint/view/rasterKeyStripWiring.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` - 3 files / 350 tests passed.
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint` - 200 files / 4,586 tests passed.
- `pnpm --filter efx-motion-editor exec vitest run` - 361 passed / 2 skipped (363 files), 6,879 passed / 1 skipped / 96 todo; main chunk 1,583.14 kB (under the 2,000 kB ceiling).
- `pnpm --filter efx-motion-editor run typecheck` - clean (after each task).
- Static diff checks: only the six declared files changed; no `useState`; the rail target is read only in the leaf; `purgeMemoryScriptFrame` / `purgeMemoryRailScripts` / `clearMemoryRailScripts` bodies untouched; no `activeModule` write; no retry/timer/queue; no `persistAfterPurge` inside the per-key core; no CSS change.

## Next Phase Readiness

Automated-ready. Live UAT remains the user's step — the rows to exercise: (1) select a multi-key rail, confirm the range dialog, and verify every scripted key keeps its pixels while losing Move/Select/replay; (2) a rail with a key whose retained raster is missing reports the skip; (3) a one-key rail shows the key copy with that frame; (4) an empty rail is disabled with `This rail has no keys to raster.`; (5) with no rail selected the single-key Raster is unchanged.

---
*Quick task: 261101-f5v*
*Completed: 2026-11-01*

## Self-Check: PASSED

- FOUND: `.planning/quick/261101-f5v-raster-for-rail-add-a-raster-rail-mode-t/261101-f5v-SUMMARY.md`
- FOUND: `648c2a31c` (Task 1, ancestor of HEAD)
- FOUND: `a5ca470cb` (Task 2, ancestor of HEAD)
