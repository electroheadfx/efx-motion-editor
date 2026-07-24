---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 6
total_count: 8
last_updated: 2026-07-24T07:54:09.840Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
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
  }
]
````
