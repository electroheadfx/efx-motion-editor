---
phase: quick-261022-jq0
plan: 261022-jq0
subsystem: physic-paint/roto-playback
tags: [preact, signals, playback, rail-selection, range, studio-transport]

# Dependency graph
requires:
  - phase: quick-261022-iff
    provides: global Solo retired from the playback path; full composite enumeration restored
  - phase: 43.6
    provides: rail-set identities and the canonical cross-type ordering authority
provides:
  - fail-closed pure selection playback window derivation (range only)
  - hook-level Play enumeration scoping, window-start anchoring, and window-anchored loop wrap
  - Studio resolver mapping rail set / Key Rail / selected loop clips to one contiguous window
affects: [physic-paint-studio-playback, future transport scoping work]

actuals:
  tokens: 11104
  tasks: 2
  commits: 2

commits: 2
plan_head_before: f308d1e4b23509becb1e4d0bd3022a53f832f79d
plan_head_after: dad851ffe8f69a8e590111f8504c8efda6edd27a

tech-stack:
  added: []
  patterns:
    - "Selection scoping as a RANGE over the existing enumeration — resolve once at Play press, never a per-frame content filter"
    - "Fail-closed pure derivation as the trust boundary between stale selection authorities and playback"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoSelectionPlaybackWindow.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoSelectionPlaybackWindow.test.ts
  modified:
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts
    - app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The window is resolved ONCE at Play press; a mid-playback selection change never re-filters the running session."
  - "With a window, Play always anchors at the window start (never the cursor); without one, play-from-cursor is byte-identical."
  - "A mid-playback seek inside a window moves only the playhead — the loop-wrap anchor stays at the window start."
  - "Members come from effectiveRailSetSelection, otherwise the single Key Rail plus EVERY selected loop id (not the shared dynamic-scope classifier, which drops multi-loop selections)."
  - "The global Solo arm is never read by the resolver: Solo remains a composite-path track focus, not a playback scope."

patterns-established:
  - "Range-only playback scoping: filter the full enumeration at start(), never hide/re-attribute frames."
  - "Window session list held in a ref declared after all existing refs to keep white-box test indices stable."

requirements-completed: [JQ0-01, JQ0-02, JQ0-03]

coverage:
  - id: D1
    description: "Pure fail-closed selection window derivation (bounds, loop fragments, mixed members, clamps, frozen result)"
    requirement: JQ0-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoSelectionPlaybackWindow.test.ts#deriveRotoSelectionPlaybackWindow (JQ0 range derivation)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Play enumeration scoped to the window: window-start anchor, loop-off stop, loop-on wrap, read-once port, window-anchored seek, audio range end, no-window fallback"
    requirement: JQ0-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts#selected-rail playback window (JQ0)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts#playback enumeration seam (useRotoNavigationCoordinator getFrames)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Studio maps rail set / Key Rail / selected loop clips to the port and never consults the Solo arm"
    requirement: JQ0-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#supplies the rail-selection playback RANGE at Play press (261022-jq0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live UAT: a selected rail auditions its own start-to-end range in the Studio transport"
    verification: []
    human_judgment: true
    rationale: "Only a live Studio session proves the audible/visible transport behavior end-to-end; the work is automated-ready until these rows pass."

duration: 5min
completed: 2026-10-22
status: complete
---

# Quick 261022-jq0: Selected Rail Plays Its Full Range Summary

**Studio Play now auditions a selected Key Rail, Loop Clip, or rail set over its own contiguous [start, endExclusive) range, with a window-start anchor, window-start loop wrap, and a byte-identical full-timeline fallback when nothing is selected.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-22T12:38:00Z (approx.)
- **Completed:** 2026-10-22T12:43:04Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Added `deriveRotoSelectionPlaybackWindow`: a pure, frozen, fail-closed derivation joining rail-set members to Key Rail segments and loop ranges, clamped to the composite capacity.
- `useRotoCachedPlayback` reads the window port once per `start()` and scopes the session list; loop off stops at the window end, loop on wraps to the window start, and audio range end follows the session list.
- A mid-playback seek inside a window keeps the loop-wrap anchor at the window start; seeks outside the window stay silent re-anchors.
- `useRotoNavigationCoordinator` carries `getPlaybackWindow`; the Studio resolver maps the three existing selection authorities and never reads the Solo arm.
- The no-selection / failed-derivation path is unchanged: full composite enumeration, play-from-cursor, cursor-anchored wrap.

## Task Commits

Each task was committed atomically:

1. **Task 1: Selected-rail playback window — pure derivation and the Play enumeration seam** - `04c6488e` (feat)
2. **Task 2: Studio wiring, loop-clip and multi-rail laws, and the no-selection fallback** - `dad851ff` (feat)

## Files Created/Modified
- `app/src/components/physic-paint/roto/physicsPaintRotoSelectionPlaybackWindow.ts` - Pure fail-closed selection range derivation
- `app/src/components/physic-paint/roto/physicsPaintRotoSelectionPlaybackWindow.test.ts` - Bounds / fragments / clamp / frozen matrix
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` - Window resolution at Play press, session list, anchor and seek laws
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts` - Window hook matrix + coordinator seam
- `app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts` - `getPlaybackWindow` port pass-through
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `resolveRotoSelectionPlaybackWindow` + playback port entry
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Studio source pin for the resolver and port

## Decisions Made
- Window resolved once at Play press; later selection changes do not re-filter the session.
- Window start is both the Play anchor and the loop-wrap anchor, even after a mid-playback seek.
- Multi-loop selections contribute every selected loop id directly (the shared dynamic-scope classifier would collapse them).
- Range only: no cells, no attribution, no solo reads, no persistence/bridge/export involvement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The full app suite reports 5 failing tests in 4 files (`efxPaintCompositorMatrix.test.ts` rows 8/9, `exportEngine.test.ts` solo preflight, `paperPass.frameGuard.test.ts` P4(f), `PhysicsPaintWorkflowStrip.viewport.test.ts` header column). Verified these fail identically at the pre-task baseline `f308d1e4` — pre-existing and unrelated to this quick task.
- Typecheck: 16 pre-existing `error TS` lines, byte-identical before and after both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Automated-ready, NOT done. The three live UAT rows remain for the user (Studio transport):
1. Select a Key Rail (A), Play -> plays A's start-to-end.
2. Loop on -> loops to the selection start; Loop off -> stops at the selection end.
3. Nothing selected, Play -> full timeline.

Regression rows folded in: a selected Loop Clip plays its span; a multi-rail selection plays first selected rail start to last selected rail end with the intervening composite visible; the global Solo pill still only affects composite focus.

---
*Quick: 261022-jq0-selected-rail-plays-its-full-range*
*Completed: 2026-10-22*

## Self-Check: PASSED

- Created files exist: `physicsPaintRotoSelectionPlaybackWindow.ts`, its test file, and this SUMMARY.
- Task commits are ancestors of HEAD: `04c6488e`, `dad851ff`.
- Typecheck has no new `error TS` lines (16 before, 16 after).
- Full suite: no new failures (5 pre-existing failures verified at baseline `f308d1e4`).
