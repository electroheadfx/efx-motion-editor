---
phase: 61-vector-painting-tool
plan: 25
subsystem: ui
tags: [vector-path, watercolor, tool-rail, copywriting-contract, envelope-band, handle-markers, typography, wireframe, preact-signals, source-pins]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-21's shipped rubber-band and construction-view baseline the presentation corrections sit on"
  - phase: 61-vector-painting-tool
    provides: "61-22's extracted `AnchorWidthControl` — the single E4 mount this plan's readout span lands in — and its anchor-ring overlay baseline"
provides:
  - "`VECTOR_PEN_TOOLTIP` at module scope: the Copywriting Contract's Primary CTA string VERBATIM on the pen button's native tooltip"
  - "The Picker is DISARMED, not disabled, under wireframe: `disabled={railDisabled}` only, shipped title kept, session verdict unchanged"
  - "One envelope band law in both branches: fill = `color ?? SELECTED_SPINE_COLOR` at 0.14 selected / 0.07 unselected, edge 3.5 / 1.5, no `strokeOpacity`; `ENVELOPE_FILL_OPACITY` deleted"
  - "Handle dots solid `OWNED_CONTROL_COLOR` with no fill opacity and no stroke; only the 1px connector keeps `HANDLE_OPACITY`"
  - "The wireframe-only construction view keeps its bounds box and serial badge; the lift ribbon is unchanged"
  - "`ANCHOR_WIDTH_READOUT_STYLE` span for the `→ n px` readout; `fontWeight: 600` on the Anchor width caption and the Advanced wet note"
affects: [61-27, 61-28, 61-29, 61-30, 61-31]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 8108
  tasks: 3
  commits: 6

plan_head_before: b0c919e824ed09d7334e3c00a61cada547d2a9f7
plan_head_after: ef6f913ecd2dcc7023d02eff7b0b8c91744149e1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spec copy lives in a named module constant: a verbatim contract string cannot drift back inline"
    - "One declared band law for every envelope branch — the same colour expression, fill pair and edge pair, no branch-local opacity"
    - "Solid markers, translucent connectors: opacity belongs to the line, never to the dot"
    - "Presentation constants are pinned by source tests: each declared property is asserted by name, order and value"
    - "When a shipped region gate names one assertion that occurs N times, retarget all N consistently and keep every other assertion"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts

key-decisions:
  - "The pen tooltip is the contract string character-for-character in a module-scope constant — the phase's only teaching surface for the nonstandard draw law cannot drift inline again"
  - "The Picker's wireframe branch is removed from `disabled` rather than softened: picking is non-depositing, and every depositing control keeps its deactivation reason, so §5's 'disarmed' is honoured literally"
  - "Both envelope branches share ONE `envelopeColor = color ?? SELECTED_SPINE_COLOR` expression and the same 0.14/0.07 + 3.5/1.5 pair; `ENVELOPE_FILL_OPACITY` was deleted rather than retuned, and no `strokeOpacity` survives on either"
  - "Handle circles carry no opacity and no stroke at all; the connector line is the only translucent element, exactly as §6 item 5 draws it"
  - "The wireframe-only suppression was deleted outright (bounds rect gate, badge wrapper and the now-unused `wireframeOnly` binding) with comments rewritten to cite §6 item 6, so no stale comment describes the removed law"
  - "The readout is a declared span with exactly the four BrushResponsePanel properties, in declaration order; the empty branch still mounts nothing (`below` stays undefined)"
  - "The three identical E4 `not.toContain('style=')` assertions are retargeted together (Rule 3): leaving two behind would fail the plan's own mandated source change"

requirements-completed: [VEC-04, VEC-05]

coverage:
  - id: D1
    description: "The Vector pen button's native tooltip is the Copywriting Contract's Primary CTA string verbatim — all four draw rules in one sentence, held in a named module constant — while the accessible name stays `Vector pen`."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — 61-25 UI-01/UI-05 > teaches the whole draw law in the pen tooltip, character-for-character"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — 61-25 UI-01/UI-05 > retargeted shipped case: carries the approved label, title and button grammar"
        status: pass
    human_judgment: false
  - id: D2
    description: "Under wireframe the Picker is disarmed, not disabled: the button stays pressable with its shipped title, arms and reports its pressed verdict exactly as outside wireframe, while Dry, the paint row and Select keep their deactivation reasons and the pen stays available."
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — 61-25 UI-01/UI-05 > keeps the Picker pressable under wireframe with its shipped title and session verdict"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — 61-25 UI-01/UI-05 > still disables every depositing control under wireframe and leaves the pen available"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both envelope branches obey the declared band law in the stroke's own colour: fill 0.14 selected / 0.07 unselected, edge 3.5 / 1.5 with `non-scaling-stroke`, and no stroke opacity anywhere; the module no longer declares an envelope-fill-opacity constant."
    requirement: VEC-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-25 UI-03/UI-04 — the band, marker and chrome law > draws the editing envelope in the stroke’s own colour at 0.14/0.07, 3.5/1.5, with no stroke opacity"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-25 UI-03/UI-04 — the band, marker and chrome law > gives the wireframe envelope the same band law and keeps no envelope-fill constant"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every Bézier handle dot is solid `#f59e0b` — no fill opacity, no stroke — and only its 1px connector line carries the 0.6 opacity."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-25 UI-03/UI-04 — the band, marker and chrome law > draws every handle dot solid #f59e0b while only the connector is translucent"
        status: pass
    human_judgment: false
  - id: D5
    description: "The wireframe-only construction view keeps the existing transform box (bounds rect) and serial badge, and the lift ribbon is unchanged."
    requirement: VEC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-25 UI-03/UI-04 — the band, marker and chrome law > keeps the bounds box and serial badge in the wireframe-only view, and leaves the lift ribbon unchanged"
        status: pass
    human_judgment: false
  - id: D6
    description: "The anchor-width `→ n px` readout renders inside the declared 10px / 600 / secondary / tabular-nums span with the same template; the E4 region keeps exactly one declared style and no fixed width; the Anchor width caption and the Advanced wet note are weight 600, leaving the italic red Mixed as the file's only 400."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-25 UI-02/UI-05 — the declared readout and explanation weights > renders the readout inside the declared span and nothing beyond the four properties"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-25 UI-02/UI-05 — the declared readout and explanation weights > keeps exactly the one declared style in the E4 region, and still no fixed width"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-25 UI-02/UI-05 — the declared readout and explanation weights > sets both explanation strings at 600 — the italic red Mixed stays the only 400"
        status: pass
    human_judgment: false
  - id: D7
    description: "Native UAT: the pen tooltip lists all four rules; the width readout tracks Size x factor in the declared grammar; wireframe shows spines, envelopes, rungs, bounds box and serial badge together with a pressable Picker; vector envelopes and hand-painted bands read identically."
    verification: []
    human_judgment: true
    rationale: "Rows A–D are live WKWebView behaviours in the Studio window — native tooltip content, rendered type weight, and pixel-level band parity between a vector envelope and a hand-painted stroke. vitest renders no DOM and the user runs the app."

duration: 9 min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 25: the five UI-review warnings closed at the contract Summary

**The pen teaches its whole draw law verbatim, the Picker is disarmed rather than disabled under wireframe, both envelopes share one 0.14/0.07 band law with solid handle dots, the construction view keeps its bounds box and serial badge, and the width readout plus both explanations use the declared 10px/600 typography**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-11T11:32:59Z
- **Completed:** 2026-11-11T11:42:00Z
- **Tasks:** 3
- **Files modified:** 7 (plus per-task RED evidence under `.red-evidence/61-25-t1..t3/`)

## Accomplishments
- The Vector pen's native tooltip is now the Copywriting Contract's Primary CTA string VERBATIM, held in a module-scope `VECTOR_PEN_TOOLTIP` constant; `aria-label="Vector pen"` is unchanged. The Picker's wireframe condition left `disabled`, so the button is pressable with its shipped title under wireframe and every depositing control (paint row, Dry, Select) keeps its reason.
- `VectorPathOverlay` has ONE envelope law for both branches: `envelopeColor = color ?? SELECTED_SPINE_COLOR`, `fillOpacity` 0.14 selected / 0.07 unselected, `strokeWidth` 3.5 / 1.5, `vectorEffect="non-scaling-stroke"` and no `strokeOpacity`; `ENVELOPE_FILL_OPACITY` is deleted. Handle circles are solid `OWNED_CONTROL_COLOR` with no opacity or stroke; only the connector keeps `HANDLE_OPACITY`.
- `ScriptStrokeOverlay`'s wireframe-only suppression is gone: the bounds rect renders for every non-lift entry and the serial badge renders unconditionally, with the now-unused `wireframeOnly` binding deleted and every comment rewritten to cite §6 item 6. The lift ribbon is untouched.
- `PhysicsPaintStrokeSettingsDialog` declares `ANCHOR_WIDTH_READOUT_STYLE` (exactly 10px / 600 / secondary text / tabular figures) and renders the `→ {n} px` readout inside a `stroke-settings-anchor-width-readout` span; the empty branch still mounts nothing. `ANCHOR_WIDTH_CAPTION_STYLE` and `ADVANCED_WET_NOTE_STYLE` gained `fontWeight: 600`, and the italic red `Mixed` caption stays the file's only 400.
- Ten new pins (3 rail + 4 overlay + 3 dialog) plus the plan's documented gate retargets: two shipped rail pins and the three occurrences of the E4 region `not.toContain('style=')` assertion. Nothing was deleted or weakened.
- Presentation only: no behaviour, decision table, gate or signal read/write changed.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing pins for the pen tooltip and the wireframe picker** - `c06792869` (test)
2. **Task 1 GREEN: the whole draw law in the pen tooltip and the picker left available** - `48187c9b3` (feat)
3. **Task 2 RED: failing pins for the band, marker and construction-chrome law** - `beedfb88a` (test)
4. **Task 2 GREEN: the declared band, solid handle dots and construction-view chrome** - `94d944092` (feat)
5. **Task 3 RED: failing pins for the readout span and the 600-weight strings** - `e16dbf3c1` (test)
6. **Task 3 GREEN: the declared readout span and both explanations at 600** - `ef6f913ec` (feat)

**Plan metadata:** see the final `docs(61-25): complete ...` commit on this branch.

_Note: TDD plans produce RED then GREEN commits per task; no REFACTOR commit was needed._

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | `c06792869` | `48187c9b3` | — | Pass |
| 2 | `beedfb88a` | `94d944092` | — | Pass |
| 3 | `e16dbf3c1` | `ef6f913ec` | — | Pass |

RED evidence (JUnit report, record and run start) is under
`.planning/phases/61-vector-painting-tool/.red-evidence/61-25-t1/`, `61-25-t2/` and
`61-25-t3/`; all three records returned `RED_EVIDENCE_OK` from
`gsd_run check tdd-red-evidence`.

- Task 1 RED: 20 collected, 4 failed — the two new pins (pen verbatim tooltip, picker
  pressable under wireframe) plus the two retargeted shipped pins at the old title and old
  `disabled` gate. All 16 other rail tests still passed.
- Task 2 RED: 67 collected, 4 failed — all four new UI-03/UI-04 pins (both envelope
  branches, the solid markers, the construction chrome). All 63 shipped tests still passed.
- Task 3 RED: 40 collected, 6 failed — the three new pins plus the three retargeted E4
  region pins, which correctly could not find the declared span at HEAD. All 34 shipped
  tests still passed.
- Each task ran with the plan's floor met or exceeded: 20 ≥ 19 (rail), 67 ≥ 67 (overlay),
  40 ≥ 37 (dialog). Task 1 is the plan's `type="tracer"` slice; auto mode was inactive,
  `human_verify_mode` is `end-of-phase` and the verify is automated-only, so the verify was
  re-run end-to-end and execution continued with no checkpoint.

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — `VECTOR_PEN_TOOLTIP` module constant on the pen button; Picker `disabled={railDisabled}` with its shipped title and the §5 comment (+14/−5).
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` — two shipped pins retargeted (pen title, picker gate) and the `61-25 UI-01/UI-05` describe with 3 pins (+66/−4).
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` — `ENVELOPE_FILL_OPACITY` deleted; both envelope branches collapsed onto one colour expression and the 0.14/0.07 + 3.5/1.5 law; handle circles stripped of opacity and stroke; palette comments updated (+17/−26).
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` — bounds-rect gate reduced to the lift condition, serial-badge wrapper removed, `wireframeOnly` binding deleted, comments cite §6 item 6 (+11/−12).
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` — the `61-25 UI-03/UI-04` describe with 4 pins (+181).
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — `ANCHOR_WIDTH_READOUT_STYLE`, the declared readout span in `below`, and `fontWeight: 600` on the two explanation styles (+24/−2).
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` — three E4 region pins retargeted and the `61-25 UI-02/UI-05` describe with 3 pins (+73/−5).

## Decisions Made
- **The contract string is a named constant, not an inline literal.** One module-scope `VECTOR_PEN_TOOLTIP` is the only place the four draw rules live; the pin compares it character-for-character.
- **Disarm means pressable.** Removing the wireframe term from `disabled` (rather than adding a softer gate) is the literal §5 reading: picking is non-depositing, so no function the contract keeps may be removed while every depositing control keeps its stated reason.
- **One band law, one colour expression.** `envelopeColor` is computed once and reused by both branches; the old branch-local 0.12 fill and the 0.5 wireframe stroke opacity are gone, not retuned, so the editing and construction views cannot diverge again.
- **Opacity belongs to the connector.** The handle dot is solid `OWNED_CONTROL_COLOR` with no `fillOpacity`, `stroke` or `strokeWidth`; `HANDLE_OPACITY` stays on the `<line>` alone.
- **Delete the suppression, not just bypass it.** Removing `wireframeOnly` entirely (and its now-dead derivation) leaves no state that could re-suppress the chrome, and every comment was rewritten so none contradicts the code.
- **The readout is data-shaped.** A declared span with exactly four properties in declaration order is what the source pins can enforce; the template string inside it is unchanged, so the number still tracks Size × factor.
- **Retarget in lockstep.** The dialog's `not.toContain('style=')` gate occurs three times over the same region; all three moved to "exactly one `style=` and it is `ANCHOR_WIDTH_READOUT_STYLE`", keeping `not.toContain('width:')` and every other E4 assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retargeted all three occurrences of the dialog's E4 `style=` gate**
- **Found during:** Task 3 RED
- **Issue:** The plan's context note names one `not.toContain('style=')` assertion to replace, but the identical assertion over the same E4 region exists three times (`E4 overflow`, `61-19 no new surface`, `61-22 keeps every shipped E4 identifier`). Retargeting only the named one would leave two failing for the right reason but the wrong expectation.
- **Fix:** Applied the same replacement to all three — `countOf(block, 'style=')` is exactly 1 and the region contains `style={ANCHOR_WIDTH_READOUT_STYLE}` — with `not.toContain('width:')` and every other assertion preserved. A short comment records the 61-25 reason.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts`
- **Verification:** Dialog suite 40/40 at the Task 3 GREEN run; RED showed all three failing against HEAD before the span existed.
- **Committed in:** `e16dbf3c1` (Task 3 RED)

**2. [Rule 1 - Bug] Removed a dangling `)}` after unwrapping the serial badge**
- **Found during:** Task 2 GREEN
- **Issue:** Replacing the badge's `{wireframeOnly ? null : (` wrapper with a plain fragment left the old closing `)}` after `</>`, a JSX syntax error.
- **Fix:** Deleted the orphaned `)}` so the fragment closes directly inside its `<g>`.
- **Files modified:** `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`
- **Verification:** Overlay suite 67/67 at the Task 2 GREEN run; `tsc --noEmit` clean.
- **Committed in:** `94d944092` (Task 2 GREEN)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). Both were necessary to land the plan's own mandated changes; no shipped assertion was deleted, disabled or weakened and no behaviour changed.
**Impact on plan:** None beyond the plan's declared presentation scope.

## Issues Encountered
- The first Task 1 RED record was rejected (`INVALID_RED / Unsupported report format`) because its `output` field carried the console transcript. The record was rewritten with the JUnit XML itself as `output` (the checker parses `output` as the report); all three records then returned `RED_EVIDENCE_OK / target_test_failed`. The same format was used for t2 and t3 from the start.
- No other problems: each RED run failed only on its planned assertions, and every shipped test passed at every stage.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated gates: `PhysicsPaintToolRail.test.ts` → **20/20** pass (floor 19);
  `VectorPathOverlay.test.ts` → **67/67** pass (floor 67);
  `PhysicsPaintStrokeSettingsDialog.test.ts` → **40/40** pass (floor 37);
  combined three-suite run → **127/127** pass;
  `pnpm --filter efx-motion-editor exec tsc --noEmit` → exit 0.
- **Native UAT rows (user-judged, pending):**
  - **A.** Hover the vector pen: the tooltip lists all four rules (place a smooth anchor, Alt for a corner, Enter/double-click to finish, click the first anchor to finish there).
  - **B.** Select one vector stroke, open Edit path, grab an anchor: the width readout under the stepper is small, semibold and tabular; its number tracks Size × factor.
  - **C.** Turn wireframe on: every stroke's spine, envelope and rungs draw, AND the bounds box and serial badge are visible on top; the Picker button is pressable and samples a colour.
  - **D.** In the same view, compare a vector envelope with a hand-painted band: they read identically — same fill strength and same edge weight.
- **REQUIREMENTS.md note:** VEC-04 and VEC-05 are ready and marked complete from this plan; the shared-ID gate raised no blocker this run.
- Out of this plan's scope (unchanged, still deferred): the rubber band (61-21), the anchor ring and list-view width mount (61-22), the drag lifecycle (61-28), the paint re-bake (61-29) and the curve switch (61-30/61-31).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — FOUND
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` — FOUND
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` — FOUND
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` — FOUND
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` — FOUND
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — FOUND
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` — FOUND
- `61-25-SUMMARY.md` — FOUND
- RED evidence records 61-25-t1/t2/t3 — FOUND
- Commit `c06792869` — FOUND (ancestor of HEAD)
- Commit `48187c9b3` — FOUND (ancestor of HEAD)
- Commit `beedfb88a` — FOUND (ancestor of HEAD)
- Commit `94d944092` — FOUND (ancestor of HEAD)
- Commit `e16dbf3c1` — FOUND (ancestor of HEAD)
- Commit `ef6f913ec` — FOUND (ancestor of HEAD)
