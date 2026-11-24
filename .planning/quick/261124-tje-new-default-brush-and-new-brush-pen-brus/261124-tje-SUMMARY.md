---
phase: quick/261124-tje
plan: "01"
subsystem: studio-paint
tags: [brush-catalog, brush-defaults, landing-bag, medium-record, preact-signals, vitest]

# Dependency graph
requires:
  - phase: quick/261124-iq9
    provides: two-medium catalog (Watercolor + acrylic displayed as Gouache) and the two-section brush library
  - phase: quick 261122-gys
    provides: the identity law (a pick selects its group's medium) and the family-memory landing tips
provides:
  - Per-response landing bags on BRUSH_PRESETS (compile-time only; no serializer, no `.mce` field, no migration)
  - Gouache landing values (40 px, Pigment 100, Pickup 100, Dry 0, Feather 100) and the new Pen response (10 px, #373633, Pigment 100, Pickup 0, Dry 0, Feather 85)
  - applyAquarelleBrushDefaults + registerAquarelleBrushDefaultsColorSink in the store
  - Bag-last ordering at pickAquarelleBrush, the Brush-tool crossing/repair branch and the Medium dropdown
  - A one-shot fresh-session landing after the first positive working-height report
affects: [studio-paint, brush-library, brush-popovers, brushes-docker, medium-dropdown, top-bar]

# Actuals (#2632) — same estimateTokens scale as the plan estimate (chars/4 over the realized diff).
actuals:
  tokens: 15274
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-brush landing values live on the compile-time preset table (`defaults`), never in the store"
    - "Record-first / bag-last at every landing seam; the bag is a second compare-then-write spread"
    - "A colour-carrying bag writes through a registered sink (the lift-preview registration contract)"
    - "Px sizes convert through the ACTIVE response at application time so the landed value matches the visible slider"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleBrushDefaults.test.ts
  modified:
    - packages/efx-watercolor/src/playground/brushes.ts
    - packages/efx-watercolor/src/playground/brushes.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarellePaintControls.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/brushGroupMedium.test.ts
    - app/src/components/physic-paint/view/aquarelleToolFamily.test.ts
    - app/src/components/physic-paint/view/aquarellePaintControls.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
    - app/src/components/physic-paint/view/brushGroups.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts

key-decisions:
  - "Per-brush defaults are LIVE LANDING VALUES only: the bag rides the preset table as compile-time data, a stroke still persists only its response id"
  - "The bag stores sizePx and converts through aquarellePaintCanonicalFromPx at application time — a canonical 40 would have displayed ~259 px"
  - "The Pen appends AFTER Gouache in the acrylic group so the Brush family's landing brush stays bristle-round"
  - "isBristleResponse accepts pen: Pickup and Feather are bristle-only bindings and its crisp procedural tip needs no Engine edit"
  - "The brush bag reload is gated by the SAME condition as the medium repair — a staying Brush press whose label agrees writes nothing (MED-13)"
  - "Reset stays medium-record-driven and untouched; the next brush pick or a Studio (re)mount reloads a bag"

patterns-established:
  - "Landing-bag seam: table owns the numbers, the store applies them last, the Studio only registers the colour door"
  - "One-shot default landing keyed on a ref plus a positive working-height guard — no effect loops, no persisted preference"

requirements-completed: []

# Metrics
duration: ~7min
started: 2026-11-24T20:31:34Z
completed: 2026-11-24T20:38:58Z
status: complete

# Plan commit ledger (#3968) — measured, never narrated.
plan_head_before: 284b174e815d35aeb8685d6d98f4e691f1012ca3
plan_head_after: eb40c638d5dfbfb78c70efa18b08c8ef5d5bfca0
---

# Quick 261124-tje: New Default Brush and New Brush Pen Summary

**Gouache and the new Pen response each own a compile-time landing bag that lands last at every pick seam, and a fresh Studio opens on Gouache's values (40 px, Pigment 100, Pickup 100, Dry 0, Feather 100)**

## Performance

- **Duration:** ~7 min (ledger base → final task commit)
- **Started:** 2026-11-24T20:31:34Z
- **Completed:** 2026-11-24T20:38:58Z
- **Tasks:** 3/3
- **Files modified:** 13 (2 package sources, 3 app sources, 1 new suite, 7 retargeted suites)
- **Commits:** 6 measured from the ledger (RED + GREEN per task)

## TDD Cycle

- **Task 1** (`tdd="true"`): RED — the rewritten `brushes.test.ts` ran against the old table (12 ids, one bristle response, zero bags) and failed: 8 failures across the id list, classification, bristle predicate, link pins and the missing bags. GREEN — after `BrushDefaults`, the Pen entry and the extended predicate, the targeted suite passed 63/63 and the full package suite passed 1028 (8 skipped). REFACTOR — none needed.
- **Task 2** (`tdd="true"`): RED — the seven retargeted app suites ran before the store seam: 13 failures (bag counts 1 vs 2, record-vs-bag values, size ownership, the Pen row, dropdown writes). GREEN — after `applyAquarelleBrushDefaults`, the sink and the bag-last seams, the nine targeted suites passed 140 (3 skipped). REFACTOR — none needed.
- **Task 3** (`tdd="true"`): RED — the new suite failed 3/11 on the Studio rows only (no sink registration, no landing call, seam audit missing the Studio); the eight store rows passed against Task 2's code. GREEN — after the Studio effect pair, 11/11 passed and the Studio regression suite stayed 460/460. REFACTOR — one unused test constant removed (tsc TS6133), no behavior change.
- Plan-level (`type: execute`) `gsd_run check tdd-red-evidence` does not apply; per-task RED/GREEN evidence is recorded above and in the two commit pairs.

## Accomplishments

- `BRUSH_PRESETS` now carries a `defaults` bag (compile-time only, like `group`/`pressureLink`): Gouache = 40 px / load 100 / pickup 100 / dry 0 / feather 100; the new Pen = 10 px / #373633 / load 100 / pickup 0 / dry 0 / feather 85; every other preset has no bag.
- The Pen is appended after Gouache in the acrylic group: it lists in the Gouache section directly after Gouache, `firstBrushPresetForTool('brush')` stays `bristle-round`, and `isBristleResponse` is true for exactly `bristle-round` and `pen` — no Engine edit, the negative engine-source pin stays green.
- The store gained `applyAquarelleBrushDefaults` (ONE compare-then-write spread of `size`/`load`/`pickup`/`dry`/`feather`, total no-op for bagless/unknown ids, never `lift`, never a new key) and `registerAquarelleBrushDefaultsColorSink` (the lift-preview contract: last registration wins, a stale unregister clears nothing).
- The ordering law is enforced at all three seams — `pickAquarelleBrush`, the Brush-tool crossing/repair branch, `pickAquarelleMedium` — always record first, bag last; the staying-press MED-13 gate is the same condition, so an agreeing label still writes nothing.
- A fresh Studio lands the default brush's bag one-shot after the first positive working-height report, inside an effect pair that also registers `handleActiveColorChanged` as the colour sink and returns the unregister.
- Every retargeted pin keeps its intent: record-minus-bag ten-key checks, the medium's "never resizes / never moves lift" law re-proved with a medium-only call, and the Reset rows untouched.

## Task Commits

Each task was committed atomically (RED then GREEN):

1. **Task 1: Package preset table — defaults bag, Pen response, bristle predicate**
   - `6690efaea` (test) — RED: pin the per-brush landing bags and the Pen response
   - `252ea97b6` (feat) — GREEN: give Gouache and Pen their own landing bags
2. **Task 2: Store landing function + colour sink + bag-last ordering, app pins retargeted**
   - `27023f6bf` (test) — RED: pin the brush landing bag across the app seams
   - `d95173a27` (feat) — GREEN: land the brush bag last at every pick seam
3. **Task 3: Studio sink registration + fresh-session landing + new pin suite**
   - `f7cbeeab5` (test) — RED: pin the brush-bag colour sink and the fresh-session landing
   - `eb40c638d` (feat) — GREEN: register the colour sink and land a fresh Studio's bag

**Plan metadata:** none — the orchestrator commits the docs artifacts (`.planning` intentionally uncommitted).

## Files Created/Modified

- `packages/efx-watercolor/src/playground/brushes.ts` — `BrushDefaults` interface, `defaults` on `BrushPreset`, Gouache bag, the Pen entry, `isBristleResponse` accepts `pen`
- `packages/efx-watercolor/src/playground/brushes.test.ts` — thirteen-id catalog, Pen classification/links, bristle predicate rows, the bag describe block
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `applyAquarelleBrushDefaults`, the colour sink registration, bag-last calls in the Brush branch and `pickAquarelleMedium`
- `app/src/components/physic-paint/view/aquarellePaintControls.ts` — the unconditional bag call in `pickAquarelleBrush` and the tip → record → bag → commit doc contract
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the two imports, `brushDefaultsLandedRef`, the sink registration effect, the one-shot landing effect
- `app/src/components/physic-paint/view/aquarelleBrushDefaults.test.ts` — NEW: bag values, one-spread writes, sink lifecycle, no-op paths, order law, payload contract, Studio source shape
- Seven retargeted app suites — `brushGroupMedium`, `aquarelleToolFamily`, `aquarellePaintControls`, `AquarelleGlobalsPanel`, `aquarellePresetSelection`, `brushGroups`, `PhysicsPaintBrushMenu`

## Decisions Made

- Per-brush defaults are UI landing values from the compile-time table; nothing serializes them and recorded strokes are untouched (no schema push, no migration).
- The bag names `sizePx` and converts at application time; a canonical literal would have displayed the wrong visible size.
- Pen appends after Gouache so the Brush family's landing brush (and the Medium dropdown's acrylic landing) stays Gouache.
- Pen is a bristle response because Pickup/Feather are bristle-only bindings; extending the predicate is the whole Engine change surface.
- The bag reload shares the medium-repair gate, preserving the MED-13 no-wipe law for a staying Brush press.
- Reset remains medium-record-driven; a bag reloads on the next pick or a Studio (re)mount — documented, not a bug.

## Deviations from Plan

None — the plan executed as written.

## Issues Encountered

- The first app `tsc --noEmit` after Task 3's GREEN flagged one unused test constant (`BAG_KEYS`, TS6133) in the new suite; removed in the same GREEN commit before the final typecheck. No behavior change.
- No other issues; the package `dist` was rebuilt before the final app typecheck as required (app vitest aliases the package to source; app tsc resolves `dist/*.d.ts`).

## Known Stubs

None — no placeholder values, TODOs, skipped tests or unwired data sources were introduced.

## Threat Surface Scan

None — the diff introduces no network, auth, file-access or schema surface. Only compile-time literals reach the params bag, the colour sink forwards a hex literal to the existing compare-then-write setter, and the document format is unchanged.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Automated gates all green: package targeted suite (63) + full package suite (1028 passed, 8 skipped), package `run check`, package `run build` (rebuilt before the final app typecheck), the nine targeted app suites (140 passed, 3 skipped), the Studio regression suite (460 passed), the full app suite (467 files / 9874 passed, 4 skipped, 96 todo) and app `tsc --noEmit`; structural gates 13 `define({` / 2 `defaults: {`; untouched-surface audit clean for `mediums.ts`, `Engine.ts`, `brushBridge.ts`, `maskRegistry.ts`.
- **Eight live UAT rows stay PENDING (AUTOMATED-READY, artist-run):** (1) fresh Studio opens on Gouache with 40 px / Pigment 100 / Pickup 100 / Dry 0 / Feather 100 and paints with the same feel; (2) Pen lands 10 px / #373633 / 100 / 0 / 0 / 85 and draws a crisp fine line with no pickup; (3) picking Gouache back restores its five values (its bag names no colour); (4) twiddling sliders then re-picking the same brush reloads the bag; (5) Brush → Watercolor → Brush lands Gouache with its bag (Dry 0, Feather 100, 40 px), not the record's 70/85; (6) picking Gouache from the Medium dropdown lands Gouache with its bag; (7) Reset in the Gouache context restores the acrylic record (dry 70, feather 85) — documented behavior; (8) save/reopen keeps old strokes and raises no error (no migration).
- No `.planning` artifact was committed by the executor; ROADMAP.md untouched.

## Self-Check: PASSED

- `app/src/components/physic-paint/view/aquarelleBrushDefaults.test.ts` — FOUND
- `6690efaea` (Task 1 RED) — FOUND in HEAD history
- `252ea97b6` (Task 1 GREEN) — FOUND in HEAD history
- `27023f6bf` (Task 2 RED) — FOUND in HEAD history
- `d95173a27` (Task 2 GREEN) — FOUND in HEAD history
- `f7cbeeab5` (Task 3 RED) — FOUND in HEAD history
- `eb40c638d` (Task 3 GREEN) — FOUND in HEAD history
- Ledger: `git rev-list --count 284b174e8..HEAD` = 6
