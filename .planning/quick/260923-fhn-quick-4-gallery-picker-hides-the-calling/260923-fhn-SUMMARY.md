---
phase: quick-260923-fhn
plan: 260923-fhn
subsystem: physics-paint
tags: [physic-paint, modals, gallery-picker, visibility-gate, preact, view-seam]

requires:
  - phase: quick-260923-bcm
    provides: stable Studio Tools/paper-grain surface this quick's view-seam edit sits beside
provides:
  - "single derived pickerOpen gate at the PhysicsPaintStudioView render seam — parent modals (PlayScript, photo reference, script picker) render only while no gallery picker is open"
  - "four behavioural RED-first legs pinning parent-hidden-while-picker-open and restoration-on-close at the view seam"
affects: [physics-paint-studio-view, photo-reference-dialog, script-picker-dialog, play-script-dialog, background-asset-picker]

actuals:
  tokens: 2533
  tasks: 3
  commits: 2
  plan_head_before: 2a6b22c8cddf10e583611c903719643aa028dbc0

tech-stack:
  added: []
  patterns:
    - "derived local const pickerOpen = Boolean(backgroundPicker?.open || referencePicker?.open) — plain render-time derivation, no new signal, no render-body writes"
    - "conditional render gating (? : null) matching the view's existing style; opener booleans untouched so parents return with prior state"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
    - .planning/quick/260923-fhn-quick-4-gallery-picker-hides-the-calling/260923-fhn-RED-EVIDENCE.json
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Diagnosis verdict (planning-time, confirmed): modal visibility is coordinated by independent boolean signals, NOT a state machine — XState lives only in the stroke-finalization pilot and does not own this UI, so the root is not structural and no modal-stack machine is introduced."
  - "Gate is one derived local const at the view seam (pickerOpen), not a new signal — efx-preact-reactivity rule 6 (no render-body signal writes) satisfied by construction."
  - "Conditional-render gating (? : null) chosen over CSS hiding: matches the existing lines 340/342 style; unmounting the parent is acceptable because the photo-reference dialog already unmounts on open=false and PlayScript's focus-restore handles close; opener booleans (referenceDialogOpen, scriptPickerIntent, confirmationOpen) are never cleared at this seam."
  - "Picker overlay lines (backgroundPicker/referencePicker, ordering, z-index) untouched — visibility orchestration only; import confirm/cancel handlers and opener wiring untouched."

patterns-established:
  - "View-seam picker visibility gate: parents render iff !pickerOpen; adding a future gallery picker only requires extending the one pickerOpen derivation."

requirements-completed: []

coverage:
  - id: D1
    description: "Gallery picker hides the calling parent modals for the duration of import/selection and restores them on picker close, one level of nesting deep (view-seam gate)"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts — 4 legs (background-open, reference-open, both-open, closed restoration); RED 3 failed | 1 passed at f335be71, GREEN 4/4 at cfa928f2"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts — full suite 158/158 with only the :2046 exact-string pin updated to the gated expression"
        status: pass
      - kind: other
        ref: "gsd check tdd-red-evidence → RED_EVIDENCE_OK / target_test_failed (flattened-TAP adapter, 260923-bcm precedent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Native UAT (4 rows): photo-reference → gallery import hides parent and restores pick; Reveal → image-reference picker hides PlayScript; both parents open at once; cancel restores parents"
    verification: []
    human_judgment: true
    rationale: "Live WKWebView modal stacking and visual restoration are the reported defect surface; vitest's node environment cannot observe fixed z-70/72 overlays on a real canvas region. Native UAT is the user's — automated status only is claimed here."

# Metrics
duration: 10min
completed: 2026-09-23
status: complete
---

# Phase quick-260923-fhn: Quick 4 Summary

**Single `pickerOpen` render gate in PhysicsPaintStudioView hides all three parent modals (PlayScript, photo reference, script picker) while either gallery picker is open, restoring them with prior state on close — RED-first with machine-verified RED evidence.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-23T09:42:57Z
- **Completed:** 2026-09-23T09:52:33Z
- **Tasks:** 3
- **Files modified:** 2 (+1 created test, +1 evidence record)

## Accomplishments

- Diagnosed at planning time and confirmed at execution: visibility is independent boolean signals, not a machine — one derived `const pickerOpen = Boolean(backgroundPicker?.open || referencePicker?.open)` at the view seam gates the three parent render lines; no second orchestration style, no timing hacks, no opener/import wiring touched.
- RED-first: four behavioural legs written and committed (`f335be71`) before any production edit — 3 failed | 1 passed at base, each failure `expected 1 to be +0` (parent present while picker open), restoration control green in the same run.
- GREEN (`cfa928f2`): targeted suites 162/162, full suite 4229 passed / 0 failed (baseline 4225 + 4 new legs), `tsc --noEmit` clean; only the plan-predicted exact-string pin at `PhysicsPaintStudio.test.ts:2046` updated, all substring pins (:900, :1861, :1999) and picker-overlay ordering pins (:1423, :1541) untouched and passing.
- RED evidence machine-verified: `gsd check tdd-red-evidence` → **RED_EVIDENCE_OK / target_test_failed** via the flattened-leaf-TAP + node-summary adapter (bcm precedent), recorded in `260923-fhn-RED-EVIDENCE.json`.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — pin parent-modal visibility at the PhysicsPaintStudioView seam** - `f335be71` (test)
2. **Task 2: GREEN — derive pickerOpen and gate the three parent modal render lines** - `cfa928f2` (feat)
3. **Task 3: Full-suite regression sweep** - no changes needed (full suite + typecheck already green; no commit)

**Plan metadata:** `2a6b22c8` (plan head before execution) — orchestrator owns the docs commit.

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` - Four-leg node-harness behavioural pin: parents absent while background/reference/both pickers open; parents present when closed; picker overlay still present.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` - Derived `pickerOpen` const + `!pickerOpen` added to the PlayScript, photo-reference and script-picker render conditions. Overlay lines, ordering, CSS, handlers untouched.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Exact-string pin :2046 updated to `{referenceDialog && !pickerOpen ? ...}` (only that pin).
- `.planning/quick/.../260923-fhn-RED-EVIDENCE.json` - Persisted RED run (command, exit code, target test, expected/actual, flattened TAP output); classifier verdict RED_EVIDENCE_OK.

## Decisions Made

- Gate by conditional render (`? : null`), not CSS visibility — matches existing lines 340/342; parents unmount while the picker is open (safe: photo-reference already unmounts on `open=false`, PlayScript focus-restore handles close; opener booleans never cleared → prior state returns).
- Plain derived local const, not a new signal — no render-body signal writes (efx-preact-reactivity rule 6).
- No XState / no second orchestration style: the planning-time diagnosis (independent booleans, XState only in the finalization pilot) held at execution; the STOP-and-report structural clause did not trigger.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered

- **RED-evidence classifier vs vitest (resolved, tooling):** `gsd check tdd-red-evidence` parses node `--test` TAP summaries that vitest never emits (`zero_tests_discovered` on the raw default-reporter record). Resolved with the bcm leaf-line flatten adapter: re-ran the RED against the byte-identical pre-fix view from `f335be71` with `--reporter=tap`, flattened leaf lines, appended the derived `# tests/# pass/# fail` block — classifier then returned **RED_EVIDENCE_OK**. The original default-reporter RED run (captured at RED-commit time, before any production edit) is preserved at `/tmp/fhn-red.log`; raw nested TAP at `/tmp/fhn-red.tap`. The GREEN view was restored immediately (`git checkout --` on that one file; working tree clean).
- **Pre-fix reproduction after the feat commit:** the tap re-run executed post-`cfa928f2` history but against the pre-fix file content from `f335be71`; gate ordering (test commit before feat commit) is unaffected and documented in the evidence record.

## User Setup Required

None - no external service configuration required.

## Native UAT (user, pending)

Automated status only — 4 rows owed (do not treat as passed):

1. Photo-reference modal → gallery import → only gallery visible, photo-reference hidden → pick → photo-reference returns with the pick applied.
2. Apply Script Reveal → image-reference picker → PlayScript hidden while picker open → pick → parent returns with pick applied.
3. Both parent modals open at once → gallery import → neither parent visible during the pick → both return afterwards.
4. (regression) Cancelling a picker restores the parent modal(s) too.

## Next Phase Readiness

- Automated-ready for native UAT: full suite 4229 passed / 0 failed (1 skipped, 101 todo pre-existing), typecheck clean, diff confined to the 3 planned `app/src/**` files.
- No blockers. No stubs, no known deferred items from this quick.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
- FOUND: app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
- FOUND: f335be71 (RED pin)
- FOUND: cfa928f2 (GREEN gate)
- Classifier: RED_EVIDENCE_OK — the target visibility assertion was the one that went red at base (reason: target test was the breaking assertion; see the evidence record)

---
*Phase: quick-260923-fhn*
*Completed: 2026-09-23*
