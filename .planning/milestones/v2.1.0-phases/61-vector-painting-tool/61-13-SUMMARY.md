---
phase: 61-vector-painting-tool
plan: 13
subsystem: ui
tags:
  - watercolor
  - wireframe
  - draft-mode
  - overlay
  - preact-signals
  - tdd
  - session-state

# Dependency graph
requires:
  - phase: 61-01
    provides: "The Wave 0 reference stroke count (10 strokes at 1920x1080) used as the E7 overflow threshold"
  - phase: 61-02
    provides: "VectorAnchor, clampAnchorWidth and the width constants behind the rungs"
  - phase: 61-03
    provides: "normaliseAquarelleAnchors, projectVectorPath and the conditional engine projection"
  - phase: 61-08
    provides: "VectorPathOverlay's spine/envelope/anchors rendering and the vector pen session"
  - phase: 61-09
    provides: "The one path-edit seam, projectVectorPath and the marker constants"
provides:
  - "scriptStrokeEdition.ts — wireframeMode latch + setWireframeMode (forces Draft ON), wireframeSettleInFlight and runWireframeOffTransition (single-flight)"
  - "PhysicsPaintToolRail.tsx — the VectorSquare latch between Motion boundaries and Dry, plus the paint-row / Dry / picker reasons"
  - "PhysicsPaintStudio.tsx — the paint/picker/Dry gates, the identity-stable handler, the cross-realm publish and the paint-row deselect"
  - "VectorPathOverlay.tsx — the wireframe construction law (envelope, spine, rungs, anchors, Bezier handles) for every recorded and drafted vector stroke"
  - "ScriptStrokeOverlay.tsx — the wireframe band branch for every hand-painted stroke, reusing buildStrokeBand"
  - "PhysicsPaintStrokeSettingsDialog.tsx — the Draft switch visibly ON and inert while the latch owns the exit"
affects:
  - "Any later construction-view or debug-overlay work (the latch is the one session-only precedent next to Draft)"
  - "End-of-phase UAT for VEC-05 and VEC-03"

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 22548
  tasks: 3
  commits: 6
plan_head_before: ef89f8e65ba33bc18710bd2e46e2780fea30f347
plan_head_after: 40b8f57b67a3f6bdd8e95fb49256b5eb8d3d5463

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A session-only view latch generalises Draft: ON forces Draft on BEFORE the latch flips; OFF clears only the latch and delegates the re-bake to the ONE existing settle, single-flight through a promise ref"
    - "A gated control states WHY it is inert in its title instead of starting an implicit exit or silently switching tools"
    - "Wireframe rendering is read-only: the overlay imports no engine/bake module, skips malformed paths, and draws hand-painted bands by calling buildStrokeBand, never a parallel computation"
    - "The cross-realm publisher treats wireframe as dirty: the main realm's autosave gate stays closed while the construction view is up"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/vectorPathHandles.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts
    - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
    - app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts

key-decisions:
  - "Wireframe generalises Draft rather than adding a second engine-suppression path: setWireframeMode(true) forces setDraftMode(true) first, OFF clears only the latch, and runWireframeOffTransition joins one settleDraftScript promise so two OFF clicks share one re-bake."
  - "The wireframe-only ScriptStrokeOverlay surface is pointer-free and chrome-free: no selection handlers, no bbox, no badges; recorded vector strokes are skipped there because VectorPathOverlay owns their construction geometry."
  - "projectVectorPath gained an alwaysEnvelope option so a uniform-profile vector stroke still shows its width envelope under wireframe, while the normal projection keeps the D-10 uniform-profile suppression."
  - "The rail's one-active-surface expression stays on one line with the wireframe clause appended last, preserving the shipped pin shape and the rendered law (conjunction order is irrelevant)."
  - "The Draft switch stays visibly ON and disabled under wireframe, and its click handler refuses programmatic presses, because the latch is the ONE route out (D-16)."
  - "Dry and the picker reasons follow the approved UI-SPEC pattern verbatim: 'Dry (F) — turn wireframe off to paint' and 'Picker (I) — turn wireframe off to pick'."
  - "The E7 overflow row stays a flagged assumption: every stroke is drawn with no cap, the Wave 0 reference count (10 strokes at 1920x1080) is the threshold, and a viewport limit is the fallback only if that count is exceeded."

requirements-completed: [VEC-05, VEC-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The session-only wireframe latch forces Draft ON before flipping, is compare-then-write, and joins two OFF clicks into one settle; no persistence, export, cache-key or undo path reads it"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-13 wireframe latch — session-only, Draft-generalising"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rail toggle sits after Motion boundaries and before Dry, carries aria-pressed/title/class and stays available, including on an empty sheet"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — the wireframe latch (61-13)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Under wireframe every recorded vector stroke draws envelope, spine, explicit-width rungs, anchor shapes and Bezier-only handles; every hand-painted stroke draws buildStrokeBand's band; malformed strokes are skipped without throwing; an empty sheet draws nothing"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the wireframe drawing law (61-13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The paint row, Dry and the picker are disabled with their reason literals, the paint row renders deselected, the Draft switch is ON and inert, and the cache eye stays available"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — the wireframe gates (61-13 Task 3); app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-13 wireframe gates — reasons, Draft ownership, idempotency"
        status: pass
    human_judgment: false
  - id: D5
    description: "The E6 loading backstop is covered: the whole rail reads disabled while the OFF settle is in flight, and a repeated ON notifies nobody (one overlay pass)"
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#is disabled with the rail and while the OFF settle is in flight (E6 backstop); app/src/components/physic-paint/PhysicsPaintStudio.test.ts#treats two ON calls as ONE state change"
        status: pass
    human_judgment: false
  - id: D6
    description: "Explicit per-anchor width factors are observable as rungs: a default-width anchor renders none, a 1.8 anchor adds exactly one"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#draws a rung only where an anchor carries an explicit width"
        status: pass
    human_judgment: false
  - id: D7
    description: "Live UAT: turn wireframe on over a real sheet and confirm no bake runs and the construction geometry is legible; turn it off and confirm exactly one re-bake; toggle twice and confirm nothing changes twice"
    requirement: VEC-05
    verification: []
    human_judgment: true
    rationale: "Legibility of the construction view, the perceived absence of a bake and the single re-bake on a real sheet need human eyes; unit pins prove the state machine and the drawing data, not the on-screen result. The E7 populated/overflow rows ride this same manual check."

# Metrics
duration: 15min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 13: Wireframe Construction View Summary

**A session-only wireframe latch that generalises Draft: the rail toggle suspends the bake, every stroke shows its construction geometry (envelope, spine, explicit-width rungs, anchor shapes, Bezier handles, hand-painted bands), the paint row / Dry / picker are disabled with stated reasons, and OFF rides the one existing settle, single-flight**

## Performance

- **Duration:** 15 min
- **Started:** 2026-11-10T15:09:28Z
- **Completed:** 2026-11-10T15:24:29Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- `wireframeMode` / `setWireframeMode` live beside `draftMode` in `scriptStrokeEdition.ts`: ON forces Draft on BEFORE the latch flips, the setter is compare-then-write, and OFF clears only the latch. `runWireframeOffTransition` is single-flight through one promise ref, so two OFF calls join one `settleDraftScript`.
- The rail gained the `VectorSquare` latch exactly between Motion boundaries and Dry (35×35 grammar, `aria-pressed`, approved title). The paint row renders deselected and disabled with `Brush (B) — turn wireframe off to paint` and siblings; Dry and the picker state their own reasons and refuse programmatic presses.
- `VectorPathOverlay` draws the wireframe construction law for every recorded and drafted vector stroke: colour-tinted envelope (0.14 selected / 0.07 unselected, edges 3.5/1.5), two-pass spine (#38bdf8 selected, black/white unselected), two-pass rungs only at explicit widths, circle anchors for `auto`, 9×9 `#f59e0b` squares for `bezier`, handles only for `bezier`, all marker sizes counter-scaled.
- `ScriptStrokeOverlay` draws every hand-painted stroke's band and centreline under wireframe by calling the shipped `buildStrokeBand` — same polygon, no second builder — and skips recorded vector strokes (the construction overlay owns them). The wireframe-only surface is pointer-free and chrome-free.
- The Draft switch in the stroke settings dialog renders ON and disabled with `Draft — on while wireframe is on. Turn wireframe off to re-render.`, and its handler refuses the press; the cache eye is untouched.
- The cross-realm Draft publisher now includes `wireframeMode`, so the main realm's autosave gate stays closed while the construction view is up; a source pin asserts no persistence path references the latch.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end wireframe latch, rail entry, single-flight OFF settle (tracer)** - `e256f4c1a` (test), `4161df060` (feat)
2. **Task 2: The wireframe drawing law for both stroke families** - `a678a48e3` (test), `7006dca20` (feat)
3. **Task 3: Gates, reasons, Draft ownership, idempotency, empty sheet, E6 backstop** - `397e68254` (feat), `40b8f57b6` (fix — full-suite pin closure)

**Plan metadata:** see the final docs commit (SUMMARY/STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` - `wireframeMode`, `setWireframeMode`, `wireframeSettleInFlight`, `runWireframeOffTransition`
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` - The latch button, the paint-row deselect and the reason copies
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` - Position/grammar/aria pins, gate reasons, E6 disable window, E7 threshold comment
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - The Draft switch ON/disabled/inert under wireframe
- `app/src/components/physic-paint/view/vectorPathHandles.ts` - `projectVectorPath` `alwaysEnvelope` option
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` - Wireframe render law: envelope, spine, rungs, anchors, handles, hand-painted delegation
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` - Eight wireframe drawing-law tests
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` - Wireframe band branch, vector-stroke skip, pointer-free surface
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Gates, handler, cross-realm publish, paint-row deselect
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Latch/settle/session-only and gate-source pins
- `app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts`, `AquarelleToolRow.test.tsx`, `physicsPaintHandToolWiring.test.ts` - Shipped pins updated for the new expressions/imports

## Decisions Made
- Wireframe generalises Draft (no second engine-suppression path); OFF delegates to `settleDraftScript`.
- `ScriptStrokeOverlay` skips recorded vector strokes under wireframe — construction geometry belongs to `VectorPathOverlay`; hand-painted bands reuse `buildStrokeBand` verbatim.
- `alwaysEnvelope` on `projectVectorPath` keeps the D-10 uniform-profile suppression intact outside wireframe while showing the envelope inside it.
- The rail's one-active-surface expression stays one line with the wireframe clause appended, keeping the shipped pin shape.
- Dry and picker reasons follow the approved UI-SPEC pattern (`... — turn wireframe off to paint|pick`).
- E7 overflow stays a flagged assumption, threshold = the Wave 0 reference count (10 strokes at 1920x1080).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired the Draft switch in a file outside Task 3's list**
- **Found during:** Task 3
- **Issue:** Task 3's action requires the Draft switch to render ON and disabled under wireframe, but `PhysicsPaintStrokeSettingsDialog.tsx` was not in the task's `<files>`.
- **Fix:** Added the `wireframeMode` read, the disabled state, the approved title and the click guard.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`
- **Verification:** `PhysicsPaintStudio.test.ts` asserts the read, disable, title literal and guard; full suite green.
- **Committed in:** `397e68254` (Task 3)

**2. [Rule 3 - Blocking] `projectVectorPath` needed an `alwaysEnvelope` option**
- **Found during:** Task 2 (GREEN)
- **Issue:** A uniform-width vector stroke projects no envelope by design (D-10), but the wireframe must show every stroke's width envelope.
- **Fix:** Added an optional `alwaysEnvelope` flag and passed it from both wireframe call sites; the normal projection path is byte-unchanged.
- **Files modified:** `app/src/components/physic-paint/view/vectorPathHandles.ts`
- **Verification:** The uniform-profile fixture in `VectorPathOverlay.test.ts` renders one envelope under wireframe; 46/46 file set green.
- **Committed in:** `7006dca20` (Task 2 GREEN)

**3. [Rule 1 - Bug] Empty sheet mounted an empty wireframe svg instead of nothing**
- **Found during:** Task 2 (GREEN, full file run)
- **Issue:** The wireframe display branch returned the svg shell even when `listStrokes` was empty, failing the "empty sheet draws no overlay" law.
- **Fix:** Return null when there is no interactive surface and no strokes.
- **Files modified:** `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`
- **Verification:** The empty-sheet case passes; 46/46 file set green.
- **Committed in:** `7006dca20` (Task 2 GREEN)

**4. [Rule 1 - Bug] Shipped source pins invalidated by the plan's own expressions**
- **Found during:** Tasks 2-3 and the full-suite gate
- **Issue:** `aquarelleWetPaintGate.test.ts` and `AquarelleToolRow.test.tsx` pinned the old disabled/title literals; `PhysicsPaintStudio.test.ts`, `railMotionBoundaryTool.test.ts` and `physicsPaintHandToolWiring.test.ts` pinned the one-active-surface line; the hand-tool file also pinned the exact lucide import.
- **Fix:** Updated the affected pins to the new expressions/import (`VectorSquare`), keeping the expression on one line with the wireframe clause last so the rail pins stay narrow. Pins for files untouched by this plan were not altered.
- **Files modified:** `aquarelleWetPaintGate.test.ts`, `AquarelleToolRow.test.tsx`, `PhysicsPaintStudio.test.ts`, `physicsPaintHandToolWiring.test.ts`
- **Verification:** Full app suite 8628 passed; `tsc --noEmit` clean.
- **Committed in:** `397e68254` and `40b8f57b6`

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** All were direct consequences of the plan's own wiring and drawing law; no behaviour or scope change beyond the plan's intent.

## Issues Encountered
- The Task 3 focused verify ran only the plan's two files, so the full-suite gate later surfaced the hand-tool pin (`VectorSquare` import and the one-active-surface expression). Resolved by restoring the single-line expression shape and updating those two pins in a follow-up fix commit; the full suite then passed 8628 tests.

## TDD Gate Compliance

| Task | RED commit | RED evidence | GREEN commit |
|------|-----------|--------------|--------------|
| Task 1 (tracer, tdd) | `e256f4c1a` | `.red-evidence/61-13-t1/red-record.json` — RED_EVIDENCE_OK | `4161df060` |
| Task 2 (tdd) | `a678a48e3` | `.red-evidence/61-13-t2/red-record.json` — RED_EVIDENCE_OK | `7006dca20` |

Task 3 carries no `tdd` attribute and had no RED phase; its assertions were added in the same atomic commit as the gates they pin. No REFACTOR commit was needed.

## Known Stubs

None. No placeholder branch, hardcoded empty data or unwired component remains. The E7 overflow row is a recorded flagged assumption (not a stub): the overlay draws every stroke with no cap, the Wave 0 reference count (10 strokes at 1920x1080) is the threshold, and a viewport limit is the stated fallback only if a real sheet exceeds it. The E7 populated row is the held-out manual check (coverage D7).

## Threat Surface

- T-61-44 (wireframe leaking into persisted state): `wireframeMode` lives in `scriptStrokeEdition.ts`; a source pin asserts the snapshot controller, replay, live-pixel transactions, exporter, auto-save, project store, types and `toStudioStroke` never reference it; `toStudioStroke` and the types also assert no `wireframe` token.
- T-61-45 (a second re-bake from a repeated OFF): `runWireframeOffTransition` returns the in-flight promise; the test asserts one settle call and identity for two OFF calls.
- T-61-46 (an overlay writing engine state): the wireframe pass is render-only (imports no engine/bake module), skips malformed anchor lists and never throws into render; the hand-painted band is delegated.
- T-61-47 (uncapped dense wireframe): accepted and recorded as the E7 overflow flagged assumption above; the threshold is named in the rail test comment.
- T-61-SC (package installs): no dependency added.
- No new network endpoint, auth path or file-access pattern was introduced.

## Next Phase Readiness
- VEC-05 and VEC-03 are implemented and pinned; the wireframe construction view is available from the rail and leaves through the one Draft settle.
- End-of-phase live UAT remains (coverage D7): wireframe on over a real sheet, legibility, OFF → one re-bake, double toggle idempotency, plus the E7 populated check against the Wave 0 reference count.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- All key files exist on disk.
- All six plan commits (`e256f4c1a`, `4161df060`, `a678a48e3`, `7006dca20`, `397e68254`, `40b8f57b6`) are ancestors of HEAD.
