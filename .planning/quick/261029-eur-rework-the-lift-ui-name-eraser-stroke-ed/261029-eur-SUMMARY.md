---
phase: 261029-eur
plan: 01
subsystem: ui
tags: [preact, signals, svg-overlay, watercolor, eraser, stroke-settings]

# Dependency graph
requires:
  - phase: 261028-k03
    provides: the recorded Lift pipeline, lift tip shapes and the six eraser messages
  - phase: 261024-p5q / 261024-vga
    provides: the Stroke Settings dialog, its open/dismissal law and the Stack section
provides:
  - a derived Eraser "Edit" switch (selectMode AND filter === 'lift')
  - an aquarelleStrokeTypeFilter ('all' | 'paint' | 'lift') pruned by one setter
  - a footprint-accurate red lift ribbon (pure builder + revision-keyed cache)
  - an All | Eraser | Paint Stroke Settings row, Paint-tab hide and keep-open-on-empty
  - the Eraser copy rename across the four Studio UI files
affects: [261029-eur follow-ups, watercolor stroke editing, Roto Studio UAT]

actuals:
  tokens: 29922
  tasks: 3
  commits: 3
plan_head_before: 1e597cb4412c5324e524856c3b316a296857d147
plan_head_after: b9c04e39edb263883ff1919035ae711d982e99cd

tech-stack:
  added: []
  patterns:
    - "Derived toggle state (selectMode AND filter) instead of a mirrored boolean"
    - "One exported radius law shared by the punch and the overlay by construction"
    - "Module-level dismissal signal cleared only at a single choke point"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleLiftRibbon.ts
    - app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts
  modified:
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
    - app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts
    - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
    - app/src/components/physic-paint/view/LiftShapePicker.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "The Edit switch is DERIVED (selectMode AND filter === 'lift'), never a mirrored boolean, so flipping the dialog filter turns it off for free"
  - "liftStrokeRadiusPx uses the band's ANALYTIC MAXIMUM support, not the bare footprint radius, so the wide side of an aspect > 1 tip is clickable"
  - "The ribbon derives normals in the doc-pixel (y-up) frame and flips to canvas px only at the end — the frame that prevents the mirror bug on non-square sheets"
  - "The dismissal flag is module-level and cleared ONLY at the setAquarelleSelectMode off -> on choke point; no render-body signal write was added"
  - "The Studio bundle keeps listStrokes at the 2-arg default 'all' so Stack positions and neighbours stay global while the overlay is filtered"

patterns-established:
  - "One footprint law: liftRadiusDoc/liftEngineSize exported from roto/aquarelleLiftErase and consumed by both collectLiftDabs and aquarelleLiftRibbon"
  - "Copy-only rename: visible strings say Eraser; tool ids, param keys, identifiers, CSS classes and serialized data keep the Lift spelling"

requirements-completed: [EDIT-SWITCH, STROKE-FILTER, LIFT-RIBBON, ERASER-COPY]

coverage:
  - id: D1
    description: "The Eraser top bar carries a derived Edit switch (role=switch, physics-lift-edit, label Edit, off by default) and no one-shot Select lifts button"
    requirement: EDIT-SWITCH
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#Edit switch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#retires the one-shot Select lifts action from the Studio"
        status: pass
    human_judgment: true
    rationale: "UAT rows 1-3 (switch placement, live outline scope, empty frame) need the live Studio UI."
  - id: D2
    description: "All | Eraser | Paint filter drives outline + hit-test and prunes the selection; the dialog hides Paint in Eraser and stays open on an empty selection with explicit close winning until select-mode re-entry"
    requirement: STROKE-FILTER
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#261029-eur dialog filter row, Paint-tab law and open-on-empty"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#261029-eur stroke-type filter"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#keeps the Stroke Settings bundle unfiltered and open on an empty selection"
        status: pass
    human_judgment: true
    rationale: "UAT rows 4-5 (filter switcher pruning, dialog stays open) are live-UI judgments."
  - id: D3
    description: "Lift strokes draw as one red translucent ribbon following the punch's own footprint law; every polygon vertex tracks drag/transform previews; hit radius is the band's maximum support"
    requirement: LIFT-RIBBON
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts (8 tests incl. non-square mirror pin)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts#stamps r through the exported liftRadiusDoc law"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#draws a lift as one red ribbon while paint keeps its dual outline"
        status: pass
    human_judgment: true
    rationale: "UAT rows 6-7 compare the drawn ribbon with the live cursor footprint and drag/scale previews in the running app."
  - id: D4
    description: "Every visible Lift string reads Eraser while tool:'lift', identifiers, CSS classes and serialized values are untouched"
    requirement: ERASER-COPY
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts#ERASER-COPY: every visible label says Eraser while the identifiers survive"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts (TOOLS: Brush, Water, Pen, Eraser)"
        status: pass
    human_judgment: true
    rationale: "UAT row 8 loads an existing project with recorded tool:'lift' strokes and edits them live."

duration: ~30min
completed: 2026-10-29
status: complete
---

# Quick 261029-eur: Eraser stroke-editing rework Summary

**Derived Eraser Edit switch, pruned All | Eraser | Paint filtering with keep-open-on-empty Stroke Settings, a footprint-accurate red lift ribbon, and the Lift -> Eraser copy rename**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-10-29T10:20:00Z (approx.)
- **Completed:** 2026-10-29T10:49:38Z
- **Tasks:** 3
- **Files modified:** 21 (2 created, 19 modified)

## Accomplishments

- Replaced the one-shot "Select lifts" button with a derived Edit switch (`physics-lift-edit`, `role=switch`, label "Edit") in the Eraser cluster; ON = select mode AND filter `'lift'`, and its disabled gate rides the `watercolorMoveAvailable` signal read inside the leaf.
- Added the `aquarelleStrokeTypeFilter` signal with one compare-then-write setter that prunes the selection, an optional filter on the listing/hit-test, and a reset tied to the `setAquarelleSelectMode` choke point.
- Added the All | Eraser | Paint row to the Stroke Settings dialog, hid the Paint tab in Eraser mode with a Geometry fallback, and kept the sheet open on an empty water color selection with "Select a stroke to edit." while an explicit close wins until select mode exits and re-enters.
- Built `aquarelleLiftRibbon.ts`: a pure ribbon builder in the doc-pixel y-up frame whose radius comes from the SAME `liftRadiusDoc` the punch stamps with, a bounded revision-keyed cache, and a hit radius equal to the band's analytic maximum support (wide sides of aspect > 1 tips are clickable).
- Rewrote the overlay's lift branch to draw ONE red (`#ef4444`) 0.14-opacity nonzero-filled path with a single 2.5/3.5px edge, every vertex following the same transform and drag offset as the centerline; paint keeps its dual outline and bbox.
- Renamed every visible "Lift" string to "Eraser" (tool rail, tool row, shape picker aria-label, three eraser messages) while `tool: 'lift'`, the `lift` param key, `aquarelleLift*` identifiers, `AQUARELLE_LIFT_*` constants and the `physics-paint-topbar-lift*` CSS classes stay untouched.
- Display-only guarantee: the `roto/aquarelleLiftErase.ts` diff is exports plus `collectLiftDabs` delegating to them; `buildLiftCoverage`, `punchTransmittance*`, the bake and every `packages/efx-watercolor` file are unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Edit switch + stroke-type filter core** - `d7a8e819` (feat)
2. **Task 2: Lift ribbon builder + overlay lift branch** - `368ba84a` (feat)
3. **Task 3: Stroke Settings filter laws + Eraser copy rename** - `b9c04e39` (feat)

_No plan-metadata commit: the user required the docs artifacts to stay uncommitted._

## Verification

- Task 1 gate: 4 files / 405 tests passed; `pnpm --dir app run typecheck` clean.
- Task 2 gate: 5 files / 397 tests passed; typecheck clean.
- Task 3 gate: 6 files / 454 tests passed; typecheck clean.
- Full suite: `pnpm --dir app exec vitest run` -> 352 files passed, 2 skipped; 6283 tests passed, 1 skipped, 96 todo, zero failures. The production vite build inside the suite passes the 2 MB chunk ceiling.

## Files Created/Modified

- `view/aquarelleLiftRibbon.ts` - pure ribbon geometry, support law, revision-keyed cache and trim
- `view/aquarelleLiftRibbon.test.ts` - 8 pins: band width, single-point circle, aspect support, non-square mirror, determinism, cache, bounds, source purity
- `view/scriptStrokeEdition.ts` - `SelectableScriptStroke` gains `kind`, `ribbonPx`, `hitRadiusPx`
- `view/aquarelleStrokeSelection.ts` - filter signal, pruning setter, select-mode choke point, dismissal signal, lift listing and hit-test
- `roto/aquarelleLiftErase.ts` - exports `liftEngineSize` / `liftRadiusDoc`; `radiusAt` delegates (display-only)
- `engine/ScriptStrokeOverlay.tsx` - one red ribbon path per lift entry, badge tint, paint branch untouched
- `view/PhysicsPaintTopBar.tsx` - `LiftEditSwitch` leaf replaces the retired Select lifts action
- `view/PhysicsPaintStrokeSettingsDialog.tsx` - filter row, Paint-tab hide/fallback, empty state, module dismissal read
- `view/strokeSettingsModel.ts` - `keepOpenOnEmpty` law in the open args, saw-empty args and bundle contract
- `view/PhysicsPaintToolRail.tsx`, `view/AquarelleToolRow.tsx`, `view/LiftShapePicker.tsx` - copy-only Eraser rename
- `PhysicsPaintStudio.tsx` - bundle drops `closeMoveMode`, declares `keepOpenOnEmpty`, keeps the 2-arg `'all'` listing; eraser messages renamed
- `physicsPaintStudio.css` - Eraser cluster/top-bar chrome for the Edit switch
- Test files: `aquarelleStrokeSelection.test.ts`, `aquarelleLiftErase.test.ts`, `aquarelleLiftEraseContract.test.ts`, `PhysicsPaintTopBar.test.ts`, `strokeSettingsModel.test.ts`, `AquarelleToolRow.test.tsx`, `PhysicsPaintStudio.test.ts`

## Decisions Made

- Derived (never mirrored) Edit switch state, so the filter row and the switch can never disagree.
- Ribbon normals derived in the doc-pixel y-up frame; only the final polygon flips to canvas px (non-square mirror safety).
- Hit radius = band maximum support (analytic), which keeps the entire drawn border clickable for every tip aspect.
- Keep-open-on-empty is opt-in per bundle (`keepOpenOnEmpty`), falling back to the module law (watercolor keeps it open); brush keeps its old close-on-empty behavior.
- The Studio listing stays unfiltered so Stack positions and neighbours remain global.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The bundle contract needed the `keepOpenOnEmpty` member**
- **Found during:** Task 3 (typecheck of the Studio bundle)
- **Issue:** The plan asked the Studio to pass `keepOpenOnEmpty: true` on the bundle while also saying the bundle contract stays unchanged; TypeScript rejected the extra property.
- **Fix:** Added an optional `keepOpenOnEmpty?: boolean` to `StrokeSettingsDialogBundle` (documented); the dialog consumes it with a module-law fallback so existing brush bundles behave exactly as before.
- **Files modified:** `view/strokeSettingsModel.ts`, `view/PhysicsPaintStrokeSettingsDialog.tsx`
- **Verification:** targeted suite + typecheck pass; brush close-on-empty cases unchanged.
- **Committed in:** `b9c04e39` (Task 3 commit)

**2. [Rule 1 - Bug] Copy-law pin scanned comments**
- **Found during:** Task 3 (contract test run)
- **Issue:** The new ERASER-COPY pin flagged the historical comment that names the retired "Select lifts" button.
- **Fix:** The pin strips comments before the user-facing scan, keeping the strict label/aria law while allowing historical notes.
- **Files modified:** `roto/aquarelleLiftEraseContract.test.ts`
- **Verification:** contract suite passes (27 tests).
- **Committed in:** `b9c04e39` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both are minimal and additive; no scope creep, no behavior change outside the plan's intent.

## Issues Encountered

- Task 2 pin initially mismeasured the engine size for canonical 40 (`sizeToEngineScale` returns 1 in the 32–80 band, not 1.25); the probe offset was corrected instead of weakening the assertion.
- The ribbon module's header comment mentioned the forbidden `aquarelleFootprint` literal, tripping its own source pin; the wording changed, the pin stayed strict.

## Code review fixes

Applied after `261029-eur-REVIEW.md` (depth: quick, status `issues_found`). One commit per finding.

| Finding | Verdict | Commit | What changed |
|---|---|---|---|
| CR-01 (BLOCKER) | fixed | `8c4bc8e5` | Every forward/backward cap vertex is now built from the end station's own `supportHalfWidth` along its radial direction (`d = cos a·n + sin a·t`), same `CAP_SEGMENTS` sampling, same left → forward cap → right → backward cap order (angles 0 and π are the already-emitted band junctions). No constant-radius flare for aspect < 1 and no inward notch for aspect > 1; the drawn border and the max-support hit radius now share one law. |
| IN-01 | fixed (with CR-01) | `8c4bc8e5` | `supportHalfWidth` normalizes a non-finite / non-positive aspect to 1, exactly like `liftSupportFactor`. |
| IN-02 | fixed (with CR-01) | `8c4bc8e5` | The single-point branch sweeps the same support law all the way around instead of a constant-R circle (still a circle at aspect 1, bbox ±R pin kept). |
| WR-04 | fixed | `46e89868` | The containment oracle now passes `liftShapeForStroke(stroke)` to `collectLiftDabs` (real tip angle/mask), and a new pin per follow-rotation case (hake aspect 0.2, chalk aspect 2) asserts every cap vertex lies on its end station's own support curve and never escapes `hitRadiusPx`. Verified red against the pre-fix cap construction. |
| WR-02 | fixed | `3ac17ebf` | Deleted the dead, exported `selectAquarelleStrokeAt` — no production or test caller, and it hit-tested with the default `'all'` filter. The live selection path stays in the edition port. |
| WR-03 | fixed | `d1bcd63a` | `WatercolorBrushLibrary`'s card click calls `setAquarelleSelectMode(false)` before `selectAquarelleTip`, so a right-panel (or floating-modal) brush pick cannot strand Edit mode with its switch unmounted. Placed in the library because `aquarelleRecordState` importing the selection module would be circular. Regression test verified red without the fix. |
| IN-04 | fixed | `18c90365` | The Edit-switch test arms `aquarelleStrokeSettingsDismissed` before the off → on click and asserts the choke point clears it (and that the off click never re-arms it), replacing the vacuous assertion. |
| WR-01 | deliberately not fixed | — | Spec-mandated approximation: the requirement states previews must map the ribbon polygon with the same offset and transform as the centerline, and UAT row 6 names the move commit (a translation, where preview and commit agree exactly). `ScriptStrokeOverlay`'s lift branch and the commit path are untouched. |
| IN-03 | deliberately not fixed | — | Non-issue: a brush bundle never sets `keepOpenOnEmpty`, so `resolveStrokeSettingsOpen` still returns false at `selectionSize === 0` and the shell renders null before the empty state. |
| IN-05 | deliberately not fixed | — | Declared approximation: the 96-point cap is the shared polyline render cap, not a regression. |

Verification (main checkout; worktrees were disabled for this run, no isolated worktree was created):

- Targeted gate after every fix (4 files: `aquarelleLiftRibbon.test.ts`, `aquarelleStrokeSelection.test.ts`, `PhysicsPaintTopBar.test.ts`, `PhysicsPaintStudio.test.ts`) — 356 tests passed; plus `WatercolorBrushLibrary.test.ts` for WR-03.
- `pnpm --dir app run typecheck` — clean after every fix.
- Full suite `pnpm --dir app exec vitest run` — 352 files passed / 2 skipped; 6285 passed, 1 skipped, 96 todo, zero failures (2 new tests versus the pre-fix run: the cap-continuity pin and the brush-pick regression).

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- UAT APPROVED (2026-10-29, native live Studio). All 8 rows passed, plus two follow-up rounds requested during the pass (see "UAT rounds" below).
- No push was performed; the user owns remote operations.

## UAT rounds

### Round 1 — polish (5 changes)
1. **Filter row spacing** — `FILTER_ROW_STYLE` padding `8px 12px 0` → `8px 12px 10px` (10px under the buttons).
2. **Row order** — Paint first: `Paint | Eraser | All` (the selected pill moved; testids unchanged).
3. **Paint tab hides on a selected eraser stroke** — availability is now `filter !== 'lift' AND the selection contains no lift` (previously filter-only), with the same Geometry fallback.
4. **Quieter unselected ribbons** — fill `0.14 → 0.07`, edge `2.5px → 1.5px` when unselected; selecting restores `0.14 / 3.5px`. Paint outlines untouched.
5. **Close button fixed** — the header is the drag handle and its `pointerdown` captures the pointer plus `preventDefault`, which suppressed the close button's `click`. The button now stops the press (`onPointerDown` → `stopPropagation`) so Close and Escape dismiss again.

### Round 2 — close/entry law (2 changes)
6. **Closing the sheet leaves the surface** — the Studio bundle supplies `closeMoveMode` again (`toggleAquarelleSelectMode()`), so close (and Escape) exits select mode exactly like releasing Cmd or toggling the rail Select off; painting resumes with the active paint tool. `keepOpenOnEmpty` still only keeps the sheet up while the surface IS active. In Edit mode, closing flips the Edit switch off and lands back on the Eraser tool. The module `aquarelleStrokeSettingsDismissed` flag remains the fallback law for a bundle without `closeMoveMode`.
7. **Plain entries default to the Paint filter** — new `AQUARELLE_STROKE_FILTER_DEFAULT = 'paint'`; `setAquarelleSelectMode` starts AND returns there. The rail Select icon and the Cmd tap therefore open on Paint (eraser ribbons are not outlined unless Eraser is picked or Edit is on); the Edit switch still forces `'lift'`.

### UAT gates after both rounds
- Targeted suites 443 tests, full app suite 352 files / 6,288 tests passed, `pnpm --dir app run typecheck` clean, vite build 1,565.56 kB (under the 2 MB ceiling).
- Test updates: the row test now opens through the real entry path and asserts Paint is pressed; a "plain entry starts on Paint" case was added; exit/re-entry expectations moved from `'all'` to `'paint'`; the Studio pin now asserts `closeMoveMode` is present; a close-button `stopPropagation` case was added; the ribbon pins moved to the selected/unselected expressions.

## Self-Check: PASSED

- `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts` - FOUND
- `app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts` - FOUND
- `.planning/quick/261029-eur-rework-the-lift-ui-name-eraser-stroke-ed/261029-eur-SUMMARY.md` - FOUND
- Commit `d7a8e819` - FOUND (ancestor of HEAD)
- Commit `368ba84a` - FOUND (ancestor of HEAD)
- Commit `b9c04e39` - FOUND (ancestor of HEAD)
