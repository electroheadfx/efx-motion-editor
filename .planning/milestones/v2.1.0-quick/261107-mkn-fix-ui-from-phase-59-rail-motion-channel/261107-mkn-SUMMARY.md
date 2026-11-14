---
phase: 261107-mkn-fix-ui-from-phase-59-rail-motion-channel
plan: 01
subsystem: ui
tags: [preact, signals, timeline, motion-channels, pinned-header, quick]

# Dependency graph
requires: []
provides:
  - "Exported TimelineMotionChannelHeaderRow + TimelineMotionHeaderGroup presentational components (hook-free, props only)"
  - "motionHeader prop on physicsPaintTrackHeaderColumn: the active track's expanded block hosts the channel header rows inside the pinned 160px column, lane-for-lane with the body"
  - "The live 18px Add channel row as the header group's last row; the body block reserves a blank 18px physics-paint-motion-block-add-slot"
  - "One add-channel availability resolution in the strip, forwarded pre-gated to both the header row and the block's fixed overlay"
affects: [PhysicsPaintWorkflowStrip, PhysicsPaintTrackRow, physicsPaintTrackHeaderColumn, TimelineMotionChannels, timelineMotionSurface-contract]

# Actuals (#2632) — pairs with the plan's estimate (70,000 tokens / 3 tasks).
# Same estimateTokens scale (chars/4 over the realized diff), not a harness token count.
actuals:
  tokens: 21999
  tasks: 3
  commits: 3

plan_head_before: f815c0030a8021f97ec347d510bfcd753446668c
plan_head_after: 6100f1b86ce0c3d0dd24ede025d138edf37bdf74

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header/body split: the lane body owns geometry (cells, curves, keys); the pinned header column owns the label/nav cluster and the add control, both derived from ONE layout entry"
    - "Pre-gated open: the strip resolves the single availability authority and forwards `open`/`disabled`/`reason` to the header row and the same gated open to the block's overlay; no view re-derives a gate"
    - "One resolver `resolveDisplayLaneChannelId` shared by block and header group so a lane's header and body address the same model channel"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
    - app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts

key-decisions:
  - "The header group renders the LIVE add row as its last child; the block keeps a blank 18px slot in the same rhythm, so outline, layout height and header height cannot drift"
  - "Availability is resolved exactly once in the strip (hasKeylessChannel from resolveKeylessMotionDisplayLanes); the block keeps one keyless projection only to render the menu body and to drop a stale identity with nothing to offer"
  - "The header band compares against the document's real activeTrackId (never the Bg-blanked id), so a Bg clip selection keeps the channel rows while only the rail accent blanks"
  - "Reference to the refusal sentence is never authored in a view: tests compare title/aria-description against resolveMotionCommandAvailability(...).reason"

patterns-established:
  - "Pinned-column channel headers: group -> N TimelineMotionChannelHeaderRow -> 2px gap -> live add row, inside the layout entry's declared height"
  - "Both hosts (strip active lane and presentational track row) render the same TimelineMotionBlock; only the active host receives the pre-gated menu open"

requirements-completed: [QUICK-261107-MKN]

coverage:
  - id: D1
    description: "Channel header rows (icon, label, N keys, previous/diamond/next) render inside the pinned left header column, one per visible display lane, aligned with their lanes."
    requirement: QUICK-261107-MKN
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#renders the ACTIVE track's channel header rows inside the pinned band"
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#keeps the real header band in lockstep for {1..4} lane(s)"
        status: pass
    human_judgment: true
    rationale: "Vertical alignment of header rows with their lane bodies, and the absence of overlap in the real UI, must be seen live."
  - id: D2
    description: "The lane body renders only cells, curves and motion keys — no header content and no nav props."
    requirement: QUICK-261107-MKN
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#renders NO header content — the lane body is cells, curves and keys only"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#renders four lanes, the blank 18px add slot and NO add row"
        status: pass
    human_judgment: false
  - id: D3
    description: "Add channel is the header band's last 18px row; clicking it opens the fixed menu anchored at that row; the block reserves a blank 18px slot."
    requirement: QUICK-261107-MKN
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#passes the add row open/disabled/reason through and relays the captured anchor"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#renders the menu as a FIXED viewport overlay"
        status: pass
    human_judgment: true
    rationale: "Menu anchoring next to the header row is a visual placement judgment; the pinned row is a live UAT row."
  - id: D4
    description: "Header and body heights stay in lockstep for 1-4 visible lanes on the real header path and the blank fallback path, including the 2px gap and the 18px add row/slot."
    requirement: QUICK-261107-MKN
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#keeps the real header band in lockstep for 1..4 lanes"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#keeps the blank fallback band in lockstep for 1..4 lanes"
        status: pass
    human_judgment: false
  - id: D5
    description: "Add-channel availability (enabled + reason) is resolved exactly once, in the strip; the row is disabled with the authority's reason verbatim and no click handler."
    requirement: QUICK-261107-MKN
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#resolves the add-channel availability exactly once"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#passes the add row open/disabled/reason through"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every intent still routes to the same handler: key select, rail select, previous/next, diamond toggle, add-channel pick and menu dismissal."
    requirement: QUICK-261107-MKN
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#maps a row step to the lane model channel id and the direction from the cursor"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#opens from the header row session identity and dismisses on a menu pick"
        status: pass
    human_judgment: true
    rationale: "The live UAT rows exercise previous/next stepping, diamond toggling and menu picks against the real record; routing is unit-proven but the user's end-to-end pass is the acceptance signal."

# Metrics
duration: 13min
completed: 2026-11-07
status: complete
uat_approved: 2026-11-07
uat_followup_commits: [2c8dde1d8, b5cb501e1]
---

# Phase 261107-mkn: Pinned-column motion channel headers Summary

**Phase 59 rail-motion channel headers and the Add channel control now render in the pinned left header column, aligned lane-for-lane with their bodies, while the lane body keeps only cells, curves and keys.**

## Performance

- **Duration:** ~13 min (plan commit 16:29:35+01 → final task commit 16:42:13+01)
- **Started:** 2026-11-07T15:29:35Z
- **Completed:** 2026-11-07T15:42:13Z
- **Tasks:** 3
- **Files modified:** 9 (4 source, 5 test)

## Accomplishments

- Header row cluster extracted from the lane body into `TimelineMotionChannelHeaderRow`; the group renders one row per visible display lane, the 2px post-block gap and the live add row.
- `physicsPaintTrackHeaderColumn` gained the `motionHeader` bundle; the strip builds it from the SAME `activeMotionRecord` / `activeMotionView` / `activeMotionLocalCursorFrame` the body consumes, and keeps the real header path out of `aria-hidden`.
- Add channel moved into the header band as its last 18px row; the block reserves a blank `physics-paint-motion-block-add-slot` and keeps the fixed menu overlay.
- The strip resolves `resolveMotionCommandAvailability({ command: 'add-motion-channel', ... })` exactly once and forwards the pre-gated open to both hosts; the disabled reason is rendered verbatim.
- Lockstep pinned for 1-4 visible lanes on both the real header path and the blank fallback path, plus the Bg-selection case that keeps the band while blanking only the rail accent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Channel header rows render in the pinned column** — `46a71b91d` (fix)
2. **Task 2: Add-channel control moves into the header band; body slot; one authority** — `1170d1b2e` (fix)
3. **Task 3: Lock the header/body lockstep and the single authority** — `6100f1b86` (test)

**Plan metadata:** not committed by the executor — planning artifacts (`SUMMARY.md` / `STATE.md`) are committed by the orchestrator per the run instructions.

_Measured from the persisted ledger: `f815c0030..6100f1b86` = 3 commits._

## Files Created/Modified

- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` — exports `TimelineMotionChannelHeaderRow` + `TimelineMotionHeaderGroup` + `resolveDisplayLaneChannelId`; the lane is cells/curves/keys only; the group ends with the live add row.
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` — new `motionHeader` prop and layout-entry `addChannelRow`; the active track's lane host renders the header group, every other lane host the blank fallback (with the slot when the entry counts it).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — `activeMotionHeader` bundle (nav + add intents moved verbatim), the single availability resolution and the gated `addChannelMenuOpen`.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — block renders lanes + 2px gap + blank 18px slot + fixed overlay; no in-body header/add row, no availability call.
- `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — header row/group pins, pass-through + anchor test, lane-body split.
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` — real path, fallback path, non-active guard, 1-4 lane lockstep, Bg-selection band.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — header bundle wiring and exactly-once authority pins.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` — block-side slot/outline/overlay pins.
- `app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts` — header host, add slot and single-authority source pins.

## Decisions Made

- The block's stale-identity guard is now `addChannelMenuOpen && keylessLanes.length > 0` (the enabled gate lives in the strip for the active rail); the row host passes the raw session identity because a non-active row no longer renders an add control.
- `resolveDisplayLaneChannelId` is shared by the block and the header group, so both panes address the same model channel for a grouped Position lane.
- The authority-reason comparison lives where the header row actually renders (channels/header-column tests) using `resolveMotionCommandAvailability(...).reason`; the row test scans every view host for a re-authored sentence.
- `childHasClass` in the channels test became a type predicate so `children.find(...)` narrows to `TestVNode` under `tsc --noEmit`.

## Retargeted Tests

All retargets are host-move consequences; no assertion was weakened in intent.

1. `PhysicsPaintWorkflowStrip.test.ts` — the two nav handler pins changed from JSX props (`onMotionCursorStep={...}`) to the bundle's object-literal forms, and the motion-key selection slice now ends at the next `onAddMotionChannel=` instead of `onMotionCursorStep=`, because the nav handlers moved into the header bundle.
2. `PhysicsPaintWorkflowStrip.test.ts` — the 59-17 pin `not.toContain('resolveKeylessMotionDisplayLanes')` became "exactly one call, inside the availability resolver": the plan deliberately moved the keyless projection into the strip.
3. `PhysicsPaintWorkflowStrip.test.ts` — the toggle-writer assertion became the bundle form `onToggle: (anchor) => toggleRailMotionChannelMenu(activeMotionRecord.railId, anchor),` (no trailing semicolon in an object literal).
4. `TimelineMotionChannels.test.ts` — "ends with the … 18px add slot" became "… the live 18px add row"; a new pass-through/anchor test covers open/disabled/reason. The lane's old nav disabled/host-override tests were retired with the header move.
5. `PhysicsPaintTrackRow.test.tsx` — the expanded-block add-row assertion became "no add rows + one blank 18px slot"; the 59-17 describe now keeps only block-side facts (slot, outline height, fixed overlay, menu picks/dismissal, stale identity); the in-block add click was replaced by seeding the session identity; the exactly-once source pin moved from the row module to the strip.
6. `physicsPaintTrackHeaderColumn.test.ts` — the Task-1 header add-slot lookup became the live add row; `expandMotionHeaderVnodes` now also materializes `TimelineMotionAddChannelRow`; `makeMotionHeader` gained the required `addChannel` bundle and `makeMotionHeaderForLanes` parametrizes 1-4 lanes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Type-narrowing guard for the group-children helper**
- **Found during:** Task 1 typecheck
- **Issue:** `children.find((child) => childHasClass(...))` returned `unknown`, so `styleOf`/`props` accesses failed `tsc --noEmit` (8 errors).
- **Fix:** Made `childHasClass` a `child is TestVNode` type predicate.
- **Files modified:** `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts`
- **Verification:** typecheck clean; 42-test suite green.
- **Committed in:** `46a71b91d` (Task 1)

**2. [Rule 1 - Bug] Corrected two of my own new assertions before commit**
- **Found during:** Task 1 targeted run
- **Issue:** The `aria-hidden` attribute is authored as the string `"true"`, and the Bg offset assertion targeted row 2 instead of the row after the open block.
- **Fix:** Assert `'true'`; assert `layout.rows[1].offset`.
- **Files modified:** `TimelineMotionChannels.test.ts`, `physicsPaintTrackHeaderColumn.test.ts`
- **Verification:** both suites green.
- **Committed in:** `46a71b91d` / `1170d1b2e`

---

**Total deviations:** 2 auto-fixed (1 blocking type, 2 test-code corrections counted above)
**Impact on plan:** Test-only; no production behavior or scope change.

## Issues Encountered

- The plan's Task-2 step 11 places the authority-reason comparison in the row test, but the row module no longer renders a header row; the comparison was placed in the channels/header-column tests (where the row renders) and the row test keeps the view-host sentence scan. Intent preserved.
- One pre-existing strip pin (`resolveKeylessMotionDisplayLanes` absent) was contradicted by the plan's own single-authority move; retargeted to exactly one call (see Retargeted Tests #2).

## Verification Results

- Task 1 targeted: TimelineMotionChannels 42, header column 29, strip 186, row launcher 46 → 303 passed, 0 failed; typecheck clean.
- Task 2 targeted: channels 43, row launcher 46, contract 10, header column 29 → 128 passed, 0 failed; typecheck clean.
- Task 3 targeted: header column 38, strip 188, contract 10 → 236 passed, 0 failed; typecheck clean.
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` → **396 files passed / 2 skipped; 7947 tests passed, 1 skipped, 96 todo, 0 failed**.
- Typecheck: `tsc --noEmit` clean.
- Scope tripwire: `git diff --name-only 5b8d9a557 -- app/src` lists exactly the nine plan files (4 source + 5 test); no `roto/`, `stores/`, `efx-paint/document/`, `src-tauri/` or `physicsPaintStudio.css` path.

## Threat Model Close-out

- T-261107-MKN-01 (mis-wired nav/add): mitigated — handlers moved verbatim into the strip bundle; tests assert direction/channel id (`position-x`, `scale`, `opacity`) and the toggle receives the header button's anchor.
- T-261107-MKN-02 (band drift): mitigated — 1-4 lane lockstep on both header paths; wrapper height equals the layout entry height; following offsets equal `resolveTrackRowLayout`.
- T-261107-MKN-03 (accessibility): mitigated — the real header path is not `aria-hidden` (only the blank fallback), and the add row keeps aria-label/haspopup/expanded/description.
- T-261107-MKN-04 (re-authored reason): mitigated — the reason comes from `resolveMotionCommandAvailability(...).reason`; source pins fix exactly one call site in the strip and none in the view hosts.
- T-261107-MKN-SC: no dependency installs.

## Known Stubs

None.

## Threat Flags

None — no new endpoints, auth paths, file access or schema surface; the change is confined to the existing view layer.

## User Setup Required

None.

## UAT Rows Handed to the User (live visible UAT)

- Expand a rail with motion: its channel header rows (icon, label, "N keys", previous/diamond/next) sit in the pinned left column, one per visible channel, aligned with their lane rows.
- The lane bodies show only cells, curves and keys; nothing paints over the frame cells from the left edge.
- "Add channel" is the last 18px row of the header band; clicking it opens the menu anchored at that row and picking Scale adds both the lane and its header row.
- Collapse/expand, rail switch and vertical scrolling keep the header rows aligned with their lanes; the Bg row and following track rows keep their offsets, and the reorder insertion line still lands on row boundaries.
- A fully-keyed rail's Add channel row is disabled and shows the authority reason on hover.
- Previous/next still step the playhead between keys, the diamond still toggles a key at the cursor, and selecting a Motion key still highlights it in its lane.

## Self-Check: PASSED

- All nine modified files exist.
- All three task commits are ancestors of HEAD (`46a71b91d`, `1170d1b2e`, `6100f1b86`).
- Commits measured from the persisted ledger: 3.

## UAT Follow-up Rounds (approved 2026-11-07)

The live UAT pass superseded two plan deliverables and added the animate-mode
model. Both rounds are part of this quick and are UAT-approved.

**Round 1 — `2c8dde1d8`**

- Lanes and the block outline hug the rail extent instead of the whole timeline.
- The grouped Position lane draws ONE curve (the shared key frame set made a second axis path a crossing duplicate).
- Channel rows/buttons enlarged to the reference.
- The plan's Add-channel row is retired: channel add/remove lives in the Animate dropdown; picking a channel creates the motion record (no default Position, no separate Animate step).
- The canvas rail boundary is gated on the expanded block.

**Round 2 — `b5cb501e1`**

- Pinned channel headers are always the bright rail colour (no unselected 0.55 dim); labels are title case (`textTransform: none` opts out of the global uppercase button rule); the visible "N keys" meta moved into the property tooltip (singular/plural).
- The per-lane diamond is hollow when no key sits at the cursor (add) and filled when one does (remove).
- New Motion boundaries host tool in the left rail: deploys the lane and re-selects the last animated property.
- Animate mode is ONE selected property — clicking a header row highlights it white and is the only trigger for the canvas gizmo; an open lane alone no longer arms the move boundary, so painting works with the lanes deployed.
- The left rail is exclusive: paint/select/picker picks leave animate mode, and the paint row renders deselected while a property animates.

**Verification:** full suite 398 files / 7953 tests passed; `tsc --noEmit` clean.
**UAT:** approved by the user 2026-11-07.
