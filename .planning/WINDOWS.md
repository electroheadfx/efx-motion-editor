---
schema_version: 1
open_count: 21
waived_count: 1
fixed_count: 41
total_count: 63
last_updated: 2026-08-11T17:32:28.720Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 36.14 | deviation | app/src/lib/physicPaintBridge.ts |  | Valid physical failures now use the exact parent acknowledgement shape. | fixed |  | 2026-07-22T10:48:07.831Z | 2026-07-22T10:53:08.172Z |
| 2 | 36.14 | deviation | app/src/lib/physicPaintBridge.ts |  | Complete physical-map edits bypass the legacy generated display mutation guard and use authoritative semantic validation. | fixed |  | 2026-07-22T10:48:07.922Z | 2026-07-22T10:53:08.534Z |
| 3 | 36.14 | deviation | app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts |  | Malformed resolver intents are rejected before reading their discriminator. | fixed |  | 2026-07-22T10:48:08.016Z | 2026-07-22T10:53:08.869Z |
| 4 | 36.14 | deviation | .planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-11-SUMMARY.md |  | Compile proof deferred to Plan 13 after byte-exact native UAT approval | open |  | 2026-07-22T13:56:41.272Z |  |
| 5 | 36.14 | unrun-verify | .planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-11-SUMMARY.md |  | Build did not run because the chained typecheck failed on obsolete pre-UAT Script tests | open |  | 2026-07-22T13:56:41.382Z |  |
| 6 | 36.14 | deviation | app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts | 21 | Plan 23 hydration became asynchronous, so the existing launch replacement owner was updated to await the canonical PNG publication barrier. | fixed |  | 2026-07-24T06:23:36.118Z | 2026-07-24T06:25:00.079Z |
| 7 | 36.14 | deviation | .planning/STATE.md |  | Corrected stale latest-activity text and mismatched prose completed-plan count after Plan 22 state update | fixed |  | 2026-07-24T07:33:38.997Z | 2026-07-24T07:34:22.331Z |
| 8 | 36.14 | deviation | .planning/STATE.md |  | Corrected stale Plan 22 activity, Plan 28 next action, and 111-plan prose count left by state handlers after Plan 25 closure | fixed |  | 2026-07-24T07:53:03.816Z | 2026-07-24T07:54:09.840Z |
| 9 | 36.14 | deviation | app/src/types/physicPaint.ts | 739 | The active apply-payload allowlist omitted the valid play-script physical operation. | fixed |  | 2026-07-24T09:36:17.277Z | 2026-07-24T09:37:35.662Z |
| 10 | 36.14 | deviation | .planning/STATE.md |  | Corrected stale Plan 25 activity, Plan 26 next action, and 112-plan prose count after the non-linear Plan 26 state update. | fixed |  | 2026-07-24T09:40:48.530Z | 2026-07-24T09:41:05.837Z |
| 11 | 36.14 | deviation | .planning/STATE.md |  | Corrected stale non-linear recovery position after generic state advancement | fixed |  | 2026-07-24T09:56:45.875Z | 2026-07-24T09:57:16.430Z |
| 12 | 36.15 | stub | app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx |  | Intentional empty flex-1 capsule slot (.physics-paint-header-capsule-slot); resolved by Plan 05 status capsule | open |  | 2026-07-25T18:41:27.754Z |  |
| 13 | 38 | deviation | .planning/phases/38-multi-copy-paste-and-tooltip-polish/38-01-PLAN.md |  | 38-01 verify block: Studio port grep expectations (==1 whole-file) contradict action text; verified scoped to keyUtilities block instead | open |  | 2026-07-27T14:40:22.046Z |  |
| 14 | 38.1 | deviation | app/src/components/physic-paint/PhysicsPaintStudio.tsx |  | Deferred follow-up: right color sidebar + left tool rail visibly re-render on timeline navigation; user wants navigation UI updates localized to the timeline | fixed |  | 2026-07-28T05:55:05.652Z | 2026-07-28T17:51:37.769Z |
| 15 | 38.1 | deviation | app/src/components/physic-paint |  | Deferred follow-up: plain mouse wheel does not scroll the timeline horizontally (shift+wheel required); bottom action toolbar also needs working horizontal scroll | open |  | 2026-07-28T05:55:05.768Z |  |
| 16 | 38.1 | deviation | app/src/components/physic-paint/PhysicsPaintStudio.test.ts |  | Task 1 source contract initially scanned a following comment and was narrowed to the actual dependency list. | fixed |  | 2026-07-28T17:22:23.472Z | 2026-07-28T17:51:37.894Z |
| 17 | 38.1 | unrun-verify | .planning/phases/38.1-studio-render-path-performance/38.1-09-SUMMARY.md |  | Plan 09 forward/reverse native five-counter verification is pending user-owned runtime capture. | fixed |  | 2026-07-28T17:22:23.916Z | 2026-07-28T17:51:38.030Z |
| 18 | 38.1 | deviation | app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts | 81 | Updated stale Plan 09 Play Script dialog mount assertion so the Plan 10 full-suite gate matches the approved memo wrapper. | fixed |  | 2026-07-28T18:37:11.200Z | 2026-07-28T18:38:16.745Z |
| 19 | 38.1 | deviation | .planning/phases/38.1-studio-render-path-performance/38.1-12-SUMMARY.md |  | User authorized grouped bidirectional native thresholds instead of raw forward/reverse delta-object transcription; no telemetry was fabricated | waived | User explicitly authorized grouped bidirectional thresholds as the acceptance record and waived raw delta-object transcription. | 2026-07-28T19:42:16.957Z | 2026-07-28T19:44:03.132Z |
| 20 | 38.1 | deviation | .planning/STATE.md |  | Corrected stale Plan 11 prose and inconsistent completion percentage left by generic state handlers after Plan 12 closure | fixed |  | 2026-07-28T19:45:06.908Z | 2026-07-28T19:45:07.070Z |
| 21 | 38.1 | deviation | .planning/STATE.md |  | Corrected stale sequential state position after the generic advance handler | fixed |  | 2026-07-29T06:18:59.408Z | 2026-07-29T06:20:12.940Z |
| 22 | 38.1 | deviation | .planning/STATE.md |  | Corrected inconsistent generated STATE.md progress and next-plan fields after Plan 38.1-16 | fixed |  | 2026-07-29T06:51:59.691Z | 2026-07-29T06:54:21.095Z |
| 23 | 38.1 | deviation | app/src/test/preactHookRuntime.ts |  | Adjusted the test runtime to the app TypeScript target and removed one unused GREEN-test binding after the no-emit gate. | fixed |  | 2026-07-29T08:08:16.664Z | 2026-07-29T08:09:04.219Z |
| 24 | 38 | deviation | app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts |  | Rewrote omitted stale header-tooltip assertion against the region-driven fixed-position contract | fixed | Verified by the focused 63-test file and full Phase 38 closing suite. | 2026-07-29T16:15:36.790Z | 2026-07-29T16:15:38.053Z |
| 25 | 38 | deviation | app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts |  | Applied the user-approved flat #62666d tooltip visual over stale plan wording | fixed | Verified by the focused 9-test file and full Phase 38 closing suite. | 2026-07-29T16:15:36.934Z | 2026-07-29T16:15:38.053Z |
| 26 | quick-260801-jun | unrun-verify | app/src-tauri/src/services/project_io.rs |  | Pre-existing cargo test lib-test compile failure (stale roto field names); verification battery item 5 red | open |  | 2026-08-01T13:41:39.096Z |  |
| 27 | 41 | deviation | app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts |  | 41-04 deviation: revisioned-update restart decision moved after prepare await (toggle race serialization) | open |  | 2026-08-04T22:36:07.192Z |  |
| 28 | 43 | unmet-truth | app/src/viteBuild.test.ts | 184 | Pre-existing main desktop chunk exceeds the locked 1100 kB warning budget (1,112.66 kB at pre-GREEN baseline 02fa699d). | open |  | 2026-08-07T11:01:42.037Z |  |
| 29 | 43.1 | deviation | app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts |  | Inherited break lifecycle behaviors were characterized green instead of forcing artificial RED failures | open |  | 2026-08-09T15:05:02.967Z |  |
| 30 | 43.1 | deviation | app/src/stores/physicPaintStore.rotoPhysicalStructuralCache.test.ts |  | Structural cache test and projection threading landed in the same atomic commit | open |  | 2026-08-09T15:05:03.053Z |  |
| 31 | 43.1 | deviation | app/src/components/physic-paint/PhysicsPaintStudio.tsx |  | Accepted break ownership wiring was added outside the plan's listed Task 2 files so the live strip receives canonical state. | open |  | 2026-08-09T16:51:31.383Z |  |
| 32 | 43.1 | deviation | app/src/lib/physicPaintPersistence.ts |  | Cleared memoized save authority when empty-output cleanup removes the canonical Physics Paint cache. | open |  | 2026-08-10T06:36:00.210Z |  |
| 33 | 43.1 | deviation | .planning/STATE.md |  | state.update-progress reported 90% but wrote progress.percent 57; closeout reconciled STATE metadata | fixed |  | 2026-08-10T06:55:25.047Z | 2026-08-10T06:56:05.035Z |
| 34 | 43.1 | deviation | .planning/STATE.md |  | Corrected inconsistent generated Plan 09 progress, activity, and decision metadata | fixed |  | 2026-08-10T07:42:52.621Z | 2026-08-10T07:43:54.828Z |
| 35 | 43.1 | deviation | app/src/lib/physicPaintBridge.test.ts | 879 | Updated the legacy incoming-break bridge test so ordinary edits preserve, rather than author or clear, stable-key break ownership. | fixed |  | 2026-08-10T08:14:54.920Z | 2026-08-10T08:15:01.785Z |
| 36 | 43.1 | deviation | .planning/STATE.md |  | Reconciled Plan 10 progress percentage, latest activity, decision labels, and next action after generic state handlers wrote stale metadata. | fixed |  | 2026-08-10T08:17:20.229Z | 2026-08-10T08:17:28.221Z |
| 37 | 43.1 | deviation | .planning/STATE.md |  | Reconciled generated Plan 11 progress, activity, decision labels, and next-action metadata. | fixed |  | 2026-08-10T10:48:22.939Z | 2026-08-10T10:48:54.748Z |
| 38 | 43.2 | stub | app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts | 389 | Wave 0 controlled markers keep canonical revision and project equality unsupported until the production schema cutover | open |  | 2026-08-11T02:45:01.220Z |  |
| 39 | 43.2 | stub | app/src/lib/physicPaintPersistence.test.ts | 300 | Wave 0 controlled markers keep Group lifecycle fields unsupported at save/reopen until the production schema cutover | open |  | 2026-08-11T02:45:01.302Z |  |
| 40 | 43.2 | stub | app/src/types/physicPaint.test.ts | 305 | Wave 0 controlled markers keep Group lifecycle fields unsupported in physical transport until the production schema cutover | open |  | 2026-08-11T02:45:01.385Z |  |
| 41 | 43.2 | stub | app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts | 191 | Wave 0 controlled markers keep Group lifecycle fields ignored by history equality until the production schema cutover | open |  | 2026-08-11T02:45:01.469Z |  |
| 42 | 43.2 | deviation | .planning/STATE.md |  | Reconciled stale Plan 43.2-01 progress percentage, activity, and Current Position metadata after generic state handlers wrote contradictory values | fixed |  | 2026-08-11T02:48:16.498Z | 2026-08-11T02:48:42.796Z |
| 43 | 43.2 | stub | app/src/lib/physicPaintBridge.test.ts | 2108 | The production-cutover-pending result deliberately keeps lifecycle proposal acceptance test-only until the later canonical production cutover. | open |  | 2026-08-11T02:58:41.370Z |  |
| 44 | 43.2 | skipped-test | app/src/lib/physicPaintBridge.test.ts | 1860 | Pre-existing skipped native close-window test remains outside Plan 43.2-02. | open |  | 2026-08-11T02:58:41.449Z |  |
| 45 | 43.2 | deviation | .planning/STATE.md |  | Reconciled stale generated progress percentage and last-activity metadata after Plan 43.2-02. | open |  | 2026-08-11T02:59:29.105Z |  |
| 46 | 43.2 | stub | .planning/phases/43.2-motion-and-static-group-stabilization-and-action-lifecycle-u/43.2-UAT.md | 5 | Wave 0 UAT rows intentionally retain Plan 17 observation and evidence sentinels until frozen-session native acceptance | open |  | 2026-08-11T03:07:49.461Z |  |
| 47 | 43.2 | deviation | app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts |  | Updated accepted settlement fixtures to echo exact project authority after lease propagation. | fixed |  | 2026-08-11T06:49:05.439Z | 2026-08-11T06:49:38.327Z |
| 48 | 43.2 | deviation | app/src/lib/physicPaintBridge.test.ts |  | Updated accepted bridge fixtures to acquire and release exact canonical lease tokens. | fixed |  | 2026-08-11T06:49:05.521Z | 2026-08-11T06:49:38.410Z |
| 49 | 43.2 | deviation | app/src/lib/physicPaintBridge.ts |  | Extended the closed bridge token parser to validate exclusive and recovery ownership. | fixed |  | 2026-08-11T06:49:05.605Z | 2026-08-11T06:49:38.494Z |
| 50 | 43.2 | deviation | app/src/components/physic-paint/physicsPaintStudio.css |  | Added omitted UI-SPEC geometry required for the Group Delete dialog. | fixed |  | 2026-08-11T08:30:14.260Z | 2026-08-11T08:31:21.055Z |
| 51 | 43.2 | deviation | app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts |  | Corrected only-occurrence Delete Frame to remove the complete Group. | fixed |  | 2026-08-11T08:30:14.337Z | 2026-08-11T08:31:21.136Z |
| 52 | 43.2 | stub | app/src-tauri/src/services/script_library.rs | 510 | Undo transaction commit intentionally fails closed until Plan 19 supplies retained Action bytes and integrity authority | fixed |  | 2026-08-11T09:33:23.787Z | 2026-08-11T09:59:04.142Z |
| 53 | 43.2 | deviation | app/src-tauri/src/services/script_library.rs |  | Released Action history command ID/generation identities are closed against reuse | fixed |  | 2026-08-11T09:58:35.353Z | 2026-08-11T09:58:59.526Z |
| 54 | 43.2 | deviation | app/src/types/physicPaint.test.ts |  | Corrected Action transaction fixtures to canonical UUID v4 tokens | fixed |  | 2026-08-11T10:18:29.203Z | 2026-08-11T10:18:56.986Z |
| 55 | 43.2 | deviation | app/src/types/physicPaint.ts |  | Added persisted acknowledged receipt validation for transaction status | fixed |  | 2026-08-11T10:18:29.282Z | 2026-08-11T10:18:57.062Z |
| 56 | 43.2 | deviation | .planning/STATE.md |  | Corrected out-of-order plan position and progress after state handler advancement | fixed |  | 2026-08-11T10:18:29.355Z | 2026-08-11T10:18:57.147Z |
| 57 | 43.2 | skipped-test | app/src/lib/physicPaintBridge.test.ts | 1997 | Pre-existing native window close-save listener test remains skipped and is unrelated to referenced Action replay. | open |  | 2026-08-11T11:27:09.939Z |  |
| 58 | 43.2 | deviation | .planning/STATE.md |  | Corrected out-of-order Plan 20 state advancement so the next executable position remains Plan 13 and progress stays 92 percent | fixed |  | 2026-08-11T11:33:31.640Z | 2026-08-11T11:33:31.793Z |
| 59 | 43.2 | deviation | app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx |  | Added the visible Actions tab rename required to complete the canonical product vocabulary. | fixed |  | 2026-08-11T12:47:34.636Z | 2026-08-11T12:48:39.440Z |
| 60 | 43.2 | deviation | app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx |  | Forwarded accepted passive Action linkage to the existing Group Rail halo inputs. | fixed |  | 2026-08-11T12:47:34.722Z | 2026-08-11T12:51:09.300Z |
| 61 | 43.2 | deviation | app/src/components/physic-paint/physicsPaintStudio.css |  | Added scoped linked Group navigation presentation and endpoint disabled styles. | fixed |  | 2026-08-11T12:47:34.814Z | 2026-08-11T12:51:09.670Z |
| 62 | 43.2 | deviation | app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx |  | Updated stale rail ownership tracer expectations after the canonical terminology cutover. | fixed |  | 2026-08-11T12:47:34.900Z | 2026-08-11T12:51:10.023Z |
| 63 | 43.2 | deviation | .planning/STATE.md |  | Skipped state.advance-plan to preserve blocked Plan 43.2-17 while completing out-of-order gap Plan 43.2-21. | fixed |  | 2026-08-11T17:30:56.351Z | 2026-08-11T17:32:28.720Z |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "36.14",
    "file": "app/src/lib/physicPaintBridge.ts",
    "line": null,
    "description": "Valid physical failures now use the exact parent acknowledgement shape.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-22T10:48:07.831Z",
    "resolved_at": "2026-07-22T10:53:08.172Z"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "36.14",
    "file": "app/src/lib/physicPaintBridge.ts",
    "line": null,
    "description": "Complete physical-map edits bypass the legacy generated display mutation guard and use authoritative semantic validation.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-22T10:48:07.922Z",
    "resolved_at": "2026-07-22T10:53:08.534Z"
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "36.14",
    "file": "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts",
    "line": null,
    "description": "Malformed resolver intents are rejected before reading their discriminator.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-22T10:48:08.016Z",
    "resolved_at": "2026-07-22T10:53:08.869Z"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "36.14",
    "file": ".planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-11-SUMMARY.md",
    "line": null,
    "description": "Compile proof deferred to Plan 13 after byte-exact native UAT approval",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-22T13:56:41.272Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "36.14",
    "file": ".planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-11-SUMMARY.md",
    "line": null,
    "description": "Build did not run because the chained typecheck failed on obsolete pre-UAT Script tests",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-22T13:56:41.382Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "36.14",
    "file": "app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts",
    "line": 21,
    "description": "Plan 23 hydration became asynchronous, so the existing launch replacement owner was updated to await the canonical PNG publication barrier.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-24T06:23:36.118Z",
    "resolved_at": "2026-07-24T06:25:00.079Z"
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "36.14",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected stale latest-activity text and mismatched prose completed-plan count after Plan 22 state update",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-24T07:33:38.997Z",
    "resolved_at": "2026-07-24T07:34:22.331Z"
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "36.14",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected stale Plan 22 activity, Plan 28 next action, and 111-plan prose count left by state handlers after Plan 25 closure",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-24T07:53:03.816Z",
    "resolved_at": "2026-07-24T07:54:09.840Z"
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "36.14",
    "file": "app/src/types/physicPaint.ts",
    "line": 739,
    "description": "The active apply-payload allowlist omitted the valid play-script physical operation.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-24T09:36:17.277Z",
    "resolved_at": "2026-07-24T09:37:35.662Z"
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "36.14",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected stale Plan 25 activity, Plan 26 next action, and 112-plan prose count after the non-linear Plan 26 state update.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-24T09:40:48.530Z",
    "resolved_at": "2026-07-24T09:41:05.837Z"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "36.14",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected stale non-linear recovery position after generic state advancement",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-24T09:56:45.875Z",
    "resolved_at": "2026-07-24T09:57:16.430Z"
  },
  {
    "id": 12,
    "kind": "stub",
    "phase": "36.15",
    "file": "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx",
    "line": null,
    "description": "Intentional empty flex-1 capsule slot (.physics-paint-header-capsule-slot); resolved by Plan 05 status capsule",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-25T18:41:27.754Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "38",
    "file": ".planning/phases/38-multi-copy-paste-and-tooltip-polish/38-01-PLAN.md",
    "line": null,
    "description": "38-01 verify block: Studio port grep expectations (==1 whole-file) contradict action text; verified scoped to keyUtilities block instead",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-27T14:40:22.046Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "38.1",
    "file": "app/src/components/physic-paint/PhysicsPaintStudio.tsx",
    "line": null,
    "description": "Deferred follow-up: right color sidebar + left tool rail visibly re-render on timeline navigation; user wants navigation UI updates localized to the timeline",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-28T05:55:05.652Z",
    "resolved_at": "2026-07-28T17:51:37.769Z"
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "38.1",
    "file": "app/src/components/physic-paint",
    "line": null,
    "description": "Deferred follow-up: plain mouse wheel does not scroll the timeline horizontally (shift+wheel required); bottom action toolbar also needs working horizontal scroll",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-28T05:55:05.768Z",
    "resolved_at": null
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "38.1",
    "file": "app/src/components/physic-paint/PhysicsPaintStudio.test.ts",
    "line": null,
    "description": "Task 1 source contract initially scanned a following comment and was narrowed to the actual dependency list.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-28T17:22:23.472Z",
    "resolved_at": "2026-07-28T17:51:37.894Z"
  },
  {
    "id": 17,
    "kind": "unrun-verify",
    "phase": "38.1",
    "file": ".planning/phases/38.1-studio-render-path-performance/38.1-09-SUMMARY.md",
    "line": null,
    "description": "Plan 09 forward/reverse native five-counter verification is pending user-owned runtime capture.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-28T17:22:23.916Z",
    "resolved_at": "2026-07-28T17:51:38.030Z"
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "38.1",
    "file": "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts",
    "line": 81,
    "description": "Updated stale Plan 09 Play Script dialog mount assertion so the Plan 10 full-suite gate matches the approved memo wrapper.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-28T18:37:11.200Z",
    "resolved_at": "2026-07-28T18:38:16.745Z"
  },
  {
    "id": 19,
    "kind": "deviation",
    "phase": "38.1",
    "file": ".planning/phases/38.1-studio-render-path-performance/38.1-12-SUMMARY.md",
    "line": null,
    "description": "User authorized grouped bidirectional native thresholds instead of raw forward/reverse delta-object transcription; no telemetry was fabricated",
    "status": "waived",
    "reason": "User explicitly authorized grouped bidirectional thresholds as the acceptance record and waived raw delta-object transcription.",
    "recorded_at": "2026-07-28T19:42:16.957Z",
    "resolved_at": "2026-07-28T19:44:03.132Z"
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "38.1",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected stale Plan 11 prose and inconsistent completion percentage left by generic state handlers after Plan 12 closure",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-28T19:45:06.908Z",
    "resolved_at": "2026-07-28T19:45:07.070Z"
  },
  {
    "id": 21,
    "kind": "deviation",
    "phase": "38.1",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected stale sequential state position after the generic advance handler",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-29T06:18:59.408Z",
    "resolved_at": "2026-07-29T06:20:12.940Z"
  },
  {
    "id": 22,
    "kind": "deviation",
    "phase": "38.1",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected inconsistent generated STATE.md progress and next-plan fields after Plan 38.1-16",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-29T06:51:59.691Z",
    "resolved_at": "2026-07-29T06:54:21.095Z"
  },
  {
    "id": 23,
    "kind": "deviation",
    "phase": "38.1",
    "file": "app/src/test/preactHookRuntime.ts",
    "line": null,
    "description": "Adjusted the test runtime to the app TypeScript target and removed one unused GREEN-test binding after the no-emit gate.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-29T08:08:16.664Z",
    "resolved_at": "2026-07-29T08:09:04.219Z"
  },
  {
    "id": 24,
    "kind": "deviation",
    "phase": "38",
    "file": "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts",
    "line": null,
    "description": "Rewrote omitted stale header-tooltip assertion against the region-driven fixed-position contract",
    "status": "fixed",
    "reason": "Verified by the focused 63-test file and full Phase 38 closing suite.",
    "recorded_at": "2026-07-29T16:15:36.790Z",
    "resolved_at": "2026-07-29T16:15:38.053Z"
  },
  {
    "id": 25,
    "kind": "deviation",
    "phase": "38",
    "file": "app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts",
    "line": null,
    "description": "Applied the user-approved flat #62666d tooltip visual over stale plan wording",
    "status": "fixed",
    "reason": "Verified by the focused 9-test file and full Phase 38 closing suite.",
    "recorded_at": "2026-07-29T16:15:36.934Z",
    "resolved_at": "2026-07-29T16:15:38.053Z"
  },
  {
    "id": 26,
    "kind": "unrun-verify",
    "phase": "quick-260801-jun",
    "file": "app/src-tauri/src/services/project_io.rs",
    "line": null,
    "description": "Pre-existing cargo test lib-test compile failure (stale roto field names); verification battery item 5 red",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-01T13:41:39.096Z",
    "resolved_at": null
  },
  {
    "id": 27,
    "kind": "deviation",
    "phase": "41",
    "file": "app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts",
    "line": null,
    "description": "41-04 deviation: revisioned-update restart decision moved after prepare await (toggle race serialization)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-04T22:36:07.192Z",
    "resolved_at": null
  },
  {
    "id": 28,
    "kind": "unmet-truth",
    "phase": "43",
    "file": "app/src/viteBuild.test.ts",
    "line": 184,
    "description": "Pre-existing main desktop chunk exceeds the locked 1100 kB warning budget (1,112.66 kB at pre-GREEN baseline 02fa699d).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-07T11:01:42.037Z",
    "resolved_at": null
  },
  {
    "id": 29,
    "kind": "deviation",
    "phase": "43.1",
    "file": "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts",
    "line": null,
    "description": "Inherited break lifecycle behaviors were characterized green instead of forcing artificial RED failures",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T15:05:02.967Z",
    "resolved_at": null
  },
  {
    "id": 30,
    "kind": "deviation",
    "phase": "43.1",
    "file": "app/src/stores/physicPaintStore.rotoPhysicalStructuralCache.test.ts",
    "line": null,
    "description": "Structural cache test and projection threading landed in the same atomic commit",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T15:05:03.053Z",
    "resolved_at": null
  },
  {
    "id": 31,
    "kind": "deviation",
    "phase": "43.1",
    "file": "app/src/components/physic-paint/PhysicsPaintStudio.tsx",
    "line": null,
    "description": "Accepted break ownership wiring was added outside the plan's listed Task 2 files so the live strip receives canonical state.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T16:51:31.383Z",
    "resolved_at": null
  },
  {
    "id": 32,
    "kind": "deviation",
    "phase": "43.1",
    "file": "app/src/lib/physicPaintPersistence.ts",
    "line": null,
    "description": "Cleared memoized save authority when empty-output cleanup removes the canonical Physics Paint cache.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-10T06:36:00.210Z",
    "resolved_at": null
  },
  {
    "id": 33,
    "kind": "deviation",
    "phase": "43.1",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "state.update-progress reported 90% but wrote progress.percent 57; closeout reconciled STATE metadata",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T06:55:25.047Z",
    "resolved_at": "2026-08-10T06:56:05.035Z"
  },
  {
    "id": 34,
    "kind": "deviation",
    "phase": "43.1",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected inconsistent generated Plan 09 progress, activity, and decision metadata",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T07:42:52.621Z",
    "resolved_at": "2026-08-10T07:43:54.828Z"
  },
  {
    "id": 35,
    "kind": "deviation",
    "phase": "43.1",
    "file": "app/src/lib/physicPaintBridge.test.ts",
    "line": 879,
    "description": "Updated the legacy incoming-break bridge test so ordinary edits preserve, rather than author or clear, stable-key break ownership.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T08:14:54.920Z",
    "resolved_at": "2026-08-10T08:15:01.785Z"
  },
  {
    "id": 36,
    "kind": "deviation",
    "phase": "43.1",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Reconciled Plan 10 progress percentage, latest activity, decision labels, and next action after generic state handlers wrote stale metadata.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T08:17:20.229Z",
    "resolved_at": "2026-08-10T08:17:28.221Z"
  },
  {
    "id": 37,
    "kind": "deviation",
    "phase": "43.1",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Reconciled generated Plan 11 progress, activity, decision labels, and next-action metadata.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T10:48:22.939Z",
    "resolved_at": "2026-08-10T10:48:54.748Z"
  },
  {
    "id": 38,
    "kind": "stub",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts",
    "line": 389,
    "description": "Wave 0 controlled markers keep canonical revision and project equality unsupported until the production schema cutover",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:45:01.220Z",
    "resolved_at": null
  },
  {
    "id": 39,
    "kind": "stub",
    "phase": "43.2",
    "file": "app/src/lib/physicPaintPersistence.test.ts",
    "line": 300,
    "description": "Wave 0 controlled markers keep Group lifecycle fields unsupported at save/reopen until the production schema cutover",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:45:01.302Z",
    "resolved_at": null
  },
  {
    "id": 40,
    "kind": "stub",
    "phase": "43.2",
    "file": "app/src/types/physicPaint.test.ts",
    "line": 305,
    "description": "Wave 0 controlled markers keep Group lifecycle fields unsupported in physical transport until the production schema cutover",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:45:01.385Z",
    "resolved_at": null
  },
  {
    "id": 41,
    "kind": "stub",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts",
    "line": 191,
    "description": "Wave 0 controlled markers keep Group lifecycle fields ignored by history equality until the production schema cutover",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:45:01.469Z",
    "resolved_at": null
  },
  {
    "id": 42,
    "kind": "deviation",
    "phase": "43.2",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Reconciled stale Plan 43.2-01 progress percentage, activity, and Current Position metadata after generic state handlers wrote contradictory values",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T02:48:16.498Z",
    "resolved_at": "2026-08-11T02:48:42.796Z"
  },
  {
    "id": 43,
    "kind": "stub",
    "phase": "43.2",
    "file": "app/src/lib/physicPaintBridge.test.ts",
    "line": 2108,
    "description": "The production-cutover-pending result deliberately keeps lifecycle proposal acceptance test-only until the later canonical production cutover.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:58:41.370Z",
    "resolved_at": null
  },
  {
    "id": 44,
    "kind": "skipped-test",
    "phase": "43.2",
    "file": "app/src/lib/physicPaintBridge.test.ts",
    "line": 1860,
    "description": "Pre-existing skipped native close-window test remains outside Plan 43.2-02.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:58:41.449Z",
    "resolved_at": null
  },
  {
    "id": 45,
    "kind": "deviation",
    "phase": "43.2",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Reconciled stale generated progress percentage and last-activity metadata after Plan 43.2-02.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:59:29.105Z",
    "resolved_at": null
  },
  {
    "id": 46,
    "kind": "stub",
    "phase": "43.2",
    "file": ".planning/phases/43.2-motion-and-static-group-stabilization-and-action-lifecycle-u/43.2-UAT.md",
    "line": 5,
    "description": "Wave 0 UAT rows intentionally retain Plan 17 observation and evidence sentinels until frozen-session native acceptance",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T03:07:49.461Z",
    "resolved_at": null
  },
  {
    "id": 47,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts",
    "line": null,
    "description": "Updated accepted settlement fixtures to echo exact project authority after lease propagation.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T06:49:05.439Z",
    "resolved_at": "2026-08-11T06:49:38.327Z"
  },
  {
    "id": 48,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/lib/physicPaintBridge.test.ts",
    "line": null,
    "description": "Updated accepted bridge fixtures to acquire and release exact canonical lease tokens.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T06:49:05.521Z",
    "resolved_at": "2026-08-11T06:49:38.410Z"
  },
  {
    "id": 49,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/lib/physicPaintBridge.ts",
    "line": null,
    "description": "Extended the closed bridge token parser to validate exclusive and recovery ownership.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T06:49:05.605Z",
    "resolved_at": "2026-08-11T06:49:38.494Z"
  },
  {
    "id": 50,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/physicsPaintStudio.css",
    "line": null,
    "description": "Added omitted UI-SPEC geometry required for the Group Delete dialog.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T08:30:14.260Z",
    "resolved_at": "2026-08-11T08:31:21.055Z"
  },
  {
    "id": 51,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts",
    "line": null,
    "description": "Corrected only-occurrence Delete Frame to remove the complete Group.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T08:30:14.337Z",
    "resolved_at": "2026-08-11T08:31:21.136Z"
  },
  {
    "id": 52,
    "kind": "stub",
    "phase": "43.2",
    "file": "app/src-tauri/src/services/script_library.rs",
    "line": 510,
    "description": "Undo transaction commit intentionally fails closed until Plan 19 supplies retained Action bytes and integrity authority",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T09:33:23.787Z",
    "resolved_at": "2026-08-11T09:59:04.142Z"
  },
  {
    "id": 53,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src-tauri/src/services/script_library.rs",
    "line": null,
    "description": "Released Action history command ID/generation identities are closed against reuse",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T09:58:35.353Z",
    "resolved_at": "2026-08-11T09:58:59.526Z"
  },
  {
    "id": 54,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/types/physicPaint.test.ts",
    "line": null,
    "description": "Corrected Action transaction fixtures to canonical UUID v4 tokens",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T10:18:29.203Z",
    "resolved_at": "2026-08-11T10:18:56.986Z"
  },
  {
    "id": 55,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/types/physicPaint.ts",
    "line": null,
    "description": "Added persisted acknowledged receipt validation for transaction status",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T10:18:29.282Z",
    "resolved_at": "2026-08-11T10:18:57.062Z"
  },
  {
    "id": 56,
    "kind": "deviation",
    "phase": "43.2",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected out-of-order plan position and progress after state handler advancement",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T10:18:29.355Z",
    "resolved_at": "2026-08-11T10:18:57.147Z"
  },
  {
    "id": 57,
    "kind": "skipped-test",
    "phase": "43.2",
    "file": "app/src/lib/physicPaintBridge.test.ts",
    "line": 1997,
    "description": "Pre-existing native window close-save listener test remains skipped and is unrelated to referenced Action replay.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T11:27:09.939Z",
    "resolved_at": null
  },
  {
    "id": 58,
    "kind": "deviation",
    "phase": "43.2",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Corrected out-of-order Plan 20 state advancement so the next executable position remains Plan 13 and progress stays 92 percent",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T11:33:31.640Z",
    "resolved_at": "2026-08-11T11:33:31.793Z"
  },
  {
    "id": 59,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx",
    "line": null,
    "description": "Added the visible Actions tab rename required to complete the canonical product vocabulary.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T12:47:34.636Z",
    "resolved_at": "2026-08-11T12:48:39.440Z"
  },
  {
    "id": 60,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx",
    "line": null,
    "description": "Forwarded accepted passive Action linkage to the existing Group Rail halo inputs.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T12:47:34.722Z",
    "resolved_at": "2026-08-11T12:51:09.300Z"
  },
  {
    "id": 61,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/physicsPaintStudio.css",
    "line": null,
    "description": "Added scoped linked Group navigation presentation and endpoint disabled styles.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T12:47:34.814Z",
    "resolved_at": "2026-08-11T12:51:09.670Z"
  },
  {
    "id": 62,
    "kind": "deviation",
    "phase": "43.2",
    "file": "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx",
    "line": null,
    "description": "Updated stale rail ownership tracer expectations after the canonical terminology cutover.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T12:47:34.900Z",
    "resolved_at": "2026-08-11T12:51:10.023Z"
  },
  {
    "id": 63,
    "kind": "deviation",
    "phase": "43.2",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Skipped state.advance-plan to preserve blocked Plan 43.2-17 while completing out-of-order gap Plan 43.2-21.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T17:30:56.351Z",
    "resolved_at": "2026-08-11T17:32:28.720Z"
  }
]
````
