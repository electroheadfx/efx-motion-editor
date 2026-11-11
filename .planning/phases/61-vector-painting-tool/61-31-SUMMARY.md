---
phase: 61-vector-painting-tool
plan: 31
subsystem: ui
tags: [vector-path, curve-mode, spline, stroke-settings, vector-overlay, tdd, gap-closure, g20]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-30's curve-mode vocabulary (`AquarelleCurveMode`, `resolveAquarelleCurveMode`, `resolveCurveAnchors`, `evaluateAquarellePath`) and the optional mode on `buildDraftPath` / `projectVectorPath` / `hitTestVectorPath` / `promoteAnchorForDrag` / `insertAnchorOnSegment`"
  - phase: 61-vector-painting-tool
    provides: "61-29's `updateAquarelleCurveModeInScript` batch door (one write, re-sampled points, no seed-salt bump)"
  - phase: 61-vector-painting-tool
    provides: "61-12's Render row grammar in the stroke-settings Paint tab (`readRenderMode`, `SEGMENT_*` styles, block order) and `handleAquarelleRenderModeStrokes` as the Studio seam template"
  - phase: 61-vector-painting-tool
    provides: "61-09/61-10's vector overlay (`DrawnVectorPath`, `drawnPathOf`, `renderPath`, `startEditDrag`) and 61-22's anchor selection ring"
provides:
  - "`ScriptStrokeAppearance.curveMode` + `.vector`, `CurveModeReading`, `CurveModeOption`, `CURVE_MODE_OPTIONS`, `readCurveMode` and `StrokeSettingsDialogBundle.applyCurveMode` in `strokeSettingsModel`"
  - "`beginAquarelleCurveModeEdit` — one snapshot pair around the batch door, drag cleared, in-flight refused, no seed-salt bump"
  - "`handleAquarelleCurveModeStrokes` + the bundle's `applyCurveMode`; `readAppearance` attaches each stroke's `curveMode` and `vector`"
  - "The Paint tab's Curve row beside Render: three-condition mount gate, one option per mode, Mixed caption, active-press guard, ONE commit call site"
  - "Per-stroke mode through `drawnPathOf` (handles + projection), the recorded loop, the default-mode draft, and every edit helper (`resolveAnchorHandles` view, `hitTestVectorPath`, `promoteAnchorForDrag`, `insertAnchorOnSegment`)"
  - "Ownership-driven overlay chrome: under Spline every anchor marker and its selection ring is a circle and the whole handle block is inert; under Bézier the shipped square/dot chrome is byte-identical"
affects: [61-32, phase-61-uat]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 14935
  tasks: 3
  commits: 6

plan_head_before: 7522d6bf15683684f0e85d0b32dae0ef68e5a371
plan_head_after: 0f563c9abc277a61369ec86a2470216a25cb0ec4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A switch row mirrors the shipped Render row step for step: a dedicated `read…` reading over the hydrated appearances, one option per model value, Mixed with no lit option, and an `active` press guard before the ONE commit call site"
    - "A batch edit wrapper owns exactly one snapshot pair: clear any released ghost, refuse while a script edit is in flight, normalise the ids, write through the existing batch door, store once; a mode write never bumps the seed salt because the mode is not paint"
    - "A per-path discriminator is read where the path is resolved: each drawn path carries its own mode from its own stroke, the draft carries the default, and the same mode object feeds chrome, hit test and edit so geometry and markers can never disagree"
    - "Chrome shape follows OWNERSHIP, not stored kind (61-UI-SPEC §340-341): under Spline no anchor owns a tangent, so no square and no dot may imply a control"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts

key-decisions:
  - "Per-stroke `curveMode` behind an explicit Paint-tab row, never a document-level setting: the row is available only when the selection holds at least one vector stroke, and hand-painted strokes in a mixed selection are ignored so no hand-painted stroke is ever written."
  - "`readCurveMode` filters on `vector === true` before reading the mode, so the `vector` flag is the single availability test — a hand-painted-only selection shows no row, and a mixed vector/hand-painted selection shows the row and writes only the vector ids."
  - "The Studio hydrates `curveMode` and `vector` in a SECOND `.map()` pass that keeps the shipped first pass byte-identical, so the 61-12 render-mode pins keep matching their exact source text."
  - "`wasPromoted` is gated on the mode (`editTargetCurveMode !== 'spline' && current.kind !== 'bezier'`): under Spline promotion returns the list untouched, so a grab-and-release has no promotion to preserve and commits nothing."
  - "The 61-22 selection ring also follows `ownsHandles(anchor)`, beyond the plan's marker-only sentence: a square ring around a spline circle would imply an ownership the mode does not use (the UI-SPEC §340-341 law applied to the ring). Under Bézier the ring is unchanged."
  - "The draft path passes `DEFAULT_AQUARELLE_CURVE_MODE` explicitly rather than relying on the option default: a draft is always recorded Bézier and must never inherit the edit target's mode."

requirements-completed: [VEC-01, VEC-02, VEC-06, VEC-07]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "`readCurveMode` reading (mode / mixed / available), the frozen two-option model list and the bundle's `applyCurveMode` seam"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-31 curve mode reading (Paint tab)"
    human_judgment: false
  - id: D2
    description: "`beginAquarelleCurveModeEdit` writes the mode for every selected vector stroke as ONE snapshot pair, refuses while a script edit is in flight, and never bumps the seed salt"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#61-31 curve-mode batch edit (G-20)"
    human_judgment: false
  - id: D3
    description: "The Paint tab's Curve row: three-condition mount gate, one option per mode, Mixed caption, active-press guard and ONE `bundle.applyCurveMode` call site"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-31 Curve row (G-20)"
    human_judgment: false
  - id: D4
    description: "The Studio bundle: `readAppearance` attaches `curveMode` + `vector`, `applyCurveMode` routes through exactly one guarded handler, and the handler is a named peer of the render-mode handler"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-31 Curve mode bundle wiring in the Studio"
    human_judgment: false
  - id: D5
    description: "Every vector path draws through its own stroke's mode and every edit helper receives the open target's mode; under Spline no handle dot or bezier square is drawn"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-31 G-20 - the overlay draws and edits through each path curve mode"
    human_judgment: false
  - id: D6
    description: "Native UAT rows A-F: the live Curve row, the shape change and one-undo round trip, the authored-handle restoration, Mixed conversion, the hand-painted-only absence, the spline insert landing on the curve, and the saved/reopened spline"
    requirement: VEC-02
    verification: []
    human_judgment: true
    rationale: "The switch is a live visual surface: the plan's acceptance criteria are shape, chrome ownership and undo round trips the user judges by eye on the real canvas. Unit tests pin the source seams and the sampled spine, but they cannot see the rendered engine frame or confirm the authored handles return to the pixel after a real save/reopen."

# Metrics
duration: 11min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 31: Per-stroke curve mode — the Curve row, its one-edit commit, and mode-true canvas chrome

**A selected vector stroke gets an explicit Bézier / Spline switch beside the shipped Render row, written as one undoable edit, and the canvas now draws, hit-tests, inserts and promotes through each path's own mode so a spline stroke never shows a bezier square or a dormant handle dot**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-11T14:14:00Z (reconstructed — see Issues Encountered)
- **Completed:** 2026-11-11T14:25:20Z
- **Tasks:** 3
- **Files modified:** 10 (plus three RED evidence directories)

## Accomplishments

- The Paint tab gains a Curve row that mirrors the Render row law for law: three-condition mount gate (watercolor engine, `available`, `bundle.applyCurveMode` present), one segment per model option, the shipped red italic Mixed caption, and an active-press guard so pressing the lit mode writes nothing.
- `beginAquarelleCurveModeEdit` commits the mode for every selected vector stroke as exactly ONE `aquarelle-script` history entry — one snapshot pair, no seed-salt bump, in-flight refused, released ghost cleared — and the Studio routes it through a single guarded handler that restores on failure.
- The overlay tells the truth about the mode it draws: each recorded path resolves its own stroke's mode (never the edit target's), the draft always draws Bézier, and the edit target's mode reaches the handle view, the hit test, the promotion and the insert so no spline gesture can rewrite an authored kind or handle.
- Under Spline every anchor marker and its selection ring becomes the auto-smooth circle and the entire handle block goes inert (61-UI-SPEC §340-341: amber marks a control the user owns); under Bézier every shipped branch is byte-identical.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 (tracer): End-to-end curve-mode data path** — `a95c616a7` (test) → `144871b53` (feat)
2. **Task 2: Curve row in the Paint tab and the one-seam Studio commit** — `fbbfe87cf` (test) → `cf2bec4f1` (feat)
3. **Task 3: The overlay draws and edits through each path's mode** — `2e9804c25` (test) → `0f563c9ab` (feat)

**Plan metadata:** see the completion commit that follows this file.

## Files Created/Modified

- `app/src/components/physic-paint/view/strokeSettingsModel.ts` — `ScriptStrokeAppearance.curveMode` + `.vector`, `CurveModeReading`, `CurveModeOption`, `CURVE_MODE_OPTIONS`, `readCurveMode`, `StrokeSettingsDialogBundle.applyCurveMode`.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — `beginAquarelleCurveModeEdit` wrapper.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `handleAquarelleCurveModeStrokes`, bundle `applyCurveMode`, `readAppearance` `curveMode`/`vector` hydration, memo dep.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — the Curve block (after Render, before Color).
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` — `DrawnVectorPath.curveMode`, `drawnPathOf` mode view, recorded/draft modes, `renderPath` ownership branch, mode into all four edit helpers, defaulted `wasPromoted`.
- The five matching `.test.ts` suites (5 model pins, 3 selection pins, 4 dialog pins, 2 Studio pins, 4 overlay pins).

## Decisions Made

- Per-stroke mode behind an explicit row, never a document setting; the row's availability reads `vector === true` so hand-painted-only selections show nothing and mixed selections convert only their vector strokes.
- The Studio's hydration is a second `.map()` pass so the shipped first pass (and its 61-12 source pins) remains byte-identical.
- The draft passes the Bézier default explicitly; the recorded loop passes each stroke's own mode, so a spline path reads as a spline while another stroke is edited.
- Under Spline `wasPromoted` is false, so a grab-and-release commits nothing; promotion already returns the list untouched.
- The 61-22 selection ring follows the same ownership predicate as the marker, keeping a spline path's chrome entirely circular.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two shipped Studio census pins went stale with the new handler**
- **Found during:** Task 2 (Curve row and Studio seam)
- **Issue:** Adding `handleAquarelleCurveModeStrokes` made two truthful-count pins false: the refusal-mapper census read 14 (actual 15) and the durable-base call census read 10 (actual 11). Both failed the Studio suite.
- **Fix:** Updated both pins to the true counts with named-site comments, and added the new handler to the durable-base handler loop array.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Studio suite 406/406; full plan set 792/792.
- **Committed in:** `cf2bec4f1` (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] Two unused fixture ids failed the type check**
- **Found during:** Task 3 (overlay mode threading)
- **Issue:** `tsc --noEmit` reported TS6133 for `EDIT_ID` and `OTHER_ID`, two constants the new behavioural fixtures never read (`noUnusedLocals`).
- **Fix:** Removed both constants from the new describe block.
- **Files modified:** `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts`
- **Verification:** `tsc --noEmit` clean; overlay suite 76/76.
- **Committed in:** `0f563c9ab` (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both were consequences of the planned edits (a new handler changes census counts; a new test block must compile). No scope creep.

## Issues Encountered

- **Dialog baseline drift:** the plan's test-count floor said the dialog suite had 42 tests before Task 2; the actual baseline was 45. After the four new pins the suite reports 49, still above the plan's floor of 46 — the floor held, the before-count was simply stale.
- **RED scaffolding:** Tasks 1 and 2 committed minimal `SCRATCH STUB (61-31 RED)` implementations so the imported names resolved and the tests failed on their planned assertions rather than on collection (the 61-30 precedent); each stub was replaced by the real implementation in its GREEN commit and no stub text remains in the tree.
- **Start timestamp reconstructed:** the exact plan dispatch time was lost across a context boundary; `Started` is derived from the first RED run (`14:17:17Z`) minus the read-first window. The completed time and both measured HEADs are exact.
- **Measurements:** `commits: 6` is measured with `git rev-list --count 7522d6bf..HEAD`; `actuals.tokens: 14935` is `chars/4` over `git diff 7522d6bf..HEAD -- app packages` (evidence directories excluded).

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
| ---- | --- | ----- | -------- | ------ |
| Task 1 (tracer, tdd) | `a95c616a7` — `RED_EVIDENCE_OK`, target failed on the missing `readCurveMode` reading | `144871b53` | — | Pass |
| Task 2 (auto, tdd) | `fbbfe87cf` — `RED_EVIDENCE_OK`, target failed on `expected +0 to be 1` (no Curve block at HEAD) | `cf2bec4f1` | — | Pass |
| Task 3 (auto, tdd) | `2e9804c25` — `RED_EVIDENCE_OK`, target rendered the Bézier spine for a `curveMode: 'spline'` stroke | `0f563c9ab` | — | Pass |

All three RED runs failed on their own planned assertions with no load or fixture failures. Floors held exactly: model 177→182 / 182, selection 76→79 / 79, dialog 42(actual 45)→49 / floor 46, Studio 404→406 / 406, overlay 72→76 / 76.

## Known Stubs

None — no hardcoded empty values, placeholder text or unwired data sources were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-20 is complete end to end: payload (61-30), row, one-edit commit and canvas chrome (this plan).
- The six native UAT rows (A–F in 61-31-PLAN) remain for the user's live pass: they are the acceptance evidence for the shaped canvas, the undo round trip and the save/reopen parity.
- `requirements-completed` lists VEC-01/VEC-02/VEC-06/VEC-07 per the plan frontmatter; the requirement flip may be gated by IDs shared with sibling plans (the 61-28 precedent).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*
