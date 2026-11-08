---
phase: quick-261108-kvw
plan: 261108-kvw
subsystem: ui
tags: [rail-motion, physic-paint, canvas-overlay, signals, v2.1.0]
status: complete

requires: []
provides:
  - "Read-only authored Position route on the canvas while editing Motion in ANIMATE mode: dashed 1.5px polyline, one dot per surviving position key frame, one distinct cursor marker"
  - "Pure sampler railMotionPath.ts: wiggle-zeroed probe, evaluator-only sampling, hard 2000-sample cap with the tail always present, one-entry bundle cache"
  - "Cursor-free railMotionPath computed plus cursor-owned railMotionPathCursor computed on useRotoTimelineActions"
affects: [physic-paint-studio-canvas, rail-motion-gizmo, useRotoTimelineActions]

actuals:
  tokens: 120054
  tasks: 3
  commits: 3
plan_head_before: 0e19eb0f9
plan_head_after: 4893ee9ee

tech-stack:
  added: []
  patterns:
    - "Derived canvas visualization samples the ONE evaluator through a frozen wiggle-zeroed probe — no schema, no store writer, no command"
    - "Static route geometry cached on the bundle reference; only the cursor marker recomputes per scrub"

key-files:
  created:
    - app/src/components/physic-paint/roto/railMotionPath.ts
    - app/src/components/physic-paint/roto/railMotionPath.test.ts
    - app/src/components/physic-paint/view/RailMotionPathOverlay.tsx
    - app/src/components/physic-paint/view/RailMotionPathOverlay.test.ts
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx

key-decisions:
  - "Sample law is two-branch: authored frames (position keys + snap frames + span ends) outrank the grid; when the authored set alone exceeds 2000, deterministic even decimation keeps exactly 2000 with frame 0 and frameCount-1 always present"
  - "The path is the AUTHORED route: channel and per-key wiggle are zeroed in a frozen probe, so the polyline stays fixed while the box shakes"
  - "Origin placement mirrors getRailMotionBounds(...).center exactly: zoom * (pivot * projectSize + translate) — the handles' ONE canvas convention, no compositor matrix re-derivation"
  - "readActiveRailMotionState split into a cursor-free readActiveRailMotionContext plus the playhead addition; cursor semantics are byte-identical to before"
  - "Overlay renders FIRST inside the existing rail-motion SVG, behind the polygon and handles, pointer-events none on the group and every child"
  - "Snap-accessor source pin moves 6 -> 7 deliberately for the new path sampler read; the single evaluateRailMotion( occurrence in the hook is unchanged"

patterns-established:
  - "Canvas derived overlays: pure model module + hooks-free leaf + one memoized computed, static geometry cached by reference"

requirements-completed: []

coverage:
  - id: KVW-1
    description: "Authored route polyline, key dots and cursor marker render inside the rail-motion SVG with pointer-events none"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/RailMotionPathOverlay.test.ts (8 tests)"
  - id: KVW-2
    description: "Sampling: integer stride grid + every position key frame + every snap frame, deduped/sorted, hard cap 2000, tail always present, wiggle-neutral"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionPath.test.ts (14 tests)"
  - id: KVW-3
    description: "Static path computed never reads the playhead; only the cursor computed reads getCurrentAppFrame; hide rules return null"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#261108-kvw canvas motion path + source contract"

key-decisions-deviations: []

gates:
  typecheck: "pnpm --filter efx-motion-editor run typecheck — PASS"
  full-suite: "pnpm --filter efx-motion-editor exec vitest run — 403 files passed / 2 skipped; 8222 tests passed, 1 skipped, 96 todo — PASS"
  targeted: "railMotionPath.test.ts 14/14, RailMotionPathOverlay.test.ts 8/8 — PASS"

uat_pending:
  - "Animate Position 0 -> 100, linear: dashed path start-to-end, dots on the two keys, marker at the playhead"
  - "Ease on X, linear on Y: the path curves"
  - "Stop-motion: the path steps at the paint keys it steps at on canvas"
  - "Wiggle on: the path stays put while the box shakes"
  - "The overlay never blocks painting, key dragging or handle dragging"
  - "Deselect the rail / leave animate mode: the path disappears and nothing else changes"
---

# Quick Task 261108-kvw — Canvas motion-path overlay for rail Position

## What shipped

A read-only dashed path of the selected rail's authored Position route, drawn on the canvas inside the existing rail-motion transform-handle SVG while Motion is edited in ANIMATE mode.

- **`roto/railMotionPath.ts`** — pure sampler. `zeroRailMotionWiggle` builds the authored probe; `sampleRailMotionPath` collects integer stride frames plus every position key frame and every stop-motion snap frame (deduped, sorted), samples each through `evaluateRailMotion`, and returns null for no Position channel, span < 2 frames, or an identity route. `sampleRailMotionPathCached` is a one-entry identity cache keyed on record, rail, span, snap-list reference and pivot. `evaluateRailMotionPathCursor` derives the marker point; `placeRailMotionPathPoint` mirrors `getRailMotionBounds(...).center`; `buildRailMotionPathD` emits the polyline.
- **`view/RailMotionPathOverlay.tsx`** — hooks-free leaf. Shared `RAIL_MOTION_PATH_ACCENT` (#4A90D9) now also feeds the five existing handle literals. Static geometry (`d`, dots, radii, dash pattern) is cached on the bundle + canvas; only the marker recomputes.
- **`useRotoTimelineActions.ts`** — `readActiveRailMotionState` split into a cursor-free context read; new `railMotionPath` (never reads the playhead) and `railMotionPathCursor` (owns the one `getCurrentAppFrame` read) computeds.
- **`PhysicsPaintStudio.tsx`** — reads both computeds, adds the path signature to the canvas-stack memo deps, passes `motionPath`/`motionPathCursor` on the rail-motion envelope.
- **`PhysicsPaintReferenceTransformHandles.tsx`** — optional props, overlay rendered first inside the existing SVG, all accents from one constant.

## Guards honored

No draggable points, no bezier/tangent model, no schema/package/Rust/golden-fixture change, no new store setter/command/persisted field. Evaluator, easing laws, wiggle math, compositor transform, lane curve, snap-frame memo and pivot/ink geometry untouched. No `.test.tsx`. No dev server started; vitest run only.

## Note

The executor returned while the full suite was still running in its own background job. The orchestrator ran the gates itself (typecheck + full suite), committed Task 3, and wrote this SUMMARY; the plan was not deviated from.

## UAT

Pending — the six rows above are live-UAT only (visual rendering and pointer pass-through).
