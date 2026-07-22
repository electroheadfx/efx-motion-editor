---
schema_version: 1
open_count: 0
waived_count: 0
fixed_count: 3
total_count: 3
last_updated: 2026-07-22T10:53:08.869Z
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
  }
]
````
