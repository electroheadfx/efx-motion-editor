---
phase: 261107-pd8-draggable-motion-key-from-phase-59-rail-
plan: 01
subsystem: ui
tags: [preact, motion-channels, timeline-rail, drag-gesture, pointer-session, tauri]

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: TimelineMotionChannelLane, the rail motion model/commands, the v7 motion design tokens
  - phase: key-rail-drag
    provides: usePhysicsPaintKeyRailDrag shared pointer session
provides:
  - a 'move-key' rail motion edit that moves one key (grouped Position moves both axes) without the D-15 cascade
  - moveMotionKey pure command with the standard failure/success sentences
  - clampRailMotionKeyDragFrame directional nearest-free clamp inside the rail band
  - RotoMotionKeyDragPublication with prepareMotionKeyDrag / commitMotionKeyDrag on the physical action bundle
  - TimelineMotionKeyDrag.tsx thin hook leaf reusing the shared drag session
  - lane keyDrag presentation (grab cursor, token-derived ghost, post-drop click suppression)
  - motionKeyDragPorts gating on the active block only
affects: [rail motion channels, timeline gestures, quick fixes on the Phase 59 surface]

# Actuals (#2632) — same chars/4 scale as the plan's estimate.
actuals:
  tokens: 18342
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Reuse the shared pointer session through ports; the leaf owns no listener"
    - "MOVE edit variant instead of remove+set to survive the D-15 cascade"
    - "Prepare never writes; commit re-derives from live records (one store door)"
    - "Pure presentational lane stays hook/store/DOM-free; presentation enters as an optional prop"

key-files:
  created:
    - app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx
  modified:
    - app/src/components/physic-paint/roto/railMotionModel.ts
    - app/src/components/physic-paint/roto/railMotionModel.test.ts
    - app/src/components/physic-paint/roto/railMotionCommands.ts
    - app/src/components/physic-paint/roto/railMotionCommands.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
    - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts

key-decisions:
  - "A dedicated 'move-key' edit, never remove+set: applyRemoveKeyEdit cascades key -> channel -> record (D-15) and would destroy a single-key channel."
  - "commitMotionKeyDrag re-reads live records and re-runs moveMotionKey; the prepared publication is never replayed, so a stale prepare cannot write."
  - "Exactly one store write per drop through commitRailMotionRecords (document-sync dirty + publish included)."
  - "The clamp stops on the nearest free frame in the travel direction and reports blockedEdge; the ghost paints that edge."
  - "The pure lane module stays hook-free: the drag session lives only in TimelineMotionKeyDrag.tsx, chosen by the row through the ports branch."
  - "Ports are gated on physicalActions + props.ready !== false + !props.mutationLocked, and only the active block receives them."

patterns-established:
  - "Motion-key drag: pointerdown arms {frame} -> shared session -> project by cellPitch -> clamp -> prepare -> ghost -> drop -> commit."

requirements-completed: [QUICK-261107-PD8]

coverage:
  - id: D1
    description: "A Motion key moves through the model and command layer: move-key edit, grouped Position lockstep, occupied/no-op/unknown-rail handling, directional nearest-free clamp"
    requirement: QUICK-261107-PD8
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#261107-pd8 move-key delete/move suite; app/src/components/physic-paint/roto/railMotionCommands.test.ts#move a Motion key + key drag clamp"
        status: pass
    human_judgment: false
  - id: D2
    description: "prepareMotionKeyDrag / commitMotionKeyDrag end-to-end through the action bundle: one store write, preserved value/easing/wiggle, failure sentences, stale-state guard, selection retarget"
    requirement: QUICK-261107-PD8
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#261107-pd8 Motion key drag transaction"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lane keyDrag presentation: grab cursor, pointerdown forwarding, token-derived ghost with blocked edge, suppressed post-drop click"
    requirement: QUICK-261107-PD8
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionChannelLane keyDrag presentation"
        status: pass
    human_judgment: false
  - id: D4
    description: "The drag leaf reuses the shared pointer session with no listener of its own; the pure lane module stays hook-free; the row selects the leaf only through the ports branch"
    requirement: QUICK-261107-PD8
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts#261107-pd8: the motion-key drag reuses the shared pointer session"
        status: pass
    human_judgment: false
  - id: D5
    description: "Strip wires one motionKeyDragPorts bundle gated on actions/ready/mutation lock, forwards the command layer's sentences, and passes it to the active block only"
    requirement: QUICK-261107-PD8
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#261107-pd8 motion-key drag ports wiring"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live drag behaviour: key and curve follow, grouped axes move together, blocked edge stops the ghost, Escape/outside release cancels, one undo restores, non-active rows stay click-only"
    requirement: QUICK-261107-PD8
    verification: []
    human_judgment: true
    rationale: "Pointer-gesture feel, ghost paint and undo integration are live visible behaviours the automated pins cannot observe; the user runs the six UAT rows."

# Metrics
duration: ~1h 5min (session resumed across context compaction; task commits spanned 2026-11-07T18:38:59+01:00 .. 18:42:32+01:00)
completed: 2026-11-07
plan_head_before: 31d6f54085edd9933caed2119463a7525d75d642
plan_head_after: bc92429ef2ca8ff271b31fd54151d96e7a586e67
status: complete
---

# Quick 261107-pd8: Draggable Motion Keys Summary

**Phase 59 motion keys now drag through time on the active expanded rail, reusing the shared `usePhysicsPaintKeyRailDrag` session and committing a dedicated `move-key` edit as one store write.**

## Performance

- **Duration:** ~1h 5min (session resumed across context compaction; the three task commits landed 18:38:59 → 18:42:32 +01:00)
- **Started:** not captured precisely (context compaction); ledger recorded HEAD before the first commit
- **Completed:** 2026-11-07
- **Tasks:** 3
- **Files modified:** 13 (12 modified, 1 created)

## Accomplishments

- `move-key` edit variant + `applyMoveKeyEdit`: a key moves in place (grouped Position moves both axes in one call), occupied destinations and desynced siblings throw, and the D-15 cascade never runs. Unknown rail, absent channel, missing key and `fromFrame === toFrame` are quiet no-ops.
- `moveMotionKey` pure command with the same validation order and sentences as the other Motion commands, plus `clampRailMotionKeyDragFrame` (directional nearest-free clamp inside the rendered band, `blockedEdge` left/right, own frame excluded, loop-based without array spreads).
- `RotoMotionKeyDragPublication` + `prepareMotionKeyDrag` / `commitMotionKeyDrag` on `RotoPhysicalTimelineActionBundle`: prepare never writes; commit re-reads live layer/track/rail/band, re-runs the command on live records, funnels through `commitMotionCommandResult`, and retargets `railMotionSelectedKey` when it addressed the moved key.
- New thin `TimelineMotionKeyDrag.tsx` leaf: arms the grabbed frame, projects `round(dx / TIMELINE_GEOMETRY.cellPitch)`, clamps, prepares, commits, surfaces rejections — it owns no listener, capture or move handler (the hook owns the session).
- Lane `keyDrag` presentation: grab cursor, pointerdown forwarding `(event, frame)`, a token-derived ghost with `blocked-edge-left|right`, and post-drop click suppression that stops propagation so the browser click never re-selects the rail. Without `keyDrag` the lane is byte-identical to before.
- Strip builds exactly one `motionKeyDragPorts` bundle gated on `physicalActions + props.ready !== false + !props.mutationLocked`, passes it to the active `TimelineMotionBlock` only, and publishes the command layer's sentence via `setApplyStatus('error')` + `publishStatus` (no authored copy).
- Contract pins prove the reuse: the leaf imports `usePhysicsPaintKeyRailDrag` and contains no `addEventListener` / `setPointerCapture` / `pointermove`; `TimelineMotionChannels.tsx` contains neither the hook nor its import; the row contains `TimelineMotionKeyDragLane` and `motionKeyDragPorts`; the strip opens the channel menu from Animate with a single overlay.

## Task Commits

Each task was committed atomically:

1. **Task 1: move-key edit, moveMotionKey command and drag transaction** — `dba89339b` (feat) — 6 files, 982 insertions, 1 deletion
2. **Task 2: lane drag presentation and the thin motion-key drag leaf** — `876966b59` (feat) — 4 files, 334 insertions, 20 deletions
3. **Task 3: active-block drag ports, reuse pins and scope proof** — `bc92429ef` (feat) — 3 files, 73 insertions, 1 deletion

Measured: `git rev-list --count 31d6f54085edd9933caed2119463a7525d75d642..HEAD` = **3**. Docs artifacts (SUMMARY/STATE/PLAN) are intentionally not committed here — the orchestrator owns the docs commit.

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionModel.ts` — `move-key` edit variant + `applyMoveKeyEdit`, reducer branch
- `app/src/components/physic-paint/roto/railMotionModel.test.ts` — six move-key tests + frozen-input coverage
- `app/src/components/physic-paint/roto/railMotionCommands.ts` — `moveMotionKey`, `clampRailMotionKeyDragFrame`
- `app/src/components/physic-paint/roto/railMotionCommands.test.ts` — 8 move + 7 clamp tests
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — publication type, prepare/commit, bundle members
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — 6 transaction tests (seeded store, spies, selection)
- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` — `keyDrag` presentation, exported band filter, ghost
- `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — 7 keyDrag presentation tests
- `app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx` — new thin hook leaf
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — `motionKeyDragPorts`, single laneProps object, leaf/pure branch
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — gated ports bundle on the active block
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — ports wiring pins + retargeted laneProps pin
- `app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts` — reuse contract describe

## Decisions Made

- A dedicated `move-key` edit, never remove+set: `applyRemoveKeyEdit` cascades key → channel → record (D-15), so a naive composition would drop a single-key channel between the two edits.
- Prepare is a pure availability check; commit re-derives from live records. The publication is retained only as identity (layer/track/rail/channel/from/to), never as records to replay (T-261107-PD8-02).
- The clamp is the ghost's authority but not the model's: `moveMotionKey` independently refuses an occupied destination, and the model edit throws before `canonicalizeRailMotionChannels` ever sees divergence.
- The lane remains pure; the drag hook exists in exactly one file and enters the lane as an optional prop, keeping every non-active row and hook-free lane test on the old path.
- Ports gate on `physicalActions + props.ready !== false + !props.mutationLocked`, matching the adjacent mutation gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retargeted a pre-existing source pin broken by the mandated laneProps refactor**
- **Found during:** Task 2 (row lane loop refactor)
- **Issue:** `PhysicsPaintWorkflowStrip.test.ts` pinned the literal `selectedKeyFrames={laneSelectedKeyFrames}`. The plan-mandated single `laneProps` object changed the rendering to `selectedKeyFrames: laneSelectedKeyFrames,`, so the pin failed although the selection still reaches the lane.
- **Fix:** Updated the pin to the equivalent object form with a comment explaining the refactor; semantics (selection reaches the lane) preserved.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`
- **Verification:** `vitest run` on the strip + contract suites: 201 passed.
- **Committed in:** `bc92429ef` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** The pin retarget is the plan's own "retargeted source pins" allowance; no behaviour changed, no scope widened.

## Issues Encountered

- During RED authoring, my first clamp expectation for `keyFrames:[0,4], fromFrame:4, proposedFrame:0` assumed a free frame 0; frame 0 is occupied by another key, so left travel correctly blocks at 1. The test now asserts a genuinely free destination (6 → `{frame:6, blockedEdge:null}`) plus the in-place no-op; the clamp logic was correct as specified.
- No typecheck, build, dependency-install or unrelated-suite failures. No auth gates.

## Verification

- Targeted suites: model + commands, actions, lane, row launcher, strip + contract — all green.
- Full suite: **398 test files passed | 2 skipped; 7991 tests passed | 1 skipped | 96 todo; 0 failed**.
- Typecheck: `pnpm --filter efx-motion-editor run typecheck` — clean.
- Scope tripwire: `git diff --name-only 31d6f5408 -- app/src` lists exactly the 13 plan files; no `railMotionEvaluator.ts`, `app/src/stores`, `src-tauri`, `app/src/efx-paint/document` or `physicsPaintStudio.css` path.

## Known Stubs

None. The one grep hit (`'This Motion command is not available.'` in `railMotionCommands.ts`) is a pre-existing generic failure sentence, not a stub.

## Threat Flags

None — every security-relevant surface introduced (pointer session crossing into the action bundle, commit re-validation, destination collision, Position lockstep) is already enumerated in the plan's threat register T-261107-PD8-01..05; no new trust boundary appeared.

## User Setup Required

None — no external service configuration required.

## UAT Rows Handed to the User

Live visible UAT (automated-green is not done):

1. Expand a rail with a Scale channel and drag a Scale key one or two frames: the dot and its curve move, and the key's value is unchanged.
2. Drag a grouped Position key: both axes move together, the lane still shows one dot per frame, and the X/Y values in the inspector are unchanged (only the frame moved).
3. Drag a key onto an occupied frame: the ghost stops on the nearest free frame and paints a blocked edge; dropping it there moves the key, and a drop that would not change the frame shows the refusal copy.
4. Press Escape mid-drag: the key stays where it was; release outside the lane also cancels.
5. After a successful drop the rail stays selected (the browser click does not re-select or close the block), and one Ctrl/Cmd+Z restores the key's previous frame.
6. A collapsed block and a non-active row render no grab cursor and no ghost; a Motion key on a non-active row stays click-only (unchanged).

## Next Phase Readiness

- The Phase 59 motion surface now drags through time with no new gesture system and no persisted-shape change; safe to continue on branch `gsd/phase-59-rail-motion-channels-v7-interface`.
- Blocked only on the six live UAT rows above.

---
*Quick: 261107-pd8-draggable-motion-key-from-phase-59-rail-*
*Completed: 2026-11-07*

## Self-Check: PASSED

- All 8 reported files exist (7 source/test targets + this SUMMARY).
- All 3 task commits are ancestors of HEAD: `dba89339b`, `876966b59`, `bc92429ef`.
