---
phase: 60-studio-timeline-horizontal-zoom
plan: 05
subsystem: testing
tags: [timeline, zoom, audit, single-authority, vitest, source-contract, tdd]

# Dependency graph
requires:
  - phase: 60-studio-timeline-horizontal-zoom/60-04
    provides: every row/lane/rail consumer converted to required pitch/gap props
provides:
  - Executable ZOOM-05 single-authority audit (absence rules + per-consumer presence proofs + vacuity guards)
  - Required cellWidthPx on the ruler-scrub hook; DEFAULT_CELL_WIDTH_PX and the ?? fallback deleted
  - Exact five-site pitch/gap consumer counts restored in both pre-existing pins
affects: [60-06 zoom matrix test, phase 62 curve editing]

# Actuals (#2632) — chars/4 over the realized diff, the same scale as the plan estimate
actuals:
  tokens: 9119
  tasks: 3
  commits: 5
  plan_head_before: 2a788a5d83071824542a1038a1bdfc8dcbb11c94
  plan_head_after: a903c7c2c81a224071269849b31359f72a319ee8

tech-stack:
  added: []
  patterns:
    - "Source audit with two halves: absence rules (nothing outside the owners declares a pitch) and per-consumer presence proofs (every consumer reads it)"
    - "Vacuity guards before trust: minimum scan size, named-consumer presence, seeded positive per rule, comment-only negative control"
    - "Rules run on comment-stripped code so a doc mention never satisfies or violates a rule"

key-files:
  created:
    - app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts
    - .planning/phases/60-studio-timeline-horizontal-zoom/60-05-red-evidence-task1.json
  modified:
    - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts

key-decisions:
  - "timelineZoomAuthorityAudit.test.ts scans view/ and hooks/ with readdirSync and permits exactly two owners; PERMITTED_FILES.size === 2 is itself an assertion, so a third allowlist entry fails the audit"
  - "The identifier rule strips /* */ and // comments (a // after ':' survives so a URL is not a comment) and is proved with a seeded positive plus line- and block-comment negatives"
  - "The presence half pins exact consumer counts (five framePitch/frameGap render sites; three framePitch prop declarations in the row; two cellPitch uses in the lane) so a dropped or added authority read fails by name"
  - "The ruler-scrub hook keeps cellWidthPx REQUIRED with no fallback; the strip passes timelineZoom.metrics.peek().pitch at the call site (event-time read, no subscription)"
  - "The rails keep their optional frameGap defaulting to TIMELINE_GEOMETRY.cellGap (wave-4 decision) while the strip always forwards the live gap; the presence proof pins both forwarding sites"
  - "Cross-track drag received its own presence block even though Task 3's bullet list omitted it: Task 2 named it as a consumer and the acceptance criterion covers every named consumer"

patterns-established:
  - "Single-authority audit: absence + presence + vacuity guards in one node-environment file, greppable as the ZOOM-05 proof"
  - "Restored exact counts: the two wave-4 >= 2 pins returned to toBe(5), corroborated by the audit's independent exact count"

requirements-completed: [ZOOM-05]

coverage:
  - id: D1
    description: "No numeric pitch constant, retired pitch identifier, bare-18 frame arithmetic or static TIMELINE_GEOMETRY.cellPitch read survives outside the two owners; the scan cannot pass vacuously"
    requirement: ZOOM-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#scans the real view and hooks surface, including every named consumer"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#proves each absence rule against a seeded positive and a comment-only negative"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#no numeric pitch constant, bare 18 or static pitch token survives outside the two owners"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ruler-scrub hook requires cellWidthPx, declares no local pitch default, and divides client x by the supplied width"
    requirement: ZOOM-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.test.ts#requires an explicit cell width and declares no local pitch default"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.test.ts#divides client x by the explicitly supplied cell width, not a fallback"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every converted consumer is proved by name to read the authority: strip, track row, motion lane, motion key drag, both rails, loop presentation, sound band, ruler scrub and cross-track drag"
    requirement: ZOOM-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#view/PhysicsPaintWorkflowStrip.tsx reads the live metrics once and threads pitch/gap into both rails, the motion block and both rows"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#view/PhysicsPaintTrackRow.tsx declares required pitch/gap props and derives every row projection from them"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#view/TimelineMotionChannels.tsx declares required pitch/gap props and scales the lane, cell, key, curve and outline"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#view/TimelineMotionKeyDrag.tsx divides pointer travel by the lane framePitch through its latest-value ref"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#view/PhysicsPaintKeyRail.tsx forwards the pitch and the live gap into the shared rail-width law"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#view/PhysicsPaintLoopClipRail.tsx forwards the live pitch and gap into the loop geometry"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#view/physicsPaintLoopClipPresentation.ts takes the gap as a parameter and forwards it to the rail-width law"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#view/soundBandGeometry.ts takes the cell width as a parameter in both placement helpers"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#hooks/usePhysicsPaintRulerScrub.ts requires cellWidthPx and divides client x by it with no fallback"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts#hooks/usePhysicsPaintCrossTrackDrag.ts resolves the pointer frame by the supplied framePitch"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-09
status: complete
---

# Phase 60 Plan 05: Single-Authority Audit and Ruler-Scrub Pitch Retirement Summary

**The ZOOM-05 claim is now executable: a node-environment audit fails on a reintroduced pitch literal, on a missing consumer, and on a scan that silently stopped scanning — and the ruler-scrub hook can no longer be called without an explicit cell width.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-09T12:58:00Z
- **Completed:** 2026-11-09T13:07:30Z
- **Tasks:** 3
- **Files modified:** 6 (4 source/test files + 1 new audit + 1 RED evidence record)

## Accomplishments

- `timelineZoomAuthorityAudit.test.ts` scans every non-test `.ts`/`.tsx` under `physic-paint/view/` and `physic-paint/hooks/` (25+ files), permits exactly `physicsPaintTimelineZoom.ts` and `timelineRailDesign.ts`, and applies four absence rules to comment-stripped code: retired identifiers, numeric pitch/cell-width constants, bare-18 frame arithmetic, and `TIMELINE_GEOMETRY.cellPitch` reads outside the owner.
- The audit cannot pass vacuously: it asserts the scan size and every named consumer, asserts both permitted files were collected, seeds each rule with a positive sample it must flag, and proves the identifier rule ignores line- and block-comment mentions.
- A ten-block presence half proves by name that the strip (one body read, five render sites, peek in event handlers, sound band), track row (required props, three pitch declarations, two loop-geometry calls), motion lane (lane width, cell, key centring, curve scale, outline), key drag, both rails, loop presentation, sound-band helpers, ruler scrub and cross-track drag all read the authority.
- The ruler-scrub hook's `DEFAULT_CELL_WIDTH_PX` and `??` fallback are gone; `cellWidthPx` is required and the single production call site passes `timelineZoom.metrics.peek().pitch`.
- TDD: Task 1 recorded a JUnit RED run (14 tests, 13 pass / 1 fail, `RED_EVIDENCE_OK`) before the implementation commit.

## Task Commits

1. **Task 1: Ruler-scrub required width (RED)** - `429bb0f63` (test)
2. **Task 1: Ruler-scrub required width (GREEN)** - `14a48f447` (feat)
3. **Task 2: Audit part one — absence rules and vacuity guards** - `fc3009d17` (test)
4. **Task 3: Audit part two — per-consumer presence proof** - `9e4186216` (test)
5. **Instruction note: restore exact pitch/gap consumer counts** - `a903c7c2c` (test)

**Plan metadata:** see the final `docs(60-05)` commit.

_Note: plan-level gates — full suite 8324 passed / 1 skipped / 96 todo; typecheck clean._

## Files Created/Modified

- `timelineZoomAuthorityAudit.test.ts` — the audit: scan helpers, comment stripper, four absence rules with seeded controls, three vacuity/absence tests, ten per-consumer presence tests
- `usePhysicsPaintRulerScrub.ts` — `cellWidthPx` required with a live-pitch doc comment; `DEFAULT_CELL_WIDTH_PX` and the fallback deleted
- `usePhysicsPaintRulerScrub.test.ts` — harness passes `TIMELINE_GEOMETRY.cellPitch` explicitly; two authority tests (required option + 2x division)
- `PhysicsPaintWorkflowStrip.test.ts` — `frameGap` consumer count restored from `>= 2` to `toBe(5)`
- `physicsPaintTimelineZoomWiring.test.ts` — `framePitch` consumer count restored from `>= 2` to `toBe(5)`
- `60-05-red-evidence-task1.json` — validated RED evidence record

## Decisions Made

- The allowlist size itself is an assertion (`PERMITTED_FILES.size === 2`), so extending it to silence a violation fails the audit.
- Presence assertions run on comment-stripped, whitespace-collapsed text; a documentation mention can neither satisfy nor violate a pin.
- Exact counts are the presence pin of choice where the consumer set is enumerable (five strip render sites, three row prop declarations, two lane curve/outline uses).
- Cross-track drag is proved even though Task 3's bullet list omitted it — Task 2 named it as a consumer, and the strip passes it `framePitch: timelineZoom.metrics.peek().pitch`.

## Deviations from Plan

### Instruction-Led Adjustment

**1. Restored the two wave-4 relaxed counts to exact expectations**
- **Found during:** Task 3 close-out, against the user's wave-4 note
- **Issue:** `PhysicsPaintWorkflowStrip.test.ts:1249` and `physicsPaintTimelineZoomWiring.test.ts:133` asserted `>= 2` after 60-04 added the motion block and both rows.
- **Fix:** The new audit independently proves the real consumer set is exactly five render sites, so both pins returned to `toBe(5)` with comments pointing at the audit as the second witness.
- **Files modified:** `PhysicsPaintWorkflowStrip.test.ts`, `physicsPaintTimelineZoomWiring.test.ts`
- **Verification:** both files 226/226; full suite 8324 passed.
- **Committed in:** `a903c7c2c`

**Total deviations:** 1 instruction-led adjustment (no Rule 1-4 fixes needed)
**Impact on plan:** Strictness increased, not weakened; no scope creep.

## Issues Encountered

- A piped RED run masked vitest's exit status behind `tail`; the evidence record was completed by reading the JUnit XML directly (`tests="14" failures="1"` with the expected assertion), which the classifier accepted as `RED_EVIDENCE_OK`.
- The audit's `NAMED_CONSUMERS` list includes the two owners plus ten consumers; the presence describe proves the ten non-owners, while the owners' existence and non-emptiness are asserted in the scan test.
- Pre-existing doc comments naming the retired formula (audio controller, ruler-scrub option) remain and are correctly out of scope because every rule reads comment-stripped code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The literal audit is zero and self-guarding; 60-06 can write the zoom matrix test against a tree where no second pitch authority can reappear silently.
- The ruler-scrub compile gate is live: any future caller must supply `cellWidthPx` explicitly.
- No stubs, no skipped tests, no unrun verify commands in this plan.

## Self-Check: PASSED

---
*Phase: 60-studio-timeline-horizontal-zoom*
*Completed: 2026-11-09*
