---
phase: quick-261003-vos
plan: 261003-vos
subsystem: physic-paint-studio-keyboard
tags: [physic-paint, studio, keyboard, alt-modifier, temporary-erase, preact-signals, tdd]

# Dependency graph
requires:
  - phase: quick-261003-hpi
    provides: "the engine erase contract (fresh = whole-stroke, baked = pixel erase with the force law) this quick rides"
  - phase: quick-261003-ud9
    provides: "pointer-delete on fresh strokes + erase hover preview/pointer glyph — the armed gesture's visible behavior"
provides:
  - "Alt held = temporary erase in the Physics Paint Studio window (both Normal and Physics paint modes), release restores paint — selected tool never changes, nothing persisted"
  - "physicsPaintTemporaryErase.ts: module temporaryErase signal, resolveEffectiveTool, gated handlers, gesture-boundary deferral, window-capture force-sync, mount/teardown"
  - "PhysicsPaintStudio.tsx listener lifecycle (latest-deps ref) + armed-guarded sync effect on [engine, settings.tool]"
affects: [physic-paint-studio, studio-keyboard, erase-contract]

# Actuals (#2632) — pairs with the plan's estimate (tokens 33000)
actuals:
  tokens: 9650    # chars/4 over the realized diff (38594 diff chars)
  tasks: 3
  commits: 2      # measured: git rev-list --count 7710b277..HEAD

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "modifier-held ephemeral tool mode: one module @preact/signals signal + pure handlers with injected deps; arm/disarm deferred to pointer boundaries; window pointerdown (capture) force-sync as the self-healing gesture-start invariant"
    - "deps-behind-render-body-ref for once-mounted window listeners (canvasEngineReadyImplRef precedent)"

key-files:
  created:
    - app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
    - app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "Mount takes a deps GETTER (ref-read at event time) instead of a plain deps object — the once-installed listeners must read the latest settings.tool/engineRef/lock, never the first render's closures (plan's 'latest-deps ref idiom' made literal)"
  - "sync 'force' bypasses BOTH gates (inFlight deferral AND the last-applied dedupe) — required by the plan's own self-healing claim (recovery from external setTool at every gesture start) and by the armed [engine, settings.tool] re-apply after a rail tool switch"
  - "keyup gates only on event.key === 'Alt' (disarm is unconditional wrt arm gates; releasing a non-Alt key while Alt stays held must NOT disarm); release boundaries stay bubble-phase so the engine finalizes the in-flight gesture with the tool it started with, pointerdown is capture-phase so the effective tool lands first"
  - "Signal read in the Studio sync effect via .peek() — no component subscribes, zero render-path change; disarmed effect is a byte-identical no-op for every existing flow"

patterns-established:
  - "ephemeral-modifier tool flip without touching selection state (signal + resolver + boundary-deferred setTool)"

requirements-completed: [QUICK-261003-VOS]

coverage:
  - id: D1
    description: "Alt arms/disarms temporary erase in the Studio through gated window listeners with boundary-deferred engine.setTool; dispatcher Alt exclusions, selected tool and erase contract untouched"
    requirement: QUICK-261003-VOS
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts (29 cells) + physicsPaintStudioKeyboard.test.ts (113 tests) + full app suite (234 files passed, 4383 tests) + tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live modifier feel in the Studio: hover/click/drag erase under held Alt in Normal and Physics modes, release restores paint, lost-keyup safety, mid-stroke ownership, zero new UI"
    requirement: QUICK-261003-VOS
    verification: []
    human_judgment: true
    rationale: "Modifier timing, cursor feel, mode parity and mid-stroke behavior live only in the native Studio webview — vitest is blind to them (node env, no DOM); five native UAT rows (a)-(e) are pending"

# Metrics
duration: 14min
completed: 2026-10-03
status: complete
plan_head_before: 7710b277181b7d8b86a894d6b91c94fa38460ed1
---

# Phase quick-261003-vos: Alt temporary erase in the Physics Paint Studio Summary

**Holding Alt in the Physics Paint Studio (Paint tool selected, Normal OR Physics mode) makes the next gesture erase through the existing ud9/hpi engine erase contract while settings.tool still reads 'paint' — release restores the brush, the selected tool never changes, nothing persists, and every existing Alt exclusion in the Studio dispatcher is preserved byte-for-byte.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-03T21:29:31Z
- **Completed:** 2026-10-03T21:43:07Z
- **Tasks:** 3/3
- **Files modified:** 3 (2 new, 1 modified)

## Accomplishments

- **TDD RED → GREEN:** Task 1 committed 29 contract cells failing at base with the honest collection error (module missing); Task 2 turned all 29 green with ZERO assertion edits to the Task 1 file, while physicsPaintStudioKeyboard.test.ts stayed at 113 green.
- **One engine touch:** the whole feature's only engine interaction is `engine.setTool('erase'|'paint')` — zero erase logic added; `packages/**` diff EMPTY. The armed gesture rides quicks 261003-hpi/261003-ud9 (click whole-stroke pointer-delete, drag pixel erase with the force law, hover preview).
- **Preserved Alt, provably:** the module never calls preventDefault/stopPropagation; physicsPaintStudioKeyboard.ts diff EMPTY; the four dispatcher Alt exclusion rows (Meta+Alt+C/X/V, Backspace/Delete, Meta+Alt+A, Escape) re-audited at HEAD and untouched; DISPATCHER GUARD PIN cells lock the exclusion behavior.
- **Stuck-state safety:** Alt keyup + window blur + visibilitychange-to-hidden disarm unconditionally; arm/disarm mid-stroke defers to pointerup/pointercancel (paint finishes paint, erase finishes erase); a capture-phase pointerdown force-sync guarantees the effective tool before the engine sees the stroke — lost keyup / Alt+Tab / hidden window can never leave the Studio stuck erasing (RECOVERY cells).
- **Full gates green:** full app vitest 234 files passed / 4383 tests passed, `tsc --noEmit` clean, scope proof allowlist OK, forbidden-path grep EMPTY.

## Task Commits

Each code task was committed atomically (docs left to the orchestrator):

1. **Task 1 (RED): temporary-erase cells** - `a1909cf8` (test)
2. **Task 2 (GREEN): signal + gated lifecycle + Studio mount** - `246026ad` (feat)
3. **Task 3: full gates + scope proof + SUMMARY** - no code changes (docs not committed, per orchestrator)

**Plan base (ledger):** `7710b277` recorded in `.git/gsd-plan-head-before-261003-vos` BEFORE the first commit (stale main-window-variant value overwritten), `commits: 2` measured from it.

## RED Evidence (Task 1, recorded honestly)

- Command: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts`
- Result at base: **collection failure, 0 tests collected** — `Failed to load url ./physicsPaintTemporaryErase … Does the file exist?` (the new module did not exist yet).
- The DISPATCHER GUARD PIN cells (Backspace+Alt, Meta+Alt+C, Escape+Alt) are green at base on their own in `physicsPaintStudioKeyboard.test.ts`, but inside the new file they were part of the module-missing collection failure — recorded as such; they are green from Task 2 onward.

## GREEN Verification (exact commands, all run)

```bash
# Targeted (Task 2 done criteria)
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
#   → 29 passed + 113 passed (142), zero assertion edits to the Task 1 file

# Full gates (Task 3)
pnpm --filter efx-motion-editor exec vitest run      # → 234 files passed | 2 skipped; 4383 tests passed | 1 skipped | 101 todo
pnpm --filter efx-motion-editor exec tsc --noEmit    # → clean

# Scope proof vs plan base 7710b277
git diff --name-only 7710b277181b7d8b86a894d6b91c94fa38460ed1...HEAD
#   → ONLY PhysicsPaintStudio.tsx, physicsPaintTemporaryErase.ts, physicsPaintTemporaryErase.test.ts
#   → EMPTY for packages/**, app/src/lib/shortcuts.ts, app/src/components/canvas/**,
#     app/src/stores/paintStore.ts, physicsPaintStudioKeyboard.ts, timeline
```

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts` (NEW) — temporaryErase signal, resolveEffectiveTool, gated keydown/keyup/blur/visibility handlers, gesture-boundary deferral + capture force-sync, mount/teardown, test reset helper. Imports only the ToolType type — zero PhysicsPaintStudio imports.
- `app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts` (NEW) — the 29-cell contract of record (RESOLVE, ARM, GATED ARM, KEYUP + LOST FOCUS, EVENT HYGIENE, boundary deferral, PENDING COALESCE, RECOVERY, engine identity resync, MOUNT WIRING, DISPATCHER GUARD PIN).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (MODIFIED, +43/−1) — three additions only: (1) latest-deps ref assigned in the render body (canvasEngineReadyImplRef precedent), (2) once-mounted listener lifecycle effect with disarm teardown, (3) armed-guarded sync effect on `[engine, settings.tool]` that does NOTHING when disarmed. No useState, no new UI, no edit to selectTool or the dispatcher.

## Alt-Binding Audit (re-run at HEAD — guardrail 1)

```
BINDING / USE                                     | WHERE                                                | VERDICT
------------------------------------------------- | ---------------------------------------------------- | -------------
Meta+Alt+C/X/V roto chord exclusion               | physicsPaintStudioKeyboard.ts:154                    | UNTOUCHED (file diff EMPTY)
Backspace/Delete requires !altKey                 | physicsPaintStudioKeyboard.ts:167-174                | UNTOUCHED — Alt-held Delete stays inert
Meta+Alt+A Select All exclusion                   | physicsPaintStudioKeyboard.ts:196                    | UNTOUCHED
Escape requires !altKey                           | physicsPaintStudioKeyboard.ts:210-217                | UNTOUCHED
Alt-click pointer handlers in the Studio canvas   | NONE (grep returns no other altKey in the tree)       | nothing to preserve
Alt usage in the engine (EfxPaintEngine)          | NONE (grep returns no altKey in packages/efx-physic-paint/src) | engine untouched
main-window Alt bindings (Alt+S, dup, uncouple,   | shortcuts.ts / PaintOverlay.tsx / TransformOverlay / | different window — shortcuts.ts not mounted on /physics-paint;
slip, layer-pick, Alt+P chord)                    | CanvasArea / TimelineInteraction                     | those files untouched (scope proof EMPTY)
```

Grep at HEAD (`altKey|AltLeft|AltRight|'Alt'` over `app/src/components/physic-paint` + `packages/efx-physic-paint/src`, excluding tests): the four dispatcher rows plus the new module's own `event.key !== 'Alt'` checks — exactly the planned shape. The new listeners consume nothing (no preventDefault/stopPropagation anywhere in the module), so holding Alt still suppresses the dispatcher's own chords exactly as today — known coexistence, preserved, not "fixed".

## Out of Scope (guardrail 2)

The **main-window inline paint editor** and **app/src/lib/shortcuts.ts** are OUT OF SCOPE: this quick targets only the Physics Paint Studio window (`/physics-paint`, main.tsx:37) which never mounts shortcuts.ts (main.tsx:104 mounts it only in the else branch). `isPaintEditMode()`/shortcuts.ts are N/A here and were not edited; PaintOverlay.tsx, paintStore.ts and the whole main-window paint tree have EMPTY diffs.

## Deviations from Plan

**1. [Interpretation] Mount's second parameter is a deps getter, not a plain deps object**
- **Found during:** Task 2 (Studio wiring)
- **Issue:** The plan's literal shape (`mount(targets, deps)` with deps assigned to a render-body ref and read once) would capture the FIRST render's `settings` closure — `getSelectedTool` would return a stale tool forever, breaking both the arm gate and the resolver.
- **Fix:** `mountPhysicsPaintTemporaryErase(targets, getDeps: () => TemporaryEraseDeps)` — the Studio passes `() => temporaryEraseDepsRef.current`, so handlers read deps from the ref at event time. This is the plan's own "latest-deps ref idiom" made literal; behavior matches the plan's stated intent in every cell.
- **Files modified:** physicsPaintTemporaryErase.ts, PhysicsPaintStudio.tsx
- **Commit:** 246026ad

**2. [Interpretation] sync `force` bypasses BOTH gates (inFlight AND the last-applied dedupe)**
- **Found during:** Task 2
- **Issue:** The plan attaches "(unless force)" only to the inFlight skip, but also claims force-sync recovers from "external setTool" and re-applies on a rail tool switch while armed — with an always-on dedupe, `selectTool` writing the engine behind our back (rail click to Paint while Alt held) would leave lastApplied == desired while the engine reads the diverged tool, and the next gesture would paint under held Alt.
- **Fix:** `force` skips both gates; it is used only by the pointerdown capture sync (every gesture START provably correct — the plan's self-healing invariant) and the armed `[engine, settings.tool]` effect. Plain syncs (arm/disarm/boundary flush) keep the plan's exact skip rules. Cell `RECOVERY … external setTool divergence` pins this.
- **Files modified:** physicsPaintTemporaryErase.ts
- **Commit:** 246026ad

**3. [Interpretation] keyup gates on `event.key === 'Alt'`**
- **Found during:** Task 1 (cell authoring)
- **Issue:** "Disarms unconditionally" refers to the ARM GATES (target/lock/tool/engine/repeat) — a keyup of a NON-Alt key while Alt stays held (press Alt, press X, release X) must not drop the arm.
- **Fix:** keyup returns early unless `event.key === 'Alt'`, then disarms with no other gate. Cell `does NOT disarm on a non-Alt keyup` locks this.
- **Files modified:** physicsPaintTemporaryErase.test.ts, physicsPaintTemporaryErase.ts
- **Commits:** a1909cf8, 246026ad

No Rule 1-4 auto-fixes were needed — no bug, no missing critical functionality, no blocker, no architectural change.

## Known Stubs

None. No placeholder values, no TODO/FIXME, no unwired component, no skipped or `todo` test added by this quick; no new UI exists to be stubbed.

## Threat Flags

None — no new surface beyond the plan's `<threat_model>` (T-vos-01..04 cover the keyboard→engine-tool trust boundary, dispatcher coexistence, cross-window isolation and ungated arm; T-vos-SC: no installs). No installs were performed.

## Pending Native UAT (verdict: automated-ready — NEVER claim done before live UAT)

**(a)** Studio window, Paint tool selected in Normal mode: press and hold Alt — hover previews the fresh stroke with the pointer glyph, the next click whole-stroke-deletes it and dragging pixel-erases baked paint, exactly like choosing the Erase tool, while the rail keeps Paint (Normal) highlighted the whole time.

**(b)** Release Alt: the next gesture paints again and the brush ring returns; a lost Alt keyup never sticks — hold Alt, switch windows (blur) or hide the Studio, come back, the canvas paints, not erases.

**(c)** Physics mode: with "Paint with physics" selected, holding Alt erases identically (fresh strokes whole-stroke, baked strokes pixel-erased with the force slider), releasing paints again, and Physics stays highlighted on the rail throughout.

**(d)** Existing Alt behavior unchanged: with Alt held, Backspace/Delete still don't delete roto keys, Meta+Alt+C/X/V/A still don't fire roto clipboard/select-all, pressing Alt while typing in a rename field doesn't arm, and holding Alt alone changes nothing else.

**(e)** Pressing or releasing Alt mid-stroke never converts the in-flight stroke (paint finishes paint, erase finishes erase), the selected tool never changes and nothing persists across a Studio reopen, and no new UI appears anywhere (no button, no overlay, no indicator).

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts
- FOUND: app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.tsx (modified)
- FOUND: a1909cf8, 246026ad (both in git log)
- Scope allowlist OK; forbidden-path diff EMPTY; full suite + tsc green
