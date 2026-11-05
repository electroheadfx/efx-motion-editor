---
phase: 58-rail-editing-regressions
plan: 03
subsystem: physics-paint view key-rail inspector and conversion entry
tags: [preact, physics-paint, key-rail, scripts-panel, inspector, double-click, workflow-strip, vitest, rail-editing]

# Dependency graph
requires:
  - phase: 58
    plan: 02
    provides: openKeyRailCycleEdit returning a Promise on every path and the 'key-rail-create' controller mode
  - phase: 52
    provides: the reveal railKind discriminator and the Standard rail classification
provides:
  - SelectedKeyRailInspectorPresentation and projectSelectedKeyRailInspector (facts-only, frozen, anchor-agnostic)
  - Scripts panel Selected Key Rail takeover with a guarded Edit Rail and Close, before the loop-clip branch
  - Key Rail double-click (220 ms) and Enter open intent with drag routing unchanged
  - PhysicsPaintWorkflowStrip.onOpenKeyRailCycleEdit forwarding
affects: [58-05, 58-verify-work, Studio Key Rail selection wiring]

actuals:
  tokens: 8796
  tasks: 2
  commits: 5
  plan_head_before: d2d1d80c9418033a57f291b48b22658bff9f200f
  plan_head_after: aa3aa0bcc804599a69fa215ede83ff4825a0e8e1
  commits_measured: 5

tech-stack:
  added: []
  patterns:
    - "Pure facts-only projection: the inspector derives labels from the segment and the caller-resolved set size, never from signals or the store"
    - "Timestamp-only double-click detector: the first click selects synchronously; no pending timer exists to cancel or defer selection"
    - "Takeover branch returns before the loop-clip branch so a plain rail selection can never be shadowed by a stale loop target"
    - "Guarded IconButton contract reused verbatim for the disabled Edit Rail (aria-disabled + sr-only reason + `unavailable:` tooltip)"

key-files:
  created:
    - .planning/phases/58-rail-editing-regressions/58-03-RED-EVIDENCE.json
    - .planning/phases/58-rail-editing-regressions/58-03-TASK2-RED-EVIDENCE.json
  modified:
    - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "projectSelectedKeyRailInspector is anchor-agnostic (D-03): it takes whatever segment the caller resolved plus the set size. A 2+ set shows that rail's own facts with editDisabledReason 'Select a single rail to edit it.'; no bulk conversion action exists at any set size."
  - "The Key Rail takeover uses `physics-paint-scripts-panel` without the loop-only `physics-paint-loop-clip-panel` modifier. That modifier's only declaration is `justify-content: flex-start` (the flex default), so visual parity is exact, and omitting it keeps four existing loop-inspector source anchors pointing at the loop branch (no CSS change is permitted)."
  - "The panel branches before `if (selectedLoopClip)` (D-01) and renders exactly Frames / Keys / Type (D-04) — the loop inspector's Name/Source/Placement/Cycle/Effective/Rail Type/Status facts never leak into the Key Rail surface."
  - "The double-click detector is timestamp-only (D-02): a plain click records event.timeStamp, modifier clicks reset it to null, and an open consumes the sequence. Selection stays synchronous, so existing click timing is untouched (no 250 ms single-click delay like the loop rail)."
  - "The open intent is gated on gesture 'plain', !isMoveMember, and !busy (T-58-06); the `onRailSetDragClickSuppressed` / `consumeClickSuppression` early returns and the pointer-down batch routing are byte-for-byte unchanged."
  - "Enter selects then opens the same entry; Space still plain-selects only and Escape still hides the tooltip. A move member or busy rail on Enter selects without opening."
  - "The strip forwards `onOpenKeyRailCycleEdit` beside `onOpenRotoLoopEdit`; drag dispatch is untouched. Studio wiring is plan 58-05."

requirements-completed: [RAIL-01, RAIL-03]

coverage:
  - id: D1
    description: "Selecting a Key Rail replaces the Scripts toolbar/list with the Selected Key Rail takeover: exactly Frames F10–F14, Keys 2, Type Standard, plus Edit Rail and Close (D-01/D-04)"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#replaces the Scripts surface with the Selected Key Rail takeover and exactly Frames, Keys, and Type"
        status: pass
    human_judgment: false
  - id: D2
    description: "The projection is frozen, facts-only, carries firstKeyId/keyIds/firstKeyFrame/lastKeyFrame for the controller handoff, and computes F{first}–F{last} / key count / Standard"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts#projects exactly the three facts plus the controller handoff fields for a single Rail"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 2+ rail set projects that rail's own facts with Edit Rail disabled and the exact reason 'Select a single rail to edit it.'; no bulk conversion action exists (D-03)"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts#disables Edit Rail with the locked reason for a multi-Rail set while keeping this Rail's own facts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts#is anchor-agnostic — any segment the caller resolves projects its own facts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#keeps Edit Rail visible but guarded with the multi-select reason and its description id"
        status: pass
    human_judgment: false
  - id: D4
    description: "Edit Rail fires onOpenKeyRailEdit with the segment firstKeyId; the prop stays (firstKeyId: string) => Promise<unknown> | void; Close fires onCloseKeyRail"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#fires onOpenKeyRailEdit with the segment first key id and onCloseKeyRail from the top actions"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#types the Edit Rail handoff so 58-05's always-Promise handler assigns cleanly"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#pins the branch order, the three fact rows, and the guarded Edit Rail contract in source"
        status: pass
    human_judgment: false
  - id: D5
    description: "A second plain click within 220 ms opens once while both clicks plain-select; later clicks, modifier resets, move members, busy rails, and consumed drag clicks never open"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#opens once on the second plain click inside the 220 ms window while selecting synchronously both times"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#never opens after the 220 ms window, and a later plain click starts a fresh sequence"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#resets the sequence on a modifier click so the next plain click is not a double-click"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#never opens on a move member, and the batch click suppression still wins unchanged"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#never opens while the rail is busy"
        status: pass
    human_judgment: false
  - id: D6
    description: "Enter selects then opens the same entry; Space plain-selects only; Escape hides the tooltip"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#supports Space selection, opens on Enter, and hides the tooltip on Escape"
        status: pass
    human_judgment: false
  - id: D7
    description: "The workflow strip forwards onOpenKeyRailCycleEdit to the Key Rail host without touching drag dispatch"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#forwards the Key Rail conversion open intent to the rail host (58-03 RAIL-01)"
        status: pass
    human_judgment: false
  - id: D8
    description: "In the live Studio, selecting a rail shows the inspector and double-click/Enter opens the conversion dialog"
    requirement: RAIL-01
    verification: []
    human_judgment: true
    rationale: "58-05 owns the Studio state wiring (selectedKeyRailInspector, the two handlers, right-panel and strip props); this plan ships the pure projection and component contracts. Live Studio confirmation belongs to phase UAT."

duration: 6 min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 03: Key Rail inspector and conversion entry summary

**Selecting a Key Rail takes over the Scripts pane with a frozen three-fact inspector and a guarded Edit Rail, while a second plain click within 220 ms or Enter opens the same conversion entry through the workflow strip — with drag routing untouched.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-03T12:07:45Z
- **Completed:** 2026-11-03T12:13:18Z
- **Tasks:** 2
- **Files modified:** 10 (4 production sources, 4 specs, 2 RED evidence records)
- **Commits:** 5 (measured from `d2d1d80c9..aa3aa0bcc`)

## Accomplishments

- `projectSelectedKeyRailInspector(segment, { setSize })` returns a frozen, facts-only projection: `framesLabel` `F10–F14` (en dash, both frame numbers), `keysLabel` `5`, `typeLabel` `Standard`, and `editDisabledReason` null for one rail or the locked `Select a single rail to edit it.` for a 2+ set. The projection carries `firstKeyId`, `keyIds`, `firstKeyFrame`, and `lastKeyFrame` for the 58-05 handoff and never decides the anchor itself.
- `PhysicsPaintScriptsPanel` gains a takeover branch before `if (selectedLoopClip)`: exactly Frames / Keys / Type rows, a labeled Edit Rail button that calls `void onOpenKeyRailEdit?.(firstKeyId)`, and a Close button that calls `onCloseKeyRail`. The disabled path routes through the existing guarded IconButton contract (aria-disabled, sr-only reason, `unavailable: {reason}` tooltip).
- `PhysicsPaintKeyRail` gains `ROTO_KEY_RAIL_FAST_DOUBLE_CLICK_MS = 220` and a timestamp-only detector: every click still plain-selects synchronously, a second plain click inside the window opens once, modifier clicks reset the sequence, and move members, busy rails, and consumed drag clicks never open. Enter selects then opens; Space and Escape are unchanged.
- `PhysicsPaintWorkflowStrip` forwards the new optional intent to the Key Rail host. Its pointer-down batch routing and drag dispatch are unchanged.
- 240 tests pass across the four specs (`11 + 61 + 17 + 151`) and `tsc --noEmit` is clean.

## TDD

- **Task 1 RED:** `test(58-03): add failing Selected Key Rail inspector spec` (`45ab0c004`). The named target test failed on its first planned assertion (`typeof projectSelectedKeyRailInspector === 'function'` received `undefined`); the three projection cases and five panel cases were all AssertionErrors with 64 existing tests still passing. Classifier verdict: `RED_EVIDENCE_OK` (`target_test_failed`). Evidence at `.planning/phases/58-rail-editing-regressions/58-03-RED-EVIDENCE.json`.
- **Task 1 GREEN:** `feat(58-03): render the Selected Key Rail inspector with Edit Rail` (`2f6175cfd`). 72/72 across the two specs; tracer feedback gate re-ran the planned verify end-to-end and passed before expansion. The first implementation rendered `F10–14` (a missing second `F`); the spec caught it before the commit and the format was corrected to `F10–F14`.
- **Task 2 RED:** `test(58-03): add failing Key Rail double-click and strip forwarding spec` (`1167b7a24`). The named target test failed on its planned open assertion (`expected spy to be called 1 time, got 0`) against the real RED code state; the Enter, window, modifier, and source-pin cases also failed, while the move-member and busy zero-open pins were intentionally born green. Classifier verdict: `RED_EVIDENCE_OK` (`target_test_failed`). Evidence at `.planning/phases/58-rail-editing-regressions/58-03-TASK2-RED-EVIDENCE.json`.
- **Task 2 GREEN:** `feat(58-03): open the Key Rail cycle entry on double-click and Enter` (`aa3aa0bcc`). 168/168 across the Key Rail launcher and strip specs.
- Gate order verified: each `test(58-03)` commit precedes its `feat(58-03)` commit. One `docs(58-03)` commit (`3319a1760`) sits between Task 1 GREEN and Task 2 RED; it re-records Task 1's evidence after the classifier rejected the first TAP capture (see Deviations).
- No REFACTOR commit was needed.

## Task Commits

1. **Task 1 RED: inspector spec** - `45ab0c004` (test)
2. **Task 1 GREEN: projection + panel takeover** - `2f6175cfd` (feat)
3. **Task 1 evidence re-capture** - `3319a1760` (docs)
4. **Task 2 RED: double-click / Enter / strip spec** - `1167b7a24` (test)
5. **Task 2 GREEN: detector + Enter + strip forwarding** - `aa3aa0bcc` (feat)

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` — added `KEY_RAIL_EDIT_DISABLED_REASON`, `SelectedKeyRailInspectorPresentation`, `ProjectSelectedKeyRailInspectorOptions`, and the pure `projectSelectedKeyRailInspector`.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — added the three optional props, `keyRailEditReasonId`, and the Selected Key Rail takeover branch before the loop-clip branch.
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` — added the 220 ms constant, the optional open prop on both interfaces, the timestamp detector in `handleClick`, the Enter branch in `handleKeyDown`, and prop forwarding in the segment map.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — added `onOpenKeyRailCycleEdit` to the props interface and forwarded it to `<PhysicsPaintKeyRail>`.
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts` — 3 projection cases plus a namespace-import accessor that keeps RED an assertion failure.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` — 5 takeover cases (render facts, handoff, guarded disable, branch order, prop types).
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx` — the updated Space/Enter/Escape test and 6 double-click/detector cases.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — the forwarding source pin.
- `.planning/phases/58-rail-editing-regressions/58-03-RED-EVIDENCE.json` / `58-03-TASK2-RED-EVIDENCE.json` — classifier-valid TAP records.

## Decisions Made

- The takeover reuses `physics-paint-scripts-panel` and intentionally omits the loop-only `physics-paint-loop-clip-panel` modifier: its only declaration is a default `justify-content: flex-start`, so visual parity is exact, and adding it would have retargeted four existing source-string anchors at the loop inspector. No CSS change was needed or made.
- The detector is timestamp-only. Unlike the loop rail (which defers selection behind a 250 ms single-click timer), the Key Rail selects immediately on every click, so existing selection timing is provably untouched.
- `elapsed` is computed from the previous timestamp before the ref is updated, and an open consumes the sequence so a third rapid click starts over rather than chaining opens.
- The Edit Rail prop stays `(firstKeyId: string) => Promise<unknown> | void`; the panel ignores the returned Promise with `void`, matching 58-05's always-Promise handler.
- The strip forwards the intent only; no Studio wiring, no `PhysicsPaintRightPanel.tsx` change, and no drag-dispatch change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the frames label to include both frame numbers**
- **Found during:** Task 1 GREEN verification (spec assertion)
- **Issue:** `framesLabel` rendered `F10–14` instead of the locked `F10–F14`.
- **Fix:** `F${firstKeyFrame}–F${lastKeyFrame}`; both projection cases then passed.
- **Files modified:** `physicsPaintKeyRailPresentation.ts`
- **Commit:** `2f6175cfd`

**2. [Test-side] Target interface pin corrected**
- **Found during:** Task 2 GREEN verification
- **Issue:** The source pin expected the literal signature twice, but the target interface follows the file's convention and reuses `PhysicsPaintKeyRailProps['onOpenKeyRailCycleEdit']`.
- **Fix:** The pin now asserts the literal public signature and the indexed target-interface declaration separately. No production behavior changed.
- **Files modified:** `PhysicsPaintKeyRail.test.tsx`
- **Commit:** `aa3aa0bcc`

**3. [Process] RED evidence re-captured for the classifier**
- **Found during:** `gsd_run check tdd-red-evidence`
- **Issue:** The first Task 1 and Task 2 full-suite TAP captures embedded source-dump assertion values as multi-line YAML scalars, which the TAP adapter rejects as `invalid_record`; Task 2's capture also failed for the same reason.
- **Fix:** Re-ran the named target suites with `--reporter=tap-flat -t <target>` (Task 1 against the committed RED presentation module) and rewrote both records. Both now classify `RED_EVIDENCE_OK` with `target_test_failed`. The full-suite failures are summarized in each record's `semanticAssessment`; no report was edited or fabricated.
- **Files modified:** the two RED evidence records
- **Commits:** `3319a1760`, `1167b7a24`

## Issues Encountered

- The panel's source-pin assertions dump the whole panel source when they fail, which produced the multi-line TAP diagnostic problem above. The re-capture avoids it by targeting the projection suite; future plans should prefer targeted RED runs when a source pin is part of the spec.
- A comment in the Key Rail branch originally contained the literal `physics-paint-loop-clip-panel`, which silently retargeted two existing loop-inspector source anchors. The comment was rephrased before the GREEN commit; the anchors are untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RAIL-01 entry surfaces are automated-ready: the projection, the panel takeover, the rail gestures, and the strip forwarding all pass their specs.
- 58-05 must still bind `selectedKeyRailInspector`, `onOpenKeyRailEdit` (to `rotoPlayScript.openKeyRailCycleEdit`), `onCloseKeyRail`, and the strip prop; the live Studio surface remains for phase UAT.
- No `.mce`, schema, store, parser, CSS, or Rust changes; `app/src/types`, `src-tauri`, and `PhysicsPaintRightPanel.tsx` are untouched.

## Self-Check: PASSED

All created/modified files exist on disk, and all five plan commits (`45ab0c004`, `2f6175cfd`, `3319a1760`, `1167b7a24`, `aa3aa0bcc`) are ancestors of HEAD. Full verification passed: 240/240 tests across the four specs, `tsc --noEmit` clean, and no changes under `app/src/types` or `src-tauri`.

---
*Phase: 58-rail-editing-regressions*
*Completed: 2026-11-03*
