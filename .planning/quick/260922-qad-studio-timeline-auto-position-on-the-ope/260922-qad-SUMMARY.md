---
phase: quick-260922-qad
plan: 260922-qad
status: complete
subsystem: physic-paint / studio-workflow-strip
tags: [preact, effects, viewport, timeline, launch-context, red-green, tdd]
requires:
  - phase: quick-260922-jss
    provides: the settled launch-context pipeline every Studio open boots through (URL `?context=` + late-arrival bridge paths)
  - phase: 52
    provides: launchContext.startFrame as the main-app playhead carrier at Studio open
provides:
  - the one-shot timeline viewport positioning effect in PhysicsPaintWorkflowStrip (scrollLeft + updateScrollbar only, ref-guarded termination)
  - the optional `timelineOpenFrame` strip prop and the Studio wiring `timelineOpenFrame: launchContext?.startFrame ?? null`
  - six behavioural viewport legs (i)-(vi) pinning positioning, clamp, viewport-only, one-shot, late content, and no-launch controls
affects: [native UAT rows 1-3, PhysicsPaintWorkflowStrip, PhysicsPaintStudio]

actuals:
  tokens: 3223    # chars/4 over the realized diff (12895 chars across the 4 changed files)
  tasks: 2
  commits: 2
  plan_head_before: ac469944cb30c5555e6b0abc56fed63d0e298f8c

tech-stack:
  added: []
  patterns:
    - "One-shot effect with a useRef guard whose termination condition is written at the declaration: flips exactly once on first successful positioning, parks (without flipping) on absent frame / missing ref / not-yet-eligible content so a late launch or late content can still position exactly once"
    - "RED-first TDD: the inert prop surface exists before the behaviour so the RED is an assertion failure (expected 1584, actual 0), never a missing-symbol error"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Positioning target is deterministic: `frame * 18 + 9 - clientWidth / 2`, clamped to [0, scrollWidth - clientWidth] — frame 111 at the 47-cell fixture lands exactly at scrollLeft 1584, frame 1 clamps to 0"
  - "Eligibility gates park WITHOUT flipping the one-shot guard (absent/invalid frame, missing scroller, scrollWidth < (frame+1)*18), so a launch context arriving after mount (null → N) or content growing later (capacity 50 → 240) still positions exactly once — and only once"
  - "Deps are `[props.timelineOpenFrame, props.rotoPhysicalCells.length, updateScrollbar]`: value deps for the launch frame and content extent, identity-stable `[]`-useCallback for the scrollbar — no new identity is created per render"
  - "The effect reads only `props.timelineOpenFrame` for the target, never `props.currentFrame`; in-session navigation mutates startFrame but the ref guard makes re-positioning structurally impossible (T-qad-02)"

requirements-completed: []

coverage:
  - id: i
    description: "Opening at frame 111 positions the viewport at scrollLeft 1584 with frame 111's cell in view (THE RED leg)."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts (leg i, green after 1726c315; RED at 2892203e)"
        status: pass
    human_judgment: false
  - id: ii
    description: "Opening at frame 1 keeps scrollLeft 0 with frame 0 in view (negative target clamps)."
    verification:
      - kind: unit
        ref: "viewport test leg ii (control, green in both runs)"
        status: pass
    human_judgment: false
  - id: iii
    description: "Positioning writes zero navigation/selection intents (viewport-only guardrail, T-qad-01)."
    verification:
      - kind: unit
        ref: "viewport test leg iii — eight spies asserted at 0 calls (green)"
        status: pass
    human_judgment: false
  - id: iv
    description: "One-shot: navigation never re-positions; manual scroll never snaps back."
    verification:
      - kind: unit
        ref: "viewport test leg iv (RED at 2892203e, green after 1726c315)"
        status: pass
    human_judgment: false
  - id: v
    description: "Late content: parked while scrollWidth is short, positions once content covers the frame."
    verification:
      - kind: unit
        ref: "viewport test leg v — capacity 50 parks at 0, setCapacity(240) positions at 1584 (RED then green)"
        status: pass
    human_judgment: false
  - id: vi
    description: "No launch frame never positions, whatever the current frame is."
    verification:
      - kind: unit
        ref: "viewport test leg vi (control, green in both runs)"
        status: pass
    human_judgment: false
  - id: W
    description: "The Studio wires `timelineOpenFrame: launchContext?.startFrame ?? null` into the workflow object."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts — source pin (green)"
        status: pass
    human_judgment: false

native_uat:
  status: pending
  rows:
    - id: 1
      description: "Main app, playhead on frame 111 → open Studio → frame 111 visible in the Studio timeline without scrolling"
      status: pending
    - id: 2
      description: "Playhead on frame 1 → open Studio → frame 1 visible (clamp holds at scrollLeft 0)"
      status: pending
    - id: 3
      description: "Regression — after open, scrolling the Studio timeline still works and does not snap back"
      status: pending

verification:
  targeted: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts — 192 passed (2 files)"
  full_suite: "pnpm --filter efx-motion-editor exec vitest run — 4180 passed | 1 skipped | 101 todo, 0 failed (exit 0; no pre-existing failures to attribute)"
  tsc: "pnpm --filter efx-motion-editor exec tsc --noEmit — clean"
  scope_gate: "git diff ac469944..HEAD --name-only = exactly the four planned app/src files; no src-tauri, no lockfile, no vitest.config, no package.json"
  guardrail: "diff audit: the effect's only writes are scroller.scrollLeft and updateScrollbar(); grep over added lines shows no onNavigate/onSelect/onClear/onGoTo/setLaunchContext/scrollIntoView/scrollTop/setTimeout/rAF/useState; leg (iii) zero-call assertion green"
---

# Phase quick-260922-qad: Studio Timeline Auto-Position on the Opened Frame Summary

One-shot viewport positioning of the Studio timeline on the launch frame (`launchContext.startFrame`), RED-first: a ref-guarded effect writing only `scroller.scrollLeft` + `updateScrollbar()`, wired through a new optional `timelineOpenFrame` strip prop.

## RED Evidence (recorded at Task 1, commit 2892203e)

Command:

```
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
```

Raw result — **3 failed | 35 passed (38)**, exit 1. The three failures are ASSERTION failures on scroll position (not missing-prop / not TypeScript-load errors — the inert `timelineOpenFrame` prop existed from STEP A):

```
❯ src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts (38 tests | 3 failed) 109ms
   × Studio open positions the timeline viewport on the opened frame > (i) THE RED: opening at frame 111 puts frame 111 inside the viewport 4ms
     → expected +0 to be 1584 // Object.is equality
   × Studio open positions the timeline viewport on the opened frame > (iv) RED: one-shot positioning — navigation never re-positions and manual scroll never snaps back 1ms
     → expected +0 to be 1584 // Object.is equality
   × Studio open positions the timeline viewport on the opened frame > (v) RED: late content — parked while the extent is short, positions once content covers the frame 1ms
     → expected +0 to be 1584 // Object.is equality

 FAIL ... > (i) THE RED: opening at frame 111 puts frame 111 inside the viewport
AssertionError: expected +0 to be 1584 // Object.is equality
 ❯ ...viewport.test.ts:1016:41
    1016|     expect(harness.scroller.scrollLeft).toBe(1584);

 FAIL ... > (iv) RED: one-shot positioning — navigation never re-positions and manual scroll never snaps back
AssertionError: expected +0 to be 1584 // Object.is equality
 ❯ ...viewport.test.ts:1048:41
    1048|     expect(harness.scroller.scrollLeft).toBe(1584);

 FAIL ... > (v) RED: late content — parked while the extent is short, positions once content covers the frame
AssertionError: expected +0 to be 1584 // Object.is equality
 ❯ ...viewport.test.ts:1073:41
    1073|     expect(harness.scroller.scrollLeft).toBe(1584);

 Test Files  1 failed (1)
      Tests  3 failed | 35 passed (38)
```

Green controls in the same run (35 passed = 3 controls + 29 pre-existing + 3? — precisely: legs (ii), (iii), (vi) passed as controls, plus every pre-existing viewport leg stayed green):

- **(ii)** frame 1 open → scrollLeft stays 0, frame 0 in view — guards the clamp never scrolls negative.
- **(iii)** zero navigation/selection mock calls during positioning — guards the viewport-only rule (T-qad-01).
- **(vi)** no launch frame → scrollLeft stays 0 — guards "never positions without a launch frame".

What each RED leg now guards (all green after 1726c315):

- **(i)** the core defect: frame 111 out of view at scrollLeft 0 → now positioned at exactly 1584 with the cell intersecting the viewport.
- **(iv)** one-shot semantics: after positioning, `setOpenFrame(50)` + navigation leave scrollLeft at 1584, and a manual `scrollToFrame(5)` (90) survives the next flush — no re-position, no snap-back (T-qad-02).
- **(v)** late content: capacity-50 content (scrollWidth 900 < 2016) parks at 0; growth to 240 positions once at 1584.

No RED verdict was taken after the effect landed.

## Deviations from Plan

None — plan executed exactly as written (2 tasks, RED then GREEN, commit messages as specified).

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file access, or schema surface; viewport-only change (T-qad-03 accepted).

## Verification Summary

| Gate | Result |
| ---- | ------ |
| Targeted viewport + Studio suite | 192 passed (exit 0) |
| Full suite | 4180 passed / 0 failed (exit 0; nothing absorbed) |
| `tsc --noEmit` | clean |
| Diff scope vs plan base `ac469944` | exactly the 4 planned `app/src/**` files |
| Guardrail diff audit | effect writes only `scrollLeft` + `updateScrollbar()`; leg (iii) green |
| Native UAT (3 rows) | **PENDING — never claimed** |

## Commits

- `2892203e` — test(260922-qad): pin Studio open viewport positioning — RED
- `1726c315` — fix(260922-qad): position the Studio timeline viewport on the opened frame

Plan head before: `ac469944cb30c5555e6b0abc56fed63d0e298f8c` (2 commits measured).

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.tsx
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- FOUND: 2892203e, 1726c315 (git log)
