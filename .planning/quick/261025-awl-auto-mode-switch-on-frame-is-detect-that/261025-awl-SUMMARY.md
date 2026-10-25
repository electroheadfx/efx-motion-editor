---
phase: quick-261025-awl
plan: 261025-awl
subsystem: ui
tags: [preact, signals, physic-paint, module-switcher, script-stores, raster, engine-ledger]

# Dependency graph
requires:
  - quick: quick-261023-ors
    provides: per-key Memory-tab purge semantics (both stores + snapshot cleanup)
  - quick: quick-261023-g4p
    provides: shared script-edition port seam and brush delete path
  - quick: quick-261024-vga
    provides: placeholder vga (exact stack placement) — same header icon-action pattern
provides:
  - Frame script ownership resolver over both stores plus an optional live brush ledger
  - Studio-scoped module lock signal, mapping and tooltip copy
  - Auto-switch funnel on explicit frame selection (click/step/scrub release/launch/track switch)
  - Ownership refresh seams on every edit/purge surface that can change ownership
  - Raster header action with a Cancel-first confirmation and a fail-closed conversion handler
  - Engine-ledger clear proof (clear() empties getStrokes/getStrokeCount)
affects: [physic-paint-studio, module-switcher, frame-script-stores, raster-conversion]

actuals:
  tokens: 21963
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure ownership resolver (stores + optional live sample) shared by the lock and the handler"
    - "Ref-held signal for transient dialog state (never useState)"
    - "Stable callback + impl-ref reassigned every render for the strip handler"
    - "Fail-closed ordered conversion: capture -> verify -> clear+reload -> purge"

key-files:
  created:
    - app/src/components/physic-paint/view/frameScriptOwnership.ts
    - app/src/components/physic-paint/view/rasterKeyPresentation.ts
    - app/src/components/shared/frameModuleLock.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/brushScriptEditionPort.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/shared/ModuleSwitcher.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "One module per frame: a single owner auto-switches; both/none leave activeModule unchanged (D-01/D-02)"
  - "Auto-switch only on explicit selection — cached playback and mid-drag scrubs never write activeModule (D-02)"
  - "The lock is Studio-scoped: only the TopBar mount receives lockedModule; the Toolbar mount stays fully enabled (D-03)"
  - "Raster purges both stores with Memory-tab per-key semantics, keeps pixels, never changes activeModule (D-04)"
  - "Raster clears the engine ledger and reloads the retained raster BEFORE any purge; every pre-purge failure changes nothing (D-04)"
  - "Post-Raster brush paint captures a partial arrival-base ledger — live in the visit, view-only after leaving (D-05, existing partial-attach law)"

patterns-established:
  - "Ownership publish: resolve(store + live sample) -> compare-then-write activeModule -> set frameScriptOwner"
  - "Raster safety order: flush -> snapshot -> await flush -> verify cache -> clear base/reset/engine.clear/load -> purge -> refresh"
  - "Strip leaf subscriptions: signal reference in props, .value read only inside the leaf"

requirements-completed: []

coverage:
  - id: D1
    description: "Pure frame script ownership resolver (brush/watercolor/both/null) including Dry, tombstone, other-frame and purged cases"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/frameScriptOwnership.test.ts (11 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shared ownership signal, idempotent writer, locked-module mapping and tooltip copy"
    verification:
      - kind: unit
        ref: "app/src/components/shared/frameModuleLock.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Studio ModuleSwitcher locks the non-owning slot; the Toolbar mount stays fully enabled"
    verification:
      - kind: unit
        ref: "app/src/components/shared/ModuleSwitcher.test.tsx.test.ts (15 tests)"
        status: pass
    human_judgment: true
    rationale: "The live Studio lock styling and the main-window Toolbar coexistence are visual UAT rows 1-7."
  - id: D4
    description: "Auto-switch on explicit frame selection only; playback and mid-drag scrub never switch"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#explicit-selection module ownership (source pins)"
        status: pass
    human_judgment: true
    rationale: "Source pins prove the wiring; real navigation/playback behavior is UAT rows 4-6."
  - id: D5
    description: "Raster control placement, Stamp icon, label, exact copy and availability reasons"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/rasterKeyPresentation.test.ts (8 tests) + rasterKeyStripWiring.test.ts (10 tests)"
        status: pass
    human_judgment: true
    rationale: "Placement immediately before Tools and the disabled reason are visual UAT rows 8 and 14."
  - id: D6
    description: "Confirmed Raster captures pixels, verifies the retained raster, clears the ledger, reloads the raster and purges both stores; failures purge nothing"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#Raster handler (source pins)"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.attachBaseline.test.ts#clear() empties the stroke ledger"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.purge.test.ts#records only the new strokes after a Raster conversion"
        status: pass
    human_judgment: true
    rationale: "Pixel preservation, outline removal and single-render return are UAT rows 10-13."
  - id: D7
    description: "Post-Raster painting records only new strokes with no stale recapture and no doubled pixels"
    verification: []
    human_judgment: true
    rationale: "The partial-ledger behavior is only observable live (UAT row 12); no automated harness exists for pixel doubling."

# Metrics
duration: 16min
completed: 2026-10-25
status: complete
commits: 3
plan_head_before: 693e4952584991020b29ae9e1de35181f525f110
plan_head_after: 8037302b2448be22fda0a683f5cda148925dbcb9
---

# Quick Task 261025-awl: Frame Ownership, Module Auto-Switch, and Raster Conversion Summary

**The Studio now follows the selected key's script module (with a Studio-scoped lock on the other slot) and can convert a scripted key back to a raster key in one confirmed action that keeps the painted pixels.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-10-25T07:23:50Z
- **Completed:** 2026-10-25T07:40:00Z
- **Tasks:** 3
- **Files modified:** 19 unique (created 6, modified 13)
- **Commits:** 3 measured (`git rev-list --count 693e4952..HEAD`)

## Accomplishments

- **Ownership resolver** — `resolveFrameScriptOwner` reads the brush store, the aquarelle timeline (ignoring Dry events, other frames and deleted tombstones) and an optional live brush sample; `both`/`null` leave the active module untouched.
- **Studio-scoped module lock** — `frameScriptOwner` feeds `ModuleSwitcher lockedModule` only from the Studio TopBar; the locked slot is a NATIVE disabled HTML button (same semantics as Krita) with muted styling and a tooltip naming the owner and the Raster remedy, while the main Toolbar mount stays fully enabled.
- **Auto-switch on explicit selection** — the navigation funnel (`!wasPlaying && !rotoCachedPlayback.isActive`), launch restore (both exits), track switch, brush completion (paints/erases/undo/redo, excluding `clear`), aquarelle stroke-end/delete/history, clear source/canvas, brush Move/Select deletes and every Memory purge seam republish ownership.
- **Raster action** — a Stamp-icon control immediately before Tools, disabled with a specific reason (engine, playback, mutation lock, no script), with a Cancel-first confirmation dialog portaled above the strip.
- **Fail-closed conversion** — flushes pending finalizations, snapshots/awaits pixels, verifies the retained raster, clears the preview base/background/engine ledger, reloads the retained raster, and only then purges both stores with Memory-tab semantics plus snapshot cleanup. Failures before the purge change nothing; `activeModule` is never written.
- **Engine ledger proof** — `EfxPaintEngine.clear()` is pinned to leave `getStrokes()` and `getStrokeCount()` empty, so a post-Raster paint cannot recapture pre-Raster strokes.

## Task Commits

Each task was committed atomically (code only; docs handled by the orchestrator):

1. **Task 1: Frame script ownership resolver + Studio module lock** — `269ba43f` (feat)
2. **Task 2: Auto-switch on explicit selection + ownership refresh seams** — `63dc8a78` (feat)
3. **Task 3: Raster button + confirmed purge and ledger clear** — `8037302b` (feat)

_Note: docs artifacts (SUMMARY/STATE/PLAN) were intentionally not committed per the execution constraints._

## Files Created/Modified

- `app/src/components/physic-paint/view/frameScriptOwnership.ts` (created) — pure ownership resolver + `LiveBrushScriptSample`
- `app/src/components/physic-paint/view/frameScriptOwnership.test.ts` (created) — real-store matrix (11 tests)
- `app/src/components/shared/frameModuleLock.ts` (created) — signal, idempotent setters, mapping + tooltip copy
- `app/src/components/shared/frameModuleLock.test.ts` (created) — mapping/writer/tooltips (8 tests)
- `app/src/components/physic-paint/view/rasterKeyPresentation.ts` (created) — pure availability matrix
- `app/src/components/physic-paint/view/rasterKeyPresentation.test.ts` (created) — every branch + priority (8 tests)
- `app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts` (created) — strip layout/copy/CSS pins (10 tests)
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` (modified) — read-only `hasAquarelleScriptForFrame`
- `app/src/components/physic-paint/view/aquarelleRecordState.purge.test.ts` (modified) — ownership matrix + Raster conversion cell
- `app/src/components/shared/ModuleSwitcher.tsx` (modified) — optional `lockedModule` lock contract
- `app/src/components/shared/ModuleSwitcher.test.tsx` (modified) — lock tests + TopBar source pin
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` (modified) — passes the lock from the ownership signal
- `app/src/components/physic-paint/physicsPaintStudio.css` (modified) — locked-slot rule + fixed Raster confirmation
- `app/src/components/physic-paint/view/brushScriptEditionPort.ts` (modified) — `onScriptChanged` on accepted delete only
- `app/src/components/physic-paint/view/brushScriptEditionPort.test.ts` (modified) — notify-on-accepted-delete pins
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (modified) — auto-switch funnel, refresh seams, Raster handler
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` (modified) — ownership + Raster handler source pins
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (modified) — Raster leaf, portaled dialog, props threading
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.attachBaseline.test.ts` (modified) — `clear()` empties the ledger

## Decisions Made

- Auto-switch fires only for a single owner; `both`/`null` deliberately leave the module unchanged (D-01/D-02).
- The `brush completion` refresh excludes `kind === 'clear'` because `engine.clear()` fires on every navigation and would overwrite the destination owner with the outgoing frame's owner.
- Only the delete edit path notifies ownership changes; move/transform/appearance/step/place cannot remove the last stroke.
- The Raster dialog reuses the Memory-tab confirmation classes and focus contract, portaled to `document.body` because the strip clips overflow.
- The Raster handler uses a stable callback plus an impl-ref reassigned every render, keeping the memoized static chrome intact.
- The handler deliberately does not gate the purge on `purgeMemoryScriptFrame`'s boolean: even a false return marks the brush frame purged (stopping a stale flush from recapturing the old ledger).

## TDD Gate Compliance

Plan frontmatter is `type: execute`, so the plan-level TDD gate does not apply. Task-level TDD was applied behaviorally:

- Task 1: tests + stubs first (18 target assertion failures observed), then implementation to green.
- Task 2: source pins authored against the planned seams, then wiring implemented.
- Task 3: behavior tests and source pins authored with the implementation; the first run surfaced one genuine pin mismatch (the leaf's inline props make the `onRasterKey` declaration occur three times, not two) which was corrected — no product behavior changed.

Repo convention for quick tasks is one `feat(<quick-id>)` commit per task; the user's instruction to commit each task atomically was followed instead of separate RED `test()` commits.

## Deviations from Plan

None — all three tasks were implemented as specified. Test-pin corrections made while bringing the new tests to green are listed under Issues Encountered (they did not change product behavior).

## Issues Encountered

- TopBar pin: the first implementation hoisted `lockedModuleForOwner(frameScriptOwner.value)` into a variable, which broke the plan's exact source pin; inlined the expression at the mount (Task 1).
- ModuleSwitcher test: the vnode materialization keeps `disabled={false}` for non-Krita slots; the assertion was corrected to `toBe(false)` (native `disabled` remains reserved for Krita) (Task 1).
- Studio pin formatting: the callback terminator is formatted as `},\n    [],\n  );`; the pin was adjusted to match (Task 2).
- Delete-handler pin ordering: the first `return;` in the sliced handler was an unrelated guard; the pin now compares against the return after the refresh (Task 2).
- Strip wiring pin: `onRasterKey?: (frame: number) => void;` appears three times (strip props, static-chrome props, leaf props); the pin was corrected to 3 (Task 3).

## UAT Revisions

- **UAT revision 1 (2026-10-25):** the locked module slot must be a truly inactive HTML button, not a styled-but-enabled button with `aria-disabled`. `ModuleSwitcher` now sets `disabled={isInert || isLocked}`, the custom Enter/Space guard was removed (native disabled handles it), and the tests assert the native attribute instead of `aria-disabled`. Same look and tooltip as before, now with real disabled semantics and no tab stop.

## Known Stubs

None — no hardcoded empty values, placeholder copy, or unwired data sources were introduced.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, schema changes, or dependencies. The Raster action is a local, confirmation-gated store mutation (threat register T-...-01 mitigated by the cancel-first dialog and the pre-purge verification; T-...-02 by compare-then-write publishes on explicit seams only; T-...-SC by adding no package).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All automated verification is green: 376 tests across the 8 plan-listed suites, 11 engine tests, and a clean app typecheck.
- 15 native UAT rows from `261025-awl-PLAN.md` are **pending a live Studio run** (auto-switch rows 1-7, Raster rows 8-15). Per project policy this quick is automation-ready, not UAT-approved, until those rows pass.
- Known boundary (unchanged, by design): after leaving and returning, a post-Raster brush ledger is partial and stays view-only under the existing partial-attach refusal; making it attachable again requires a persistent raster-base model and is out of this quick's scope.

---

*Quick: 261025-awl*
*Completed: 2026-10-25*

## Self-Check: PASSED

- FOUND: `app/src/components/physic-paint/view/frameScriptOwnership.ts`
- FOUND: `app/src/components/shared/frameModuleLock.ts`
- FOUND: `app/src/components/physic-paint/view/rasterKeyPresentation.ts`
- FOUND: `app/src/components/physic-paint/view/rasterKeyPresentation.test.ts`
- FOUND: `app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts`
- FOUND: `269ba43f` (Task 1)
- FOUND: `63dc8a78` (Task 2)
- FOUND: `8037302b` (Task 3)
