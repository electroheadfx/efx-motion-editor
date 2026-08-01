---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 08
subsystem: testing
tags: [physics-paint, roto, capsule, tooltip, vitest, post-uat]

requires:
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 06
    provides: Explicit approval of the full 33-step native UAT and D-15 gate lift
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 07
    provides: Post-UAT group Copy/Paste regression anchors included in the closing full-suite gate
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 03
    provides: Shipped capsule idle-context helper and empty-string fallback
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 05
    provides: Shipped viewport tooltip placement utility and multiline/notch CSS contract
provides:
  - Regression anchors for capsule idle current-cell mapping, empty fallback, and priority arbitration
  - Pure-function coverage for tooltip direction, side flips, 8px viewport clamps, and post-clamp notch tracking
  - CSS regression coverage for the approved flat charcoal tooltip, 280x96 multiline clamp, and four same-fill notch directions
  - Green Phase 38 closing gate across full Vitest, TypeScript typecheck, and production build
  - Rewritten deferred header clipping assertion against the current region-driven fixed-position tooltip contract
affects: [phase-38-closure, gsd-verify-work, capsule, tooltip]

tech-stack:
  added: []
  patterns:
    - "Post-UAT tests lock shipped public selectors and pure placement helpers without production edits"
    - "Tooltip CSS assertions extract the complete base/modifier/notch region and pin the user-approved flat visual contract"

key-files:
  created:
    - .planning/phases/38-multi-copy-paste-and-tooltip-polish/38-08-SUMMARY.md
  modified:
    - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "The user-approved tooltip visual is authoritative: flat #62666d fill, border 0, 4px radius, 12px normal-weight text, and same-color notch; the obsolete #20262d bordered pill contract was not restored."
  - "The full-suite-discovered WorkflowStrip header assertion was the third known-red D-15 deferred assertion and was rewritten against region=top plus fixed viewport positioning rather than treated as unrelated debt."
  - "Production source remained untouched; every correction was confined to regression tests against UAT-approved behavior."

patterns-established:
  - "Placement fixtures use plain DOMRect-shaped objects and a stubbed 1000x700 viewport; no DOM mount is required."
  - "Post-clamp notch tests assert independent numeric examples rather than recomputing expected values from production formulas."

requirements-completed:
  - 38-CAPSULE-IDLE-CONTEXT
  - 38-TOOLTIP-VIEWPORT-PLACEMENT
  - 38-TOOLTIP-NOTCH-MULTILINE
  - 38-UAT-THEN-REGRESSION

coverage:
  - id: SC-1-4
    description: "Capsule idle mapping, empty fallback, priority ladder, recency tie-break, and blank-candidate behavior"
    requirement: 38-CAPSULE-IDLE-CONTEXT
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts#getRotoStatusCapsuleIdleContext/getRotoStatusCapsuleViewModel (22 tests passed)"
        status: pass
    human_judgment: false
  - id: TP-1-4
    description: "Tooltip region directions, insufficient-room flips, exact 8px clamps, and post-clamp notch offsets"
    requirement: 38-TOOLTIP-VIEWPORT-PLACEMENT
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts#computeTooltipPlacement (9 file tests passed)"
        status: pass
    human_judgment: false
  - id: TP-5
    description: "280x96 multiline tooltip and approved flat charcoal four-direction notch CSS contract"
    requirement: 38-TOOLTIP-NOTCH-MULTILINE
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts#surface contract"
        status: pass
      - kind: manual_procedural
        ref: "38-06 native UAT steps 21-29, explicitly approved"
        status: pass
    human_judgment: false
  - id: D15-CLOSE
    description: "Post-UAT regression sequence closes with full tests, typecheck, and production build green"
    requirement: 38-UAT-THEN-REGRESSION
    verification:
      - kind: integration
        ref: "pnpm --dir app exec vitest run; pnpm --dir app run typecheck; pnpm --dir app run build"
        status: pass
    human_judgment: false

metrics:
  duration: 18min
  tasks: 3
  files: 4
  completed: 2026-07-29
status: complete
---

# Phase 38 Plan 08: Post-UAT Capsule and Tooltip Regression Summary

**Capsule idle context and viewport tooltip behavior are now regression-locked against the UAT-approved shipped contract, with the complete app suite, TypeScript check, and production build green.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-29T15:53:58Z
- **Completed:** 2026-07-29T16:11:41Z
- **Tasks:** 3
- **Files modified:** 4 (three test files plus this summary)

## Accomplishments

- Replaced the knowingly-red capsule baseline assertions with exact real/generated/empty/null idle mapping, empty-string fallback, ambient pass-through, full priority arbitration, recency tie-break, and blank-candidate coverage.
- Added deterministic pure-function tooltip tests for all four region directions, all four insufficient-room flips, exact horizontal and vertical 8px clamps, and horizontal/vertical notch offsets computed after pill clamping.
- Extended the tooltip CSS surface contract across the base rule, all direction modifiers, and notch rules, pinning the approved flat `#62666d` visual, `border: 0`, `border-radius: 4px`, 12px normal-weight text, 280x96 multiline wrapping, and same-fill 10x6 notch triangles.
- Rewrote the deferred header clipping guard from the retired `placement="below"`/anchor-relative CSS contract to the shipped `region="top"`/fixed viewport contract.
- Closed Phase 38's D-15 sequence with the full app suite, TypeScript typecheck, and production build green; the 53 Plan 38-07 group-seam tests were included.

## Task Commits

Each task was committed atomically:

1. **Task 1: Capsule idle-context regression anchors** — `f92dc620` (`test`)
2. **Task 2: Tooltip placement and approved flat visual regression anchors** — `8cc80b30` (`test`)
3. **Task 3 deviation fix: Deferred header clipping assertion rewrite** — `65ca0f97` (`test`)
4. **Task 3: Phase-closing full gate record** — `b529d620` (`test`, allow-empty verification commit)

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts` — SC-1..SC-4 capsule idle-context and arbitration coverage; deleted baseline text removed from assertions and comments.
- `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts` — TP-1..TP-5 placement math and complete approved CSS surface coverage.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — deferred header clipping guard updated to the current region-driven fixed-position contract.
- `.planning/phases/38-multi-copy-paste-and-tooltip-polish/38-08-SUMMARY.md` — execution, gate, and deviation evidence.

## Decisions Made

- Followed the user's locked visual approval instead of the stale Plan 38-08 TP-5 color wording: the regression contract asserts flat charcoal `#62666d`, no border, 4px corners, 12px/400 text, and same-color notch triangles.
- Treated the full-suite failure in `PhysicsPaintWorkflowStrip.test.ts` as the omitted third known-red D-15 assertion documented by STATE/plan context. It was a test-contract transfer, not a production defect.
- Kept all implementation files byte-untouched because the 38-06 native UAT had already approved the shipped behavior.

## Verification

Targeted task runs:

- `pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts` — exit 0; 1 file passed, 22 tests passed.
- `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts` — exit 0; 1 file passed, 9 tests passed.
- `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — exit 0; 1 file passed, 63 tests passed.

Closing sequence, run in order:

1. `pnpm --dir app exec vitest run` — **exit 0**. Headline: `Test Files 92 passed | 3 skipped (95)`; `Tests 967 passed | 1 skipped | 101 todo (1069)`; duration 2.86s.
2. `pnpm --dir app run typecheck` — **exit 0**. Headline: `tsc --noEmit` completed with no diagnostics.
3. `pnpm --dir app run build` — **exit 0**. Headline: Vite 5.4.21 transformed 1086 modules and completed the production build in 1.17s.

Plan 38-07 inclusion was confirmed in the full-suite log:

- `physicsPaintRotoPhysicalResolver.test.ts` — 22 tests passed.
- `physicsPaintRotoMultiSelection.test.ts` — 21 tests passed.
- `physicsPaintRotoSession.test.ts` — 10 tests passed.

The suite emitted existing Motion Canvas missing-sourcemap warnings and Vite's CJS Node API deprecation warning; neither affected exit status or introduced a new plan-scoped failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected pnpm command forms for this installed pnpm version**
- **Found during:** Task 1 targeted verification and Task 3 closing gate
- **Issue:** The literal `pnpm --dir app vitest run` form attempted to execute the app directory and failed with `EACCES` before Vitest launched.
- **Fix:** Used the equivalent one-shot commands `pnpm --dir app exec vitest run`, `pnpm --dir app run typecheck`, and `pnpm --dir app run build`.
- **Files modified:** none
- **Verification:** All targeted and closing commands exited 0.
- **Committed in:** no file change; verification-command correction only.

**2. [Rule 2 - Missing Critical] Added the omitted third deferred D-15 assertion rewrite**
- **Found during:** Task 3 full-suite gate
- **Issue:** `PhysicsPaintWorkflowStrip.test.ts` still asserted the retired `placement="below"` prop and anchor-relative `top/bottom` CSS. This was the header-tooltip assertion identified in STATE as one of the three knowingly-red post-UAT rewrites, but it was absent from the plan's `files_modified` list.
- **Fix:** Rewrote the guard to assert exactly three `region="top"` declarations across the extracted capsule owner and direct header mounts, plus the fixed-position surface and approved `#62666d` below-notch rule.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`
- **Verification:** Focused file passed 63/63; full suite passed 967 tests.
- **Committed in:** `65ca0f97`.

**3. [Rule 2 - Missing Critical] Applied the user-approved tooltip visual over stale plan wording**
- **Found during:** Task 2 CSS contract construction
- **Issue:** The plan's TP-5 behavior bullet still named the old `#20262d` bordered pill, while the locked execution context explicitly approved the shipped flat `#62666d` tooltip and prohibited restoring the old style.
- **Fix:** Asserted the current approved flat visual contract, including same-color notch rules, and added typography/border/radius anchors.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts`
- **Verification:** Focused tooltip file passed 9/9; full suite passed.
- **Committed in:** `8cc80b30`.

---

**Total deviations:** 3 auto-fixed (2 missing-critical contract corrections, 1 blocking command correction).
**Impact on plan:** No production scope expansion and no behavior change; all deviations were required to test the actual UAT-approved shipped contract and complete the mandated full gate.

## Issues Encountered

- The first corrected full-suite run exposed the omitted header clipping assertion. The failing assertion was diagnosed as stale post-UAT test debt, rewritten once, verified focused, and then included in the successful closing sequence.
- Motion Canvas sourcemap warnings and the Vite CJS API deprecation warning remain pre-existing advisory output; they did not fail tests, typecheck, or build.

## TDD Gate Compliance

- Plan-level RED evidence was observed before Task 1 editing: the presentation file failed exactly two deferred baseline assertions while 19 tests passed.
- Test commits exist for every behavior update (`f92dc620`, `8cc80b30`, `65ca0f97`).
- No `feat(38-08)` GREEN commit exists because this is an explicitly post-UAT regression-only plan that prohibits production edits. The shipped implementation was already approved; adding production changes solely to manufacture a GREEN commit would violate the plan.

## Known Stubs

None — no TODO/FIXME/placeholder, skipped-test, or unwired mock-data pattern was introduced in the three modified test files.

## Threat Flags

None — this plan added no network endpoint, authentication path, file-access behavior, schema change, or HTML-injection surface. Existing text-children-only and `aria-describedby` assertions remain intact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 38's production → native UAT → regression → full-gate sequence is complete and ready for `/gsd-verify-work` or phase closure.
- No unresolved plan-scoped blocker remains; production files were untouched and the working tree was clean after task commits.

---
*Phase: 38-multi-copy-paste-and-tooltip-polish*
*Completed: 2026-07-29*

## Self-Check: PASSED

- All three modified test files and `38-08-SUMMARY.md` exist.
- Task commits `f92dc620`, `8cc80b30`, `65ca0f97`, and `b529d620` are present in git history.
- Full Vitest, typecheck, and build gates completed successfully after the final test-contract rewrite.
