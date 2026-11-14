---
phase: 261101-mvg-preview-stroke-size-switch-in-the-move-e
plan: 01
subsystem: physic-paint / watercolor stroke edition
tags: [preact, signals, watercolor, stroke-settings, footprint-band, tdd]

# Dependency graph
requires:
  - phase: 261024-mz5
    provides: the shared multi-stroke selection set and the script edition port used by Water color Select and Brush Move
  - phase: 261029-eur
    provides: the Lift (Eraser) ribbon law, hit radius and the support-band station/polygon machinery the band delegates to
  - phase: 261031-euf
    provides: the stroke-list display metadata (kind/tool/brushId/customResponse) carried unchanged by every entry
provides:
  - a session-only "Preview stroke size" switch in the Stroke settings header (list and settings views, default OFF)
  - one pure footprint-band module (aquarelleStrokeBand.ts) that draws paint strokes and delegates the Eraser
  - shared support-band station/polygon builders extracted from the 261029-eur ribbon (reused, not duplicated)
  - a bandFor member on the script stroke edition port and the switch-gated band path in the overlay leaf
affects: [Draft mode quick (reuses aquarelleStrokeBand), stroke settings sheet, script stroke overlay]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 17623
  tasks: 3
  commits: 4
  # MEASURED (#3968)
  plan_head_before: afa089860b11def47520c4b5dc9dcea7a1a2d6e5
  plan_head_after: f9009013f9cb92faf50cf213aa028bb8df6eb91e

tech-stack:
  added: []
  patterns:
    - "Pure geometry seam with a delegated legacy branch: one buildStrokeBand entry point, the Eraser branch handed to the untouched 261029-eur law"
    - "Session-only view preference signal read by leaf components only (dialog header + overlay), never the Studio render body"
    - "Lazy per-entry band resolution through the edition port, so the listing stays byte-identical across the toggle"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
    - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleLiftRibbon.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The paint band reuses the shared station/polygon builders extracted from aquarelleLiftRibbon instead of importing aquarelleFootprint, which carries mutable cachedBrush/lastShapedAngle state; this keeps the module pure and reusable for the next quick's Draft mode."
  - "The Eraser branch delegates to buildLiftRibbon/buildLiftRibbonCached by identity, so the 261029-eur geometry is never re-derived."
  - "The switch is a compare-then-write session signal in scriptStrokeEdition, never persisted and never undoable; setScriptSelectMode deliberately does not reset it."
  - "Pen bands are forced to aspect 1 regardless of a recorded non-round tip, matching the engine's isotropic ink dab."
  - "The listing never gains band geometry: bandFor is resolved lazily at draw time, so bounds, hit-test, stack metadata and the recorded script stay byte-identical across the toggle."

patterns-established:
  - "Footprint band reuse: one pure module, both stroke kinds, cache keyed by revision|width|height and trimmed to the current frame's live paint ids."
  - "Switch-gated draw branches: the overlay reads one narrow signal and swaps the SVG path; hit-test, bounds and the listing never change."
  - "Source-level purity pin: readFileSync + import regexes prove a geometry module has no Preact or mutable-state dependency."

requirements-completed: [QUICK-261101-MVG]

coverage:
  - id: D1
    description: "\"Preview stroke size\" switch in the Stroke settings header, reachable in BOTH list and settings views, default OFF, aria-pressed, session-only"
    requirement: QUICK-261101-MVG
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#261101-mvg \"Preview stroke size\" switch"
        status: pass
    human_judgment: true
    rationale: "Header placement, the Spline glyph and the blue On chrome are visual; a live UAT pass confirms the sheet looks right and the control is reachable in both views."
  - id: D2
    description: "With the switch ON paint strokes draw their bake footprint band (declared size, tip aspect, per-point pressure, water x1.3, pen aspect 1) while the Eraser keeps the unchanged 261029-eur red ribbon"
    requirement: QUICK-261101-MVG
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts#drift, pressure, water, pen and lift-delegation cases"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#261101-mvg preview stroke size band"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#draws the size band for paint and the red ribbon for a lift only while the preview switch is on"
        status: pass
    human_judgment: true
    rationale: "The drawn area is visual: only a live look can confirm the band matches the brush's real coverage and the Eraser reads as before."
  - id: D3
    description: "With the switch OFF (default, Eraser included) no bold surface is drawn: paint keeps its thin centerline and the Eraser draws that same centerline instead of its ribbon"
    requirement: QUICK-261101-MVG
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#draws the size band for paint and the red ribbon for a lift only while the preview switch is on"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#resolves no band for either kind while the switch is off"
        status: pass
    human_judgment: true
    rationale: "The OFF look (thin centerline on both kinds, selected cyan / unselected dual outline) is a visible surface; live UAT owns it."
  - id: D4
    description: "Selection, hit-test, bounds, stack positions, serial, ribbon/hit-radius fields and the stroke revision are identical with the switch ON and OFF"
    requirement: QUICK-261101-MVG
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#leaves the listed entries byte-identical across the toggle"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#hit-tests the same stroke in both states"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#never bumps the stroke revision"
        status: pass
    human_judgment: false
  - id: D5
    description: "Band geometry lives in ONE pure, Preact-free, signal-free module with bounded caches, decimated stations, a zero-station guard and no NaN vertices"
    requirement: QUICK-261101-MVG
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts#purity, cache, trim, vertex-budget, zero-station and non-finite cases"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts#261029-eur ONE footprint law pins"
        status: pass
    human_judgment: false
  - id: D6
    description: "Drag ghosts and transform previews move the band exactly like the existing ribbon/centerline (every vertex through applyScriptStrokeTransform plus offsetX/offsetY)"
    requirement: QUICK-261101-MVG
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#band path slice asserts applyScriptStrokeTransform + offsetX/offsetY"
        status: pass
    human_judgment: true
    rationale: "Following a live drag and handle gesture is a motion judgement; the source pin proves the mapping, the user confirms it on screen."

# Metrics
duration: 40 min
started: "2026-11-01T15:27:37Z"
completed: "2026-11-01T16:07:00Z"
tasks_completed: 3
files_changed: 12
status: complete
---

# Quick 261101-mvg: Preview stroke size switch Summary

**A session-only "Preview stroke size" switch in the Stroke settings header turns every listed stroke into the area it actually covers — a paint footprint band from the bake law (size, tip aspect, per-point pressure, water x1.3, pen aspect 1) with the 261029-eur Eraser ribbon delegated unchanged — while OFF (the default, Eraser included) keeps today's thin centerlines and leaves listing, hit-test, bounds and the document byte-identical.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-11-01T15:27:37Z
- **Completed:** 2026-11-01T16:07:00Z
- **Tasks:** 3
- **Files modified:** 12 (2 created, 10 modified)
- **Commits:** 4 (measured: `git rev-list --count afa089860..HEAD`)

## Accomplishments

- One pure footprint-band module (`aquarelleStrokeBand.ts`) serves paint strokes from the engine's own bake law and delegates the Eraser to the existing `buildLiftRibbon`, so no second eraser geometry exists.
- The support-band station/polygon machinery was extracted from `aquarelleLiftRibbon.ts` into exported, stroke-agnostic builders; the 261029-eur suite passes unchanged and the lift behaviour is identical.
- A compare-then-write `strokeSizePreview` signal joins `scriptStrokeEdition`, plus an optional `bandFor` on the edition port; the watercolor port resolves bands lazily and trims its cache from the listing.
- The overlay leaf draws the band only while the switch is on: paint gets `stroke-size-band`, the Eraser keeps `stroke-lift-ribbon`, and both pass through the same drag/transform mapping as the old paths.
- The header switch sits above the list/settings view gate (reachable in both views), carries `aria-pressed` and the Spline glyph, and wears the audio-preview blue for its On state.
- All Task 3 pins are green: 7 suites / 599 tests pass and `tsc --noEmit` is clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: One footprint band for both stroke kinds** — `108ffdabe` (feat)
2. **Task 2: The session switch and the gated band in the drawing leaf** — `634a93f89` (feat)
3. **Task 3: The header switch and the switch-gated behaviour pins** — `0ce7c120f` (feat)
4. **Task 3 follow-up: plan-exact switch title** — `f9009013f` (fix)

**Plan metadata:** left uncommitted for the orchestrator's docs commit (SUMMARY.md / STATE.md / PLAN.md), per the execution constraints.

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` — the ONE pure band entry point: tip resolution, paint radius law, station/polygon assembly, revision-keyed cache and trim.
- `app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts` — 21 pins: lift delegation, pressure/water/pen laws, footprint drift, non-square frames, decimation budget, non-finite and zero-station safety, cache laws and the purity pin.
- `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts` — exported `SupportBandStation`, `buildSupportBandStations`, `buildSupportBandPolygon`; `buildLiftRibbon` now composes them with its own radius.
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — `strokeSizePreview` + compare-then-write setter, and the display-only `bandFor` port member.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — `resolveAquarelleStrokeBandPx`, `bandFor` wiring and paint-id cache trimming.
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` — switch-gated band path with the drag/transform mapping; Eraser keeps its ribbon channel.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — the header switch (Spline icon, aria-pressed, drag-safe press, `.peek()` toggle).
- `app/src/components/physic-paint/physicsPaintStudio.css` — the switch's `aria-pressed='true'` blue and hover state.
- `app/src/components/physic-paint/view/scriptStrokeEdition.test.ts` — setter idempotence and select-mode-teardown survival.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` — hoisted `distanceToPolyline` plus the band-resolver invariance block.
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` — header switch behaviour, chrome and the brush-bundle absence.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — the rewritten overlay pin (band for paint, ribbon for lift, only while on).

## Decisions Made

- Reused the shared station/polygon builders rather than `aquarelleFootprintFor` (mutable `cachedBrush`/`lastShapedAngle` state would break purity and Draft-mode reuse).
- Delegated the Eraser branch by identity instead of re-deriving the ribbon; the 261029-eur law and its pins are untouched.
- Kept band resolution lazy through the port so the listing cannot change shape when the view preference flips.
- Forced pen bands to aspect 1 to mirror the engine's isotropic ink dab.
- Followed the plan's exact title wording in a dedicated follow-up commit rather than amending the task commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the rounded-rect band expectation in the new test**
- **Found during:** Task 1 (footprint band module)
- **Issue:** The new test assumed a rounded-rect tip's across-extent equals its radius `R`; the cap sweep of `R(|cos| + a|sin|)` peaks near `0.78R` for aspect 0.5, so the assertion failed.
- **Fix:** Bounded the measurement by `hypot(1, aspect) * R` and kept a lower bound, proving the rounded-rect branch without asserting the wrong constant.
- **Files modified:** `app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts`
- **Verification:** `aquarelleStrokeBand.test.ts` 21/21 pass; the pre-existing `aquarelleLiftRibbon.test.ts` suite stays green.
- **Committed in:** `108ffdabe`

**2. [Rule 1 - Bug] Removed a dead import left from the plan's reuse hint**
- **Found during:** Task 1 (footprint band module)
- **Issue:** `LIFT_ROUNDED_ASPECT` was imported and voided because the plan mentioned it, but the rounded branch lives in the shared polygon builder, so the import was dead code.
- **Fix:** Dropped the import and the `void` line.
- **Files modified:** `app/src/components/physic-paint/view/aquarelleStrokeBand.ts`
- **Verification:** typecheck and the band suite pass; no behavior change.
- **Committed in:** `108ffdabe`

**3. [Rule 1 - Bug] Plan-exact title after the task commit**
- **Found during:** Task 3 close-out
- **Issue:** The committed button used two state-dependent titles; the plan specifies one static title string.
- **Fix:** Replaced it with the planned wording in a separate commit (no amend, per the commit protocol).
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`
- **Verification:** the dialog suite (131 tests) and the full 7-suite gate pass; typecheck clean.
- **Committed in:** `f9009013f`

---

**Total deviations:** 3 auto-fixed (3 bugs/cleanups, no architectural change)
**Impact on plan:** No scope change. All fixes were inside the plan's files and kept the plan's contracts intact.

## Issues Encountered

- `toEngineParams(...).size` is typed optional; the new paint-radius pin needed a non-null assertion after the value is known finite (caught by `tsc --noEmit`, fixed in `0ce7c120f`).
- Vitest collects only `.test.ts`, never `.test.tsx`; every pin lives in a `.test.ts` file.
- zsh glob expansion bit once while inspecting the vendor bundle; worked around with quoted globs and `node -e` reads (no repo change).

## User Setup Required

None - no external service configuration, no dependency change, no schema or persistence change.

## Known Stubs

None.

## Threat Flags

None - no new security-relevant surface beyond the plan's threat model. The switch is session-only UI state (no payload, no persistence, no undo entry), the band is display-only (never a hit-test or bounds input), and all emitted vertices pass the shared finite guards.

## Next Phase Readiness

- The band module is ready for the next quick's Draft mode: `buildStrokeBand` / `buildStrokeBandCached` take a recorded stroke and a canvas size, with no Preact, signal or component import (pinned by the purity test).
- Live UAT remains with the user: OFF default on both kinds, ON widening every listed stroke, the Eraser ribbon unchanged, drag/transform following, and the settings-view presence. Not claimed done before those pass.
- No persisted format, schema or engine/bake input changed.

---
*Quick: 261101-mvg-preview-stroke-size-switch-in-the-move-e*
*Completed: 2026-11-01*

## Self-Check: PASSED

- Files verified: `aquarelleStrokeBand.ts`, `aquarelleStrokeBand.test.ts` and this SUMMARY exist.
- Commits verified: `108ffdabe`, `634a93f89`, `0ce7c120f`, `f9009013f` are ancestors of HEAD.
- Gate: 7 targeted suites / 599 tests pass, `tsc --noEmit` clean.
