---
schema_version: 1
open_count: 11
waived_count: 1
fixed_count: 19
total_count: 31
last_updated: 2026-08-09T16:51:31.383Z
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
  }
]
````
