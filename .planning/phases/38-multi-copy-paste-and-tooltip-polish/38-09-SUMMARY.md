---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 09
subsystem: ui
tags: [physics-paint, roto, tooltip, placement, preact, gap-closure]

requires:
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 05
    provides: computeTooltipPlacement pure utility + fixed-in-place viewport mechanism + direction modifiers + notch custom properties (UAT-locked)
provides:
  - "computeTooltipPlacement optional 4th parameter rowObstacles (readonly rect-like structural type, not DOMRect) — node-testable collision input; 3-arg calls return byte-identical pre-change results"
  - "Row-collision flip ordering contract: preferred direction -> room flip -> NEW collision flip to 'above' (then 'below' on insufficient vertical room; documented side-direction last resort) -> clamp + notchOffset math unchanged (D-13)"
  - "PhysicsPaintStyledTooltip opt-in avoidRowOverlap prop: layout effect collects same-row sibling rects (vertical-band intersection) only when enabled; absent/false keeps the exact 3-arg call for the 12 strip mounts"
  - "All 3 PhysicsPaintScriptsPanel right-edge mounts (Copy/Apply/Clear) opted in — the Clear guarded-reason pill no longer masks the Copy/Apply buttons (38.1-06 run-1 item E)"
affects: [38-06 native UAT re-run, 38-08 post-UAT tooltip regression tests]

tech-stack:
  added: []
  patterns:
    - "Obstacle collection at the caller, purity in the math: the layout effect reads sibling getBoundingClientRect() values and filters to the anchor's vertical band; the pure function only receives plain rect-like objects so the D-15 node-testability contract for 38-08 is preserved"
    - "Opt-in behavior extension with byte-identical default: the 4th parameter defaults undefined and the prop defaults false, so all pre-existing mounts compute exactly the pre-change placement for identical inputs (proven by hardcoded expected numbers)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx

key-decisions:
  - "Flip ordering (D-11 row refinement): collision check runs AFTER preferred-direction and room-flip resolution and BEFORE left/top computation, only when the resolved direction is a side direction; on collision 'above' is preferred for bottom-row controls, 'below' is the vertical fallback, and keeping the side direction under the viewport clamp is the documented last resort"
  - "Candidate collision band is the pre-clamp side placement rect at the anchor's vertical center using TOOLTIP_NOTCH_GAP — AABB-intersected against each obstacle; the pure function's AABB test is its own guard even if a caller forgets the vertical-band pre-filter"
  - "Tracer feedback gate resolved as automated per the 38-01/38-02/38-04/38-05 precedent: plan frontmatter autonomous:true, no checkpoint tasks, fully automated <verify> gates re-run green after the tracer commit before expansion; native visual UAT owned by the 38-06 re-run (D-15)"

requirements-completed: [38-TOOLTIP-VIEWPORT-PLACEMENT]

coverage:
  - id: D1
    description: "Row-collision flip: side-direction pill band overlapping a same-row sibling flips to 'above' with anchor-tracked notch; baseline/other-mount behavior byte-identical"
    requirement: 38-TOOLTIP-VIEWPORT-PLACEMENT
    verification:
      - kind: other
        ref: "node /tmp/38-09-placement-check.mjs (ephemeral esbuild-bundle gate: baseline byte-identity, collision flip, non-row guard, empty-equivalence — 8 assertions pass)"
        status: pass
      - kind: other
        ref: "pnpm --dir app typecheck"
        status: pass
    human_judgment: true
    rationale: "Visual confirmation that the Clear guarded-reason pill no longer masks Copy/Apply is native-UAT-only per D-15; owned by the 38-06 re-run (flag the Clear-button masking scenario explicitly in its handoff)"

metrics:
  duration: 4min
  tasks: 2
  files: 2
  completed: 2026-07-28

status: complete
---

# Phase 38 Plan 09: Tooltip Row-Placement Flip Summary

Closes the row-placement defect (38.1-06 run-1 item E): the scripts panel bottom-row right-edge mounts rendered their guarded-reason pills to the left, vertically centered on the anchor — covering the sibling Copy/Apply/Clear buttons in the same toolbar row. The shared pure placement contract now flips a colliding side-direction band to 'above' while the 38-05 locked mechanism (fixed-in-place, no portal, notch tracking, 8px clamp, controller) stays provably untouched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | Row-collision branch in computeTooltipPlacement + opt-in avoidRowOverlap prop + Clear mount, proven end-to-end | 94058dbe | PhysicsPaintStyledTooltip.tsx, PhysicsPaintScriptsPanel.tsx |
| 2 | Copy/Apply mounts converted + final locked-mechanism sweeps | a0c71ef7 | PhysicsPaintScriptsPanel.tsx |

## Flip-Ordering Contract (recorded for 38-06 / 38-08)

1. Preferred direction from region (opposite-of-region, D-11).
2. Existing room flip to the opposite direction when the preferred side lacks viewport room.
3. **NEW** collision flip: when the resolved direction is 'left'/'right' and `rowObstacles` was provided and at least one obstacle AABB-intersects the pre-clamp candidate side band (at the anchor's vertical center, using the 6px notch gap), recompute with 'above'; if above lacks room use 'below'; if below also lacks room keep the side direction as the documented last resort and let the clamp handle it.
4. Existing left/top computation, 8px viewport clamp, and post-clamp notchOffset anchor-center tracking — untouched, so the notch follows the flip automatically (D-13).

## Byte-Identity Evidence

Ephemeral gate `/tmp/38-09-placement-check.mjs` (esbuild-bundles the real component via a virtual entry; stubs `window.innerWidth/innerHeight` = 1440x900; NOT a repo artifact, NOT a test file — D-15-safe):

- **(a) Baseline:** 3-arg call, anchor {1200,300,60x26}, region right-edge, pill 280x40 -> direction 'left', left 914, top 293 (hand-derived from the pre-change algorithm).
- **(b) Collision:** same call + same-row obstacle {1120..1194 x 300..326} -> direction 'above', top 254, notchOffset = 1230 - left (anchor center X projection, D-13).
- **(c) Non-row obstacle:** obstacle at top 600/bottom 626 -> identical object to (a) — the pure function's AABB test is its own guard.
- **(d) Equivalence:** 4th arg `[]` -> identical object to the 3-arg call.

All 8 assertions pass after both tasks.

## Verification Results

- Placement gate green after Task 1 and re-run green after Task 2.
- `pnpm --dir app typecheck` clean after each task.
- `avoidRowOverlap` count in PhysicsPaintScriptsPanel.tsx: 1 after Task 1, 3 after Task 2; `region="right-edge"` count = 3.
- Legacy ` placement="` attribute absent from both consumer files (count = 0).
- Controller byte-identical: zero changed lines mentioning `STYLED_TOOLTIP_DELAY_MS`, `escapeHandlerRef`, or `timerRef` in the component diff (D-14).
- Plan-scoped diff (`94058dbe~1..HEAD`) touches exactly the two `files_modified` entries; zero diff in physicsPaintStudio.css and PhysicsPaintWorkflowStrip.tsx; zero `*.test.*`/`*.spec.*` files created/modified/renamed/executed; no vitest invocation anywhere (D-15).
- Threat register carried forward: tooltip content remains Preact text children (T-38-09-01/T-38-04); guarded aria-describedby wiring untouched at every mount (T-38-09-02/T-38-05).

State is **automated-ready** — native visual UAT is owned by the 38-06 re-run; flag the Clear-button masking scenario explicitly in the 38-06 SUMMARY handoff.

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None — all three mounts render live controller-supplied guarded-reason copy through the shared computation.

## Threat Flags

None — placement math and DOM-rect reads only; no new network endpoints, auth paths, file access, or trust-boundary schema changes.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
- FOUND: commit 94058dbe (Task 1 tracer)
- FOUND: commit a0c71ef7 (Task 2)
