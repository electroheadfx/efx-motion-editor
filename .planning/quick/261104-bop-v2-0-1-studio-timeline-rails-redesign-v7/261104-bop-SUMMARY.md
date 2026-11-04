---
phase: quick-261104-bop
plan: 261104-bop
subsystem: ui
tags: [physic-paint, studio, timeline, rails, css, preact, signals, design-tokens]

# Dependency graph
requires:
  - phase: "58"
    provides: Rail editing regressions plus the approved v7 timeline-rails design (SPECS/v2.0.1-timeline-rails)
provides:
  - timelineRailDesign.ts — pure palette/rail-type/cell-presentation/frame-ownership/accent/rail-width resolvers with unit coverage
  - v7 timeline stylesheet — dark surfaces, 6px rail band, 4px radius-2 rail line, 16x22 radius-3 cells at an 18px pitch, blue playhead
  - data-rail-type / data-rail-selected / data-cell-kind / data-cycle attribute wiring across the five presentation hosts
  - 2px rail-end inset applied through one shared width helper (Key Rail, Loop Clip, read-only row rails, drag previews)
  - active track header accent from the selected-or-rail-set rail type plus the inert motion-minus slot
affects: [v2.1.0-motion-channels, future timeline work, any rail CSS assertions]

actuals:
  tokens: 40868
  tasks: 3
  commits: 4
  plan_head_before: 5e0230d4a66323e1489a8f41daa04dc710c9834c
  plan_head_after: ab0d1f9b2e1ae9f2c15ae6b55df5d7bf154d7d07

tech-stack:
  added: []
  patterns:
    - "Design module as the single source: closed unions + palette constants + pure resolvers, imported by every presentation host"
    - "CSS custom-property palette keyed by data attributes (dim rules, then bright rules) instead of per-family selector forks"
    - "One rail-width helper (frames x pitch - 2 when the end is visible) shared by every rail geometry projection"

key-files:
  created:
    - app/src/components/physic-paint/view/timelineRailDesign.ts
    - app/src/components/physic-paint/view/timelineRailDesign.test.ts
  modified:
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
    - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts
    - app/src/components/physic-paint/view/physicsPaintRailFocus.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Rail palette pairs stay bright-first then dim (matching the reference); cycle-parity pairs are emitted dim-first then selected. Both orderings are specificity-safe (bright/selected 0,3,0-0,4,0 vs dim/unselected 0,2,0-0,3,0), so ordering is defence-in-depth, not a corrected reference defect."
  - "The header accent uses the same selected-or-rail-set predicate that paints rails bright, including rail-set members, so the accent can never disagree with the rail line."
  - "The motion slot is read as present on every Paint track header and absent on the Background header (the oracle's 'every header' row is interpreted as every Paint header)."
  - "Reveal per-rail overrideColor is intentionally superseded by the locked palette variables; it is recorded as an open decision, not a regression."
  - "Drag-preview pills were moved to the 4px radius-2 pill geometry with the family dim palette; motion is the base rule and static/standard/reveal key off classes the strip already emits."
  - "The Bg clip drag ghost moved from top 4px to top 0 so the white phantom overlays the moved rail line after the line itself moved to the row top."

patterns-established:
  - "Closed-unions design module -> data attributes -> CSS custom properties: no per-component colour literals remain on the rail surfaces."
  - "Retired design pins are re-valued (never deleted) and grouped-selector rules are retargeted with a comma-terminated selector prefix."

requirements-completed: []

coverage:
  - id: D1
    description: "v7 surfaces: dark card/rows/ruler/header/column-strip backgrounds with no per-row separators"
    human_judgment: true
    verification: []
    rationale: "Surface colours and separator absence are a visual judgment only live UAT can confirm."
  - id: D2
    description: "v7 geometry: 30px rows, 6px rail band, 4px radius-2 line at the row top, 16x22 radius-3 cells at an 18px pitch with 2px gaps and the 6px gutter"
    human_judgment: true
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/timelineRailDesign.test.ts#TIMELINE_GEOMETRY pins"
        status: pass
    rationale: "Constants are pinned but only the rendered timeline can confirm the visual rhythm."
  - id: D3
    description: "Selected rail bright, every other rail dim, no orange selection"
    human_judgment: true
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintRailFocus.test.ts#paints every rail family from the shared palette variable"
        status: pass
    rationale: "Palette variables are pinned; the perceived brightness delta needs a human eye."
  - id: D4
    description: "Key/interp/cycle/empty cell matrix with parity dot and the ring cursor instead of an orange fill"
    human_judgment: true
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#ordinary selection / cell matrix"
        status: pass
    rationale: "The cell matrix and ring rule are pinned in CSS; parity dot legibility is visual."
  - id: D5
    description: "Blue #2868FC playhead centred on the cell with 10px normal-weight ruler labels"
    human_judgment: true
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts#positions the bar with the 6px scroll-padding-inclusive cell-center offset"
        status: pass
    rationale: "Offset arithmetic is pinned; centring and label weight are visual."
  - id: D6
    description: "Header accent from the selected rail type with the #8A939C fallback and the inert 14x14 minus slot (none on Background)"
    human_judgment: true
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#mockup order"
        status: pass
    rationale: "Slot order and aria-hidden are pinned; the accent colour match against the rail needs live comparison."
  - id: D7
    description: "Loop Clip family colours in both palettes with the 2px end inset and no white caps"
    human_judgment: true
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx#geometry and palette pins"
        status: pass
    rationale: "Geometry and palette are pinned; the end-inset read and cap removal are visual."
  - id: D8
    description: "Gestures, stores, drag hooks and save/load unchanged"
    human_judgment: true
    verification:
      - kind: unit
        ref: "full vitest suite (368 files / 7173 passed)"
        status: pass
    rationale: "Regression suites are green, but the gesture feel and .mce save/load round trip need the user's live pass."

# Metrics
duration: 19min
completed: 2026-11-04
status: complete
---

# Quick 261104-bop: v2.0.1 Studio Timeline Rails Redesign v7 Summary

**The Studio timeline now paints the locked v7 rail design from one pure design module: dark surfaces, a 6px band with 4px pill rails, 16x22 cells at an 18px pitch, family palettes keyed by data attributes, and a blue playhead — with every retired design pin re-valued rather than deleted.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-11-04T08:05:00Z (approx)
- **Completed:** 2026-11-04T08:26:00Z (approx)
- **Tasks:** 3 of 3
- **Files modified:** 18 (2 created, 16 modified)

## Accomplishments

- `timelineRailDesign.ts` ports the oracle's design module verbatim: the four rail types, the dim/bright palettes, the cycle gray parity table, the key/interp/cycle/empty precedence cascade, frame ownership, the track accent, and the single `frames x pitch - 2` rail-width helper, covered by 30 unit tests.
- All five presentation hosts emit `data-rail-type`, `data-rail-selected`, `data-cell-kind` and `data-cycle`, and every rail geometry projection now goes through `projectTimelineRailLineWidth`, so the 2px end inset applies identically to the Key Rail, Loop Clip, read-only row rails and the Background clip.
- The header accent follows the same selected-or-rail-set predicate that paints rails bright, and every Paint header carries the new inert 14x14 motion-minus slot (none on Background).
- `physicsPaintStudio.css` is a replacement, not a layer: the retired orange/purple/cyan families, the white caps and the per-family focus forks are gone, and no build-up/append rule was left behind.
- The full gate is green: `tsc --noEmit` clean, `vitest run` 368 files passed / 7173 tests passed / 1 skipped / 96 todo.

## Task Commits

Each task was committed atomically (code/CSS/tests only):

1. **Task 1: Port the v7 rail design module and unit coverage** - `f924b46b2` (feat)
2. **Task 2: Emit design attributes, 2px rail end inset, header accent and motion slot** - `7ccd0bdd7` (feat)
3. **Task 3: Replace the timeline CSS and re-value the retired design pins** - `829445ab0` (feat)
4. **Missed pin: anchor tick geometry** - `ab0d1f9b2` (test)

**Plan metadata:** not committed by the executor (dispatch constraint — the orchestrator commits the docs artifacts in its Step 8).

_Measured from the plan ledger `5e0230d4a..ab0d1f9b2`: 4 commits, 18 files, +1499/-554._

## Files Created/Modified

- `app/src/components/physic-paint/view/timelineRailDesign.ts` — pure palette/rail-type/cell/ownership/accent/width resolvers.
- `app/src/components/physic-paint/view/timelineRailDesign.test.ts` — 30 tests over the resolver contract and token constants.
- `app/src/components/physic-paint/physicsPaintStudio.css` — v7 surfaces, palette-variable blocks, cell matrix, header accents, Background row/clip, drag-preview pills.
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` — shared width helper, `data-rail-type`/`data-rail-selected`, ghost attribute.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` — rail-type resolution, data attributes, removed the per-rail colour style.
- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` — end-visible width projection.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — per-cell presentation attributes, loop-frame rail-type map, read-only rail width, motion slot, `--track-accent`.
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` — forwards `selectedRailType` to both header call sites.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — active-lane cell presentation, selected-rail predicate, playhead 6px origin, ghost rail-kind classes, header wiring.
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` — motion-slot order and inertness pins.
- Rail suites and design pins: `PhysicsPaintKeyRail.test.tsx`, `PhysicsPaintLoopClipRail.test.tsx`, `PhysicsPaintTrackRow.test.tsx`, `PhysicsPaintWorkflowStrip.test.ts`, `PhysicsPaintWorkflowStrip.rulerSeek.test.ts`, `physicsPaintRailFocus.test.ts`, `PhysicsPaintStudio.test.ts`, `useRotoTimelineActions.test.ts`.

## Decisions Made

See `key-decisions` in the frontmatter. The substantive ones: specificity-safe palette ordering as defence-in-depth (rail pairs bright-first, cycle pairs dim-first; not a corrected reference defect), the accent sharing the rail-bright predicate, the motion slot on Paint headers only, the reveal `overrideColor` superseded by the locked palette, and the drag-preview pills adopting the 4px family palette.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missed pin in `useRotoTimelineActions.test.ts`**
- **Found during:** Task 3 full-suite verification.
- **Issue:** Two Group-spacing lifecycle fixtures still expected the pre-v7 rail widths (378 and 486) and failed against the new `frames x 18 - 2` projection (376 and 484). The plan's pin list did not name this file.
- **Fix:** Re-valued the two fixtures and recorded the inset arithmetic in a comment. No assertion was deleted.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`
- **Verification:** the suite runs 147/147 and the full suite is green.
- **Committed in:** `829445ab0` (Task 3 commit)

**2. [Rule 3 - Blocking] Missed pin in `PhysicsPaintStudio.test.ts` (anchor tick)**
- **Found during:** Task 3 close-out review of the plan's pin list.
- **Issue:** The plan enumerates the anchor tick pin, but the test sliced the CSS from the selector to end-of-file, so its `height: 8px` / `top: 4px` assertions silently matched later rules and never failed. The tick had already become `top: 0; height: 4px`.
- **Fix:** Scoped the slice to the rule's closing brace and re-valued the two geometry assertions to `top: 0` and `height: 4px`. Behaviour coverage was strengthened, not reduced.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** `PhysicsPaintStudio.test.ts` 336/336 pass.
- **Committed in:** `ab0d1f9b2`

**3. [Rule 2 - Missing critical coherence] Background clip drag ghost baseline**
- **Found during:** Task 3 CSS replacement.
- **Issue:** The Bg clip rail line and its resize markers moved to `top: 0`, but the white drag phantom still sat at `top: 4px`, so a dragged clip's ghost would hover 4px below the line it is moving.
- **Fix:** Moved `.physics-paint-bg-clip-rail-ghost` to `top: 0` so the phantom overlays the moved rail line. No test pinned the old value.
- **Files modified:** `app/src/components/physic-paint/physicsPaintStudio.css`
- **Verification:** the Bg clip rail suite is green; the visual overlay is a UAT row (row 8 covers gestures).
- **Committed in:** `829445ab0` (Task 3 commit)

### Deliberate plan interpretations (not defects)

- The oracle's "every header" motion slot is read as every **Paint** track header; the Background header renders none, matching the plan's amendment.
- The plan's "two atomic commits (code + docs)" instruction is overridden by the dispatch: only code/CSS/tests were committed here. `STATE.md`, `PLAN.md` and this SUMMARY are written but uncommitted for the orchestrator's Step 8.

---

**Total deviations:** 3 auto-fixed (2 missed pins, 1 coherence) plus 2 recorded interpretations.
**Impact on plan:** No scope creep. The two pin files were missed enumerations of the same design change, and the ghost baseline keeps the drag preview honest.

## Issues Encountered

- The hover rule for loop segments is a grouped selector, so a regex requiring `{` immediately after `.physics-paint-loop-clip-rail-segment` cannot match it. The assertion was retargeted to the grouped rule prefix (comma included) and now pins `filter: brightness(1.12)`.
- `#f59e0b` still exists legitimately (push anchor capsule), so retired-orange assertions target specific selectors rather than a global absence check.

## User Setup Required

None — no dependency, lockfile, Tauri configuration, CSP or `.mce` schema change.

## UAT Rows (all PENDING user evidence — none marked passed)

| # | Row | Status |
|---|-----|--------|
| 1 | Surfaces read as the v7 dark card/rows/ruler/header set, with no per-row separators | pending |
| 2 | 30px rows; 4px radius-2 rail line at the row top; 16x22 radius-3 cells at an 18px pitch with 2px gaps and the 6px content gutter | pending |
| 3 | The selected rail paints bright, every other rail paints dim, and no selection shows an orange fill | pending |
| 4 | Key / interp / cycle / empty cells render the matrix, cycle parity shows the dot, and the cursor is the inset ring plus brightness | pending |
| 5 | The playhead is a blue #2868FC line centred on the cell with 10px normal-weight ruler labels | pending |
| 6 | The active header accent matches the selected rail type (#8A939C fallback) and shows the inert 14x14 minus slot; the Background header shows none | pending |
| 7 | Loop Clip rails paint their family colours in dim and bright palettes, with the 2px end inset and no white caps | pending |
| 8 | Every gesture (select, drag, resize, scrub, keyboard) and save/load behaves exactly as before | pending |

## Open Decisions

- Motion-minus default: the slot is inert and grey; whether it grows into the v2.1.0 motion-channel control is open.
- 16x16 header chips are kept as-is.
- The cursor treatment is the inset ring plus `brightness(1.18)` (no fill).
- Background selected blue `#3F8FD0` replaces the former amber selected treatment.
- Accent fallback `#8A939C` when no rail is selected.
- The header accent follows the same selected-or-rail-set predicate as the bright rails.
- The 185px header and 30px accent rail are kept.
- No selected-rail outline — that is v2.1.0 scope.
- Rail palette pairs stay bright-first then dim; cycle-parity pairs are dim-first then selected. Both orders are specificity-safe, so this is defence-in-depth, not a corrected reference defect.
- The anchor tick is clamped to the 4px pill.
- Reveal `overrideColor` is superseded by the locked palette (the per-rail colour is no longer read).
- Drag-preview pills are 4px radius-2 pills with the family palettes; motion is the base rule.
- The motion slot is present on every Paint header and absent on the Background header.
- The blend-armed amber control state is kept.

## Known Stubs

None — every attributed cell/rail resolves from the closed palette and the store-backed presentation inputs; no placeholder data was introduced.

## Threat Surface

No new network endpoint, auth path, file-access pattern or schema boundary. The only new surface is closed-union design attributes and CSS custom properties (T-261104-01/02 mitigations hold: values come from the closed constant tables, no `innerHTML`).

## Next Phase Readiness

- The v7 design module is the single source future timeline work imports; motion channels (v2.1.0) can build on `TIMELINE_GEOMETRY` / `resolveTimelineRailType` without touching the stylesheet again.
- Blocker: live UAT rows 1–8 are the user's step. Nothing in `.mce` persistence, gestures or the store layer changed.

## Self-Check: PASSED

- `app/src/components/physic-paint/view/timelineRailDesign.ts` — FOUND
- `app/src/components/physic-paint/view/timelineRailDesign.test.ts` — FOUND
- Commits `f924b46b2`, `7ccd0bdd7`, `829445ab0`, `ab0d1f9b2` — reachable from HEAD
- `pnpm --prefix app run typecheck` — clean
- `pnpm --prefix app exec vitest run` — 368 files / 7173 passed / 1 skipped

---
*Quick: 261104-bop*
*Completed: 2026-11-04*
