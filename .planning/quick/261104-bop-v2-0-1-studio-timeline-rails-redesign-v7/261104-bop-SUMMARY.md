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
  commits: 5
  plan_head_before: 5e0230d4a66323e1489a8f41daa04dc710c9834c
  plan_head_after: 1bfbf2672

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
    description: "v7 geometry: 31px rows (30px layout + 1px between stacked tracks), 6px rail band, 4px radius-2 line at the row top, 16x22 radius-3 cells at an 18px pitch with 2px gaps and the 6px gutter"
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
    description: "Key/interp/cycle/empty cell matrix; the current/selected marker is a white border + white glow overlay, the interp dash and cycle circle turn white, and no orange fill is used"
    human_judgment: true
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#ordinary selection / cell matrix"
        status: pass
    rationale: "The cell matrix and ring rule are pinned in CSS; parity dot legibility is visual."
  - id: D5
    description: "Blue #2868FC playhead inside the 36px ruler band (never across the key rows), centred on the cell, with 10px normal-weight ruler labels"
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
        ref: "full vitest suite (368 files / 7181 passed)"
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
5. **Live UAT follow-up rounds** - `1bfbf2672` (fix): ghost keys, white marker, selected rail tint, playhead band, 31px rows, generated-frame paint gate, compact Cycle modal, parent override-records fix.

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

## UAT Rows (user-approved 2026-11-04)

| # | Row | Status |
|---|-----|--------|
| 1 | Surfaces read as the v7 dark card/rows/ruler/header set, with no per-row separators | passed |
| 2 | Rows as implemented (31px after the UAT +1px spacing round); 4px radius-2 rail line at the row top; 16x22 radius-3 cells at an 18px pitch with 2px gaps and the 6px content gutter | passed |
| 3 | The selected rail paints its light tint with the rail-colour glow, every other rail paints dim, and no selection shows an orange fill | passed |
| 4 | Key / interp / cycle / empty cells render the matrix; the current/selected marker is the white border + white glow overlay and the interp dash + cycle circle turn white; an empty current frame stays white (no rail green) | passed |
| 5 | The playhead is the blue #2868FC line inside the 36px ruler band (no line across the rows) with 10px normal-weight ruler labels | passed |
| 6 | The active header accent matches the selected rail type (#8A939C fallback) and shows the inert 14x14 minus slot; the Background header shows none | passed |
| 7 | Loop Clip rails paint their family colours in dim and bright palettes, with the 2px end inset, no white caps and no white anchor tick | passed |
| 8 | Every gesture (select, drag, resize, scrub, keyboard) and save/load behaves exactly as before | passed |
| 9 | Painting a generated in-between is refused with a +Key prompt; empty frames still promote; painting a rail repeat still records its phase override | passed |
| 10 | The Edit Rail / Key Rail Cycle modal is compact with numeric steppers, no progress bar, no Run-details info control and no duplicate header range | passed |
| 11 | The +Key / rail insert on a rail carrying painted overrides is accepted end-to-end (parent canonical re-check fixed) | passed |

### UAT follow-up rounds (2026-11-04)

The live pass found and fixed, in order:

1. **Ghost source keys** — group-owned clip source records outside every visible range painted as green keys with no rail and blocked +Key/+Rail. They now paint as empty and are excluded from the click map, drag eligibility and the "already has a key" reason.
2. **Persistent current/selected marker** — the marker is the dedicated white overlay plus the white cell border/glow; the interp dash and cycle circle turn white on a current/selected cell.
3. **Empty-frame marker** — an empty current frame uses the same white glow explicitly instead of borrowing the row rail's green.
4. **Removed decorative marks** — the blue interpolation-segment start cut and the white set-anchor tick are gone from every Paint rail; the playhead line is limited to the ruler band so it never crosses a key.
5. **Selected rail line** — a 35% white tint of the rail's own colour (`--rail-line-light`) over the bright rail-colour glow, replacing the pure-white line.
6. **One-key rail width** — `projectTimelineRailLineWidth` floors at the 16px cell width (not the 18px pitch), so a single-key rail ends on its key's right edge.
7. **Row spacing** — rows are 31px (30px layout + 1px between stacked tracks); strip height, cross-track hit-testing and header reorder pitch all use 31.
8. **Generated-frame paint gate** — a paint press on a generated in-between is consumed at the canvas-stack capture phase (no live stroke, no auto-key/override); the explicit +Key owns promotion.
9. **Cycle modal** — compact 420px surface, NumericStepper for the Cycle value, and the reduced footer/header omit the progress bar, the Run-details info control and the duplicate range text.
10. **Parent canonical rail insert** — the parent bridge now passes the current Group override records into the canonical resolver and trusts the proposal's `nextGroupOverrideRecords`, so inserts on painted rails are no longer rejected with "Painted Rail overrides cannot be retimed safely." The stale-document diagnostic now names the failing sub-check.
11. **Phase 58 G-02** — deleting a key inside an interpolated rail restores the legacy gap semantics (record survives, visible ranges lose the phase, no 1px contraction).

## Decisions (resolved by the 2026-11-04 UAT pass)

- Motion-minus default: the slot is inert and grey; whether it grows into the v2.1.0 motion-channel control is still open.
- 16x16 header chips are kept as-is.
- The current/selected cell marker is a WHITE border plus white glow overlay (keys, in-betweens and empty frames alike); the interp dash and cycle circle turn white on a current/selected cell. The earlier rail-colour inset ring was rejected.
- The selected rail line is a 35% white tint of its own colour (`--rail-line-light`), never white; the bright rail-colour glow stays.
- The anchor tick is removed from every Paint rail (white at the rail start read as stray decoration).
- The blue interpolation-segment start cut is removed from every cell.
- The playhead line is limited to the 36px ruler band; it never draws across the key rows.
- Rows are 31px (30px layout + 1px between stacked tracks); the header rows, strip height, cross-track hit-testing and reorder pitch all use 31.
- Background selected blue `#3F8FD0` replaces the former amber selected treatment.
- Accent fallback `#8A939C` when no rail is selected.
- The header accent follows the same selected-or-rail-set predicate as the bright rails.
- The 185px header and the selected rail's accent line are kept.
- No selected-rail outline — that is v2.1.0 scope.
- Rail palette pairs stay bright-first then dim; cycle-parity pairs are dim-first then selected. Both orders are specificity-safe, so this is defence-in-depth, not a corrected reference defect.
- Reveal `overrideColor` is superseded by the locked palette (the per-rail colour is no longer read).
- Drag-preview pills are 4px radius-2 pills with the family palettes; motion is the base rule.
- The motion slot is present on every Paint header and absent on the Background header.
- The blend-armed amber control state is kept.
- Generated in-betweens are render-only: a paint press is refused with a +Key prompt; empty frames still auto-promote.
- The reduced Cycle modal (Key Rail create / Standard Rail edit) omits the progress bar, the Run-details info control and the duplicate header range; the full Run Script surface keeps them.

## Known Stubs

None — every attributed cell/rail resolves from the closed palette and the store-backed presentation inputs; no placeholder data was introduced.

## Threat Surface

No new network endpoint, auth path, file-access pattern or schema boundary. The only new surface is closed-union design attributes and CSS custom properties (T-261104-01/02 mitigations hold: values come from the closed constant tables, no `innerHTML`).

## Next Phase Readiness

- The v7 design module is the single source future timeline work imports; motion channels (v2.1.0) can build on `TIMELINE_GEOMETRY` / `resolveTimelineRailType` without touching the stylesheet again.
- Live UAT rows 1–11 are user-approved (2026-11-04). Nothing in `.mce` persistence, gestures or the store layer changed.
- Final gate: `tsc --noEmit` clean, full suite 368 files / 7181 passed / 1 skipped / 96 todo.

## Self-Check: PASSED

- `app/src/components/physic-paint/view/timelineRailDesign.ts` — FOUND
- `app/src/components/physic-paint/view/timelineRailDesign.test.ts` — FOUND
- Commits `f924b46b2`, `7ccd0bdd7`, `829445ab0`, `ab0d1f9b2` — reachable from HEAD
- `pnpm --prefix app run typecheck` — clean
- `pnpm --prefix app exec vitest run` — 368 files / 7173 passed / 1 skipped

---
*Quick: 261104-bop*
*Completed: 2026-11-04*
