---
phase: 61-vector-painting-tool
plan: 18
subsystem: ui
tags: [preact, signals, wireframe, draft-mode, settle, choke-point, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: 61-13 the wireframe latch and its OFF transition, 61-15 the vector commit route, 61-17 the Select/picker entry releases
provides:
  - setDraftMode refuses the OFF edge while wireframeMode is on (the one setter every route uses)
  - WIREFRAME_SETTLE_REFUSED_MESSAGE, the one fixed refusal line, owned by the edition leaf
  - settleDraftScript refuses as its FIRST statement, publishing the reason and resolving false ahead of the clean no-op
  - The rail's Select control disabled with its approved reason while the latch is on
affects: [61-19, 61-20]

actuals:
  tokens: 5032
  tasks: 2
  commits: 4
  plan_head_before: 4001f18bb3e72cb0d57729fd8aa54737b1d0a97e
  plan_head_after: fa57855f012579c8905edeffda3ba63fd26b3c95

tech-stack:
  added: []
  patterns:
    - "GENERALISE the existing latch instead of adding a second suppression path: the guard lives in the one setter and the one settle, never in a third signal"
    - "A refusal is a bounded terminal state: publish one fixed reason and resolve false, never reject and never retry"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts

key-decisions:
  - "The wireframe refusal mirrors the existing dirty-pixel refusal in the same guard: `if (!on && (draftPixelsDirty.value || wireframeMode.peek())) return;` — the ON edge is untouched"
  - "The settle guard publishes through setApplyMessage + setApplyStatus('error') only: no setLastError and no scriptApplyRefusalOwnedRef, because this is a refusal, not a failed apply"
  - "The settle guard is the callback's FIRST statement, ahead of the clean no-op return, so no exit can answer \"clean\" behind the construction view"
  - "The new constant was appended to the Studio's scriptStrokeEdition import rather than prepended, so the shipped 61-13 exact import-block pin stays byte-unchanged"
  - "The rail's Select title switches to the fixed reason while the latch is on; the pen and the wireframe latch itself stay enabled (D-16 escape routes)"

requirements-completed: [VEC-05]

coverage:
  - id: D1
    description: "Draft cannot be switched off while the wireframe view is on, by any route (G-7)"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/scriptStrokeEdition.test.ts#scriptStrokeEdition — wireframe holds Draft (61-18) > refuses to leave Draft while the wireframe view is on"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/scriptStrokeEdition.test.ts#scriptStrokeEdition — wireframe holds Draft (61-18) > never refuses the ON edge while the wireframe view is on"
        status: pass
    human_judgment: false
  - id: D2
    description: "The one Draft settle refuses before it resets the sheet or applies the script, so no re-bake starts behind the construction view (G-7)"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-18 the wireframe settle refusal in the Studio > refuses the settle while wireframe is on, ahead of the clean no-op return"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every route the refusal blocks surfaces the wireframe reason — the guard publishes the fixed message through the shipped capsule, and save/export still cancels"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-18 the wireframe settle refusal in the Studio > refuses the settle while wireframe is on, ahead of the clean no-op return"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-18 the wireframe settle refusal in the Studio > keeps the save/export flush cancelling on a refused settle, before any capture"
        status: pass
    human_judgment: false
  - id: D4
    description: "Turning wireframe off still completes: the OFF transition clears the latch FIRST, so the settle it hands over is not blocked by its own guard (G-7)"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/scriptStrokeEdition.test.ts#scriptStrokeEdition — wireframe holds Draft (61-18) > clears the wireframe latch before the OFF settle runs, so the settle can leave Draft"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/scriptStrokeEdition.test.ts#scriptStrokeEdition — wireframe holds Draft (61-18) > completes the OFF transition with the latch and Draft both off"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-13 wireframe latch — session-only, Draft-generalising (7 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The rail's Select control is disabled with its reason while wireframe is on, and the vector pen and the wireframe latch stay available (G-7, D-16)"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — the wireframe gates (61-13 Task 3) > disables Select with its reason while the wireframe is on"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — the wireframe gates (61-13 Task 3) > keeps the vector pen and the latch itself available — an empty sheet never locks"
        status: pass
    human_judgment: true
    rationale: "The prop pins prove the disabled state and the tooltip; only a live hover over the rail proves the reason reads on the real control."
  - id: D6
    description: "Nothing about the wireframe latch is persisted, exported or pushed onto the undo stack by these gates — they only refuse (D-16)"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-13 wireframe latch — session-only, Draft-generalising (7 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 18: Wireframe Holds Draft and Refuses the Settle Summary

**With the wireframe view on, Draft can no longer be switched off by any route and the one settle refuses with a fixed reason before it resets or re-bakes the sheet — while turning wireframe off still settles in one pass and the rail states why Select is inert**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-10T21:53:45Z
- **Completed:** 2026-11-10T21:59:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `setDraftMode` now refuses the OFF edge while the `wireframeMode` latch is on, in the same guard as the dirty-pixel refusal: `if (!on && (draftPixelsDirty.value || wireframeMode.peek())) return;`. The ON edge is untouched, and a refused leave writes nothing and notifies nobody.
- Added `WIREFRAME_SETTLE_REFUSED_MESSAGE = 'Draft recompute refused — wireframe is on. Turn wireframe off to re-render.'` next to the latch in `scriptStrokeEdition.ts` — one fixed, non-interpolated line owned by the edition leaf.
- `settleDraftScript` now refuses as its FIRST statement while the latch is on: it publishes the fixed message through `setApplyMessage`, sets `applyStatus` to `error`, and resolves `false` ahead of the clean no-op return. No `setLastError` and no owned-refusal claim — a refusal is not a failed apply.
- All six shipped settle consumers inherit the refusal and its stated reason: `switchActiveTrack`, playback entry, `navigateToSyncedPhysicalFrame`, the last-stroke delete tail, the dialog-close bundle and the save/export flush. The flush still throws on a refused settle, so save/export is cancelled with the wireframe reason in the capsule instead of capturing the construction view.
- The OFF transition is unchanged: `runWireframeOffTransition` still clears the latch before calling the settle, so the intended recompute passes the guard and completes in one pass.
- The rail's Select control gains `wireframeActive` in its `disabled` expression and the approved title `Select (A) — turn wireframe off to select` while the latch is on; the vector pen and the wireframe latch itself remain enabled, and the shipped pen-and-latch pin is untouched and green.
- Suite cleanup in `scriptStrokeEdition.test.ts` resets the latch BEFORE the Draft reset, so a leaked latch can never make the cleanup itself a silent no-op.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: pin the wireframe Draft hold and the settle refusal** - `03885cf45` (test)
2. **Task 1 GREEN: hold Draft under wireframe and refuse the settle** - `2514f3d86` (feat)
3. **Task 2 RED: pin the rail's Select gate under wireframe** - `e4cf1aa96` (test)
4. **Task 2 GREEN: gate the rail's Select control under wireframe** - `fa57855f0` (feat)

**Plan metadata:** recorded with the docs commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` - the second leave reason in `setDraftMode` plus the fixed refusal constant
- `app/src/components/physic-paint/view/scriptStrokeEdition.test.ts` - five new cases (25 → 30): the refused leave, the ON edge, the OFF ordering, the OFF end state and the constant pin; cleanup resets the latch first
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - the settle's first-statement refusal and the constant import
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - two new source pins (376 → 378) and the refreshed Select disabled-expression pin
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` - the Select wireframe gate and its reason
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` - two new cases (15 → 17): the gated Select and the shipped restore

## Decisions Made

- The refusal reuses the existing guard shape rather than adding a second check: the leave guard already returns silently for dirty pixels, and the wireframe reason joins it with `||`.
- The constant lives in the edition leaf (the latch's owner), not in the Studio, so the copy has exactly one declaration and the Studio imports it through the session seam.
- The guard publishes only the message and the error status; it deliberately does not set `setLastError` or `scriptApplyRefusalOwnedRef`, keeping console-noise ownership with real apply failures.
- The new import was appended at the END of the Studio's `./view/scriptStrokeEdition` import block instead of the alphabetically correct front, preserving the shipped 61-13 exact import-block pin byte-for-byte.
- The rail keeps `aria-pressed` and `onClick` exactly as shipped; only the inert state and its `title` change, matching the paint row / picker / Dry gate pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved the shipped 61-13 exact import-block pin**
- **Found during:** Task 1 GREEN (`PhysicsPaintStudio.test.ts` run)
- **Issue:** the first GREEN attempt prepended `WIREFRAME_SETTLE_REFUSED_MESSAGE` to the Studio's `./view/scriptStrokeEdition` import block, which broke the shipped 61-13 pin whose start marker is the literal `import {\n  deleteSelectedScriptStroke,`.
- **Fix:** appended the new symbol at the end of the same block instead, so the shipped pin stays byte-unchanged; no assertion was edited or relaxed.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Verification:** the full 61-13 wireframe suite is green; 408/408 after GREEN.
- **Committed in:** `2514f3d86`

**2. [Rule 1 - Bug] Refreshed the shipped exact Select disabled-expression pin**
- **Found during:** Task 2 GREEN planning
- **Issue:** the shipped pin in `PhysicsPaintStudio.test.ts` asserted `disabled={railDisabled || !selectAvailable.value}`, which the plan-mandated wireframe gate makes false.
- **Fix:** updated the exact assertion to `disabled={railDisabled || wireframeActive || !selectAvailable.value}` with a 61-18 comment; the Select copy pin and every other rail assertion are unchanged.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** the pin still enforces an exact expression; the three suites stay 425/425.
- **Committed in:** `fa57855f0`

---

**Total deviations:** 2 auto-fixed (both stale exact pins that the plan's own changes made false)
**Impact on plan:** Neither changed scope. Both keep shipped assertions truthful and exact; nothing was deleted or weakened.

## Issues Encountered

- The Task 1 GREEN run first reported one failure from the 61-13 import-block pin (see deviation 1); appending the import instead of prepending resolved it without touching the pin.
- `pnpm exec vitest run` prints pre-existing sourcemap warnings from `@efxlab/motion-canvas-core`; they are unrelated and were not addressed (out of scope).

## TDD Gate Compliance

- Task 1: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (3 failing / 405 passing of 408 at RED; the target was `scriptStrokeEdition — wireframe holds Draft (61-18) > refuses to leave Draft while the wireframe view is on`, and the other two failures were the new guard and constant pins). GREEN: 408/408 across the two suites.
- Task 2: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (1 failing / 16 passing of 17 at RED; the target was `WatercolorRail — the wireframe gates (61-13 Task 3) > disables Select with its reason while the wireframe is on`). GREEN: 17/17.
- Both GREEN commits were preceded by their RED commit; no production code was written before its RED.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-7 is implemented and pinned: with wireframe on, Draft cannot leave and the one settle refuses before any reset or apply.
- Live UAT rows: (1) turn wireframe on, then try the Draft control in the workflow strip — the capsule must read "Draft recompute refused — wireframe is on. Turn wireframe off to re-render." and the sheet must not change; (2) with wireframe on, hover Select — it must be disabled with "Select (A) — turn wireframe off to select", while the pen and the wireframe latch stay usable; (3) turn wireframe off — the sheet must re-bake in one pass.
- Known user-visible consequence, by design: save and export are unavailable while wireframe is on (the flush settles first and refuses); turning wireframe off and retrying is the way out.
- 61-19/61-20 can build on this; no blockers. Out of scope and unchanged: WR-01 through WR-05, IN-01 through IN-03.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/scriptStrokeEdition.ts
- FOUND: app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.tsx
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- FOUND: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts
- FOUND: 03885cf45
- FOUND: 2514f3d86
- FOUND: e4cf1aa96
- FOUND: fa57855f0
