---
phase: quick-261105-cgl
plan: "01"
subsystem: ui
tags: [preact, signals, studio, watercolor, canvas-zoom, popover, host-tool, vitest]

# Dependency graph
requires: []
provides:
  - Push-mode toggle relocated from the bottom action row into the Tools popover
  - Frame readout popup with Frame/Seconds go-to, NumericStepper and fps-aware clamping
  - Session-only Hand host tool for primary-drag panning (rail button, grab cursor, release disarms)
affects: [physics-paint studio, canvas zoom viewport, watercolor tool rail]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 15522
  tasks: 3
  commits: 4
  plan_head_before: 98a016fd87f72d26e383d3b85fc62aa26755a81e
  plan_head_after: 7d4beafac356869b7478f46481680d841d55c50c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host tool pattern: session-only signal outside AquarelleTool; never writes the paint tool, Select mode or the picker"
    - "Popover reuse: optional panelId/className keep the Tools popover and the new frame popup on one shell"
    - "Draft-then-commit NumericStepper popover seeded from the live playback frame"

key-files:
  created:
    - app/src/components/physic-paint/view/physicsPaintFrameGoto.ts
    - app/src/components/physic-paint/view/physicsPaintFrameGoto.test.ts
    - app/src/components/physic-paint/view/physicsPaintHandTool.ts
    - app/src/components/physic-paint/view/physicsPaintHandTool.test.ts
    - app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Push mode is a Tools-popover section; the bottom action row no longer renders it, and every action-row click still disarms push first"
  - "Frame go-to opens from the frame readout, defaults to Frame mode, seeds from the live playback tick while playing, and commits on NumericStepper change"
  - "Seconds mode delegates to audioGain framesToSeconds/secondsToFrames with max(1, fps); non-finite values resolve to null so no seek is issued"
  - "Hand is a HOST tool mirroring the picker: disarming is literally back to the previous paint tool, which was never touched"
  - "Hand consumes the primary button in capture phase only when the sheet overflows; with no overflow it stands down without preventDefault/stopPropagation and self-heals by disarming"
  - "No keyboard binding for the Hand; the button is disabled at Fit"

patterns-established:
  - "Popover props may carry panelId/className so one shell backs multiple independent popovers"
  - "A capture-phase drag consumer always denials in a no-op branch without swallowing the event"

requirements-completed: []

# Coverage metadata (#1602) — all six deliverables need live human UAT.
coverage:
  - id: D1
    description: "Push mode is gone from the bottom action row and present in the Tools popover with its icon and label"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#action row no longer renders Push; Tools popover pins the Push section"
        status: pass
    human_judgment: true
    rationale: "Placement and visual/behavioral fit in the live Tools popover need a human."
  - id: D2
    description: "The frame readout opens the popup, defaults to Frame, and seeks on a frame number"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintFrameGoto.test.ts#rounding, clamping and resolution"
        status: pass
    human_judgment: true
    rationale: "Live seek behavior from the popup must be judged against the running timeline."
  - id: D3
    description: "Seconds mode shows the same position in seconds and seeks on a seconds entry"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintFrameGoto.test.ts#seconds conversion at 12fps and roundtrip"
        status: pass
    human_judgment: true
    rationale: "Conversion display and live seek must match the running project fps on screen."
  - id: D4
    description: "The Hand button is greyed at Fit and enabled when zoomed past Fit"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#rail disabled at Fit"
        status: pass
    human_judgment: true
    rationale: "The enabled/greyed transition is a live visual state."
  - id: D5
    description: "Hand drag pans in all directions and release returns to the previous paint tool with the next stroke painting normally"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandTool.test.ts#host-tool isolation; physicsPaintHandToolWiring.test.ts#viewport capture and release"
        status: pass
    human_judgment: true
    rationale: "Pan feel and the post-release painting behavior are live interaction judgments."
  - id: D6
    description: "Middle-drag, wheel/pinch zoom, and painting at 1:1 are unchanged after a hand pan"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.test.ts"
        status: pass
    human_judgment: true
    rationale: "Regression of existing gestures can only be confirmed live."

# Metrics
duration: 16min
completed: 2026-11-05
status: complete
---

# Quick 261105-cgl: Small Studio add-ons Summary

**Push mode moved into the Tools popover, a Frame/Seconds go-to popup on the frame readout, and a session-only Hand host tool for primary-drag canvas panning**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-05T07:58:09Z
- **Completed:** 2026-11-05T08:14:08Z
- **Tasks:** 3
- **Files modified:** 11 (5 created, 6 modified)

## Accomplishments

- The Push mode toggle now lives in a labelled `Push` section of the Tools popover; the bottom action row no longer renders it, and clicking any action-row button still disarms push first.
- Clicking the current-frame readout opens a popover with Frame/Seconds modes backed by the shared `NumericStepper`; it seeds from the live playback frame while playing and seeks through the existing synced-frame navigation.
- The Hand rail button pans the canvas with a primary-button drag through the existing zoom-store pan path, shows a grab cursor when armed, is greyed at Fit, and disarms on release so the untouched previous paint tool resumes.
- Frame/seconds conversion delegates to the shared `audioGain` law so fps 0/negative is treated as 1 and non-finite values never produce a NaN frame.

## Task Commits

Each task was committed atomically:

1. **Task 1: Move Push mode into the Tools popover** - `587b0f683` (feat)
2. **Task 2: Frame/Seconds go-to popup from the frame readout** - `e53e01e9f` (feat)
3. **Task 3: Hand host tool for primary-drag panning** - `045170fec` (feat)
4. **Closing fix: Studio source pin updated for the armed Hand** - `7d4beafac` (fix)

_Note: docs artifacts (SUMMARY.md, STATE.md, PLAN.md) are intentionally left uncommitted for the orchestrator's docs commit._

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintFrameGoto.ts` - Frame/seconds normalization and resolution law
- `app/src/components/physic-paint/view/physicsPaintFrameGoto.test.ts` - 11 tests: rounding, clamping, fps conversion, non-finite nulls, roundtrip
- `app/src/components/physic-paint/view/physicsPaintHandTool.ts` - Session-only host-tool signal with compare-then-write arm/disarm
- `app/src/components/physic-paint/view/physicsPaintHandTool.test.ts` - 6 tests: arm/disarm law, effect notifications, paint-state isolation, source pin
- `app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts` - 6 wiring tests: rail button, viewport capture, release disarm, no keyboard binding, CSS
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - Push section in the Tools popover, frame go-to popover, call-site props
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - Updated ordering pins and new popover source contracts
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` - Hand button and paint-tool active exclusion
- `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx` - Hand drag branch, grab cursor effect, self-heal disarm
- `app/src/components/physic-paint/physicsPaintStudio.css` - Frame trigger/popover styling, hand cursor rules, removed the push group rule
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Rail `isActive` pin now includes `!handArmed`

## Decisions Made

- Reused `PhysicsPaintToolboxPopover` with optional `panelId`/`className` instead of adding a second popover shell; the Tools instance keeps its defaults.
- The frame popup seeds its draft from `playbackTick.appFrame` while playing, otherwise from the current frame; all normalization stays in `physicsPaintFrameGoto.ts`.
- The Hand is modelled exactly like the latched picker (host tool, outside `AquarelleTool`), so arming/disarming never writes the paint tool, Select mode, or the picker.
- The Hand capture consumer stands down without `preventDefault`/`stopPropagation` when the sheet has no overflow; an effect also disarms when overflow disappears so painting can never stay blocked.
- No keyboard shortcut for the Hand; the rail button is the only entry point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the stale rail `isActive` source pin**
- **Found during:** Closing full-suite gate (after Task 3)
- **Issue:** `PhysicsPaintStudio.test.ts:3127` pinned the pre-Hand expression `const isActive = !selectActive && !pickerActive && active === id;`, so the full suite failed after the planned `!handArmed` addition.
- **Fix:** Updated the pin to include `!handArmed` and noted the 261105-cgl reason beside it.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- **Verification:** The file passes (338 tests), and the full suite is green (373 files / 7267 tests passed).
- **Committed in:** `7d4beafac`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope creep; the fix only aligned an existing source pin with the planned rail change.

## Issues Encountered

- Task 2's RED test initially expected a finite frame for seconds mode with `fps = NaN`; the implementation correctly resolves non-finite results to `null`. The test expectation was corrected to the fail-safe behavior (no NaN seek).
- `pnpm --dir app exec vitest run` collects only `.test.ts` files, so all new tests are `.ts` (the established repo convention).

## Stub Tracking

No stubs introduced. The Hand signal is session-only by design and is never persisted.

## UAT Rows (PENDING — live verification required)

- [ ] **UAT 1 — Push in Tools:** Push mode is gone from the bottom action row and present in the Tools popover with its icon and label.
- [ ] **UAT 2 — Frame go-to:** Clicking the frame readout opens the popup, defaults to Frame, and seeks to the entered frame.
- [ ] **UAT 3 — Seconds go-to:** Seconds mode shows the same position in seconds and seeks on a seconds entry.
- [ ] **UAT 4 — Hand availability:** The Hand button is greyed at Fit and enabled when zoomed past Fit.
- [ ] **UAT 5 — Hand drag:** Hand drag pans in all directions; release returns to the previous paint tool and the next stroke paints normally.
- [ ] **UAT 6 — Existing gestures:** Middle-drag, wheel/pinch zoom, and painting at 1:1 are unchanged after a hand pan.

## Next Phase Readiness

- All automated gates pass: typecheck clean, full suite 373 files / 7267 tests passed (2 skipped files, 1 skipped test, 96 todo).
- The quick remains open until the six live UAT rows are approved.

---
*Quick: 261105-cgl*
*Completed: 2026-11-05*

## Self-Check: PASSED

All created files exist on disk and all four plan commits are ancestors of HEAD.
