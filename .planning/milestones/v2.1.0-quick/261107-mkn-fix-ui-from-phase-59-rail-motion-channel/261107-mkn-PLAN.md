---
phase: 261107-mkn-fix-ui-from-phase-59-rail-motion-channel
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  - app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts
autonomous: true
requirements: [QUICK-261107-MKN]
user_setup: []

estimate:
  tokens: 70000
  raw_tokens: 52000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Every visible display lane (the grouped Position lane, Scale, Rotation, Opacity) paints its header row — icon, label, 'N keys', previous/diamond/next cluster — inside the PINNED LEFT HEADER COLUMN, vertically aligned with that lane's body row; the lane body paints only cells, curves and motion keys."
    - "The 'Add channel' control renders as the last 18px row of the same pinned header band; clicking it opens the existing fixed-position channel menu anchored at that row; a fully-keyed rail shows the availability authority's reason verbatim and cannot open the menu."
    - "Header and body heights stay in lockstep: for N visible lanes the header side renders N x 18px rows plus the 2px post-block gap plus the 18px add row, and the body reserves the same 18px add slot, so every following rail row and the reorder insertion indicator keep their measured offsets."
    - "Every existing intent is preserved exactly: lane key clicks, lane/rail selection, previous/next cursor steps, diamond toggle at cursor, add-channel picks and menu dismissal route to the same command-layer handlers; no motion model, evaluator, reducer, store, serializer or compositor code changes."
    - "Only the active track's selected rail renders channel header rows; a collapsed block and every non-active row render none, and selecting a Bg clip never blanks the motion header band."
  artifacts:
    - path: "app/src/components/physic-paint/view/TimelineMotionChannels.tsx"
      provides: "TimelineMotionChannelHeaderRow + TimelineMotionHeaderGroup exported presentational components; the lane body carries no header cluster and no nav props"
    - path: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx"
      provides: "motionHeader prop; the active track's lane group hosts TimelineMotionHeaderGroup; a blank fallback (with the add slot when the layout entry counts it) for a column rendered without motion data"
    - path: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
      provides: "the activeMotionHeader bundle, the single add-channel availability resolution and the pre-gated addChannelMenuOpen forwarded to both hosts"
    - path: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx"
      provides: "the block renders lanes + 2px gap + an 18px add slot + the fixed menu overlay; no in-body header or add button; the availability call leaves the view"
    - path: "app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts"
      provides: "positive source pins for the header host, the add slot and the single authority"
  key_links:
    - "strip activeMotionRecord -> activeMotionHeader -> header column motionHeader -> TimelineMotionHeaderGroup rows: one record feeds the header rows and the body lanes, so the visible lane count cannot disagree."
    - "resolveVisibleMotionDisplayLanes (group) <-> resolveTrackMotionLaneCount -> resolveTrackRowLayout: one display-lane projection and one measured layout; the header group never sets its own total height."
    - "header add row onToggle(anchor) -> toggleRailMotionChannelMenu -> railMotionChannelMenuRailId/railMotionChannelMenuAnchor -> the block's fixed overlay: the menu identity keeps exactly its two existing writers."
    - "resolveMotionCommandAvailability('add-motion-channel') resolved once in the strip -> add row disabled/reason and the gated addChannelMenuOpen -> the block overlay: no view re-authors the refusal sentence."
---

<objective>
Move the Phase 59 channel header rows and the "Add channel" control out of the timeline lane body and into the pinned left header column, so the row list of channel headers (icon, label, "N keys", previous/diamond/next) and the add-control line up with their lanes instead of painting over the frame cells.

Purpose: quick report against the shipped v2.1.0 rail motion surface. The header cluster is currently an absolutely positioned overlay inside each `TimelineMotionChannelLane` (left 0, width `headerClusterWidth`), and `TimelineMotionAddChannelRow` renders in flow inside `TimelineMotionBlock`; both sit on top of the lane's cells, curves and keys. SPECS/v2.1.0-motion-channels §2 and the reference `MOTION-CHANNELS.tsx` split the surface: header rows belong to the header column, lanes carry only cells/curves/keys.

Output: exported `TimelineMotionChannelHeaderRow` and `TimelineMotionHeaderGroup` presentational components, a `motionHeader` prop on `physicsPaintTrackHeaderColumn`, the strip's header bundle and single add-channel availability resolution, a body-side 18px add slot, and retargeted pins that lock the split and the both-sides height math.

Scope note: presentation-only. Do not change the persisted motion model, the evaluator, any reducer, the store, serializers or the compositor. Do not invent new visual language: every size, gap and colour keeps coming from `TIMELINE_MOTION` / `TIMELINE_GEOMETRY` / `TIMELINE_SURFACE`. The row internals (flex layout, gap, icon/label/count sizes, nav buttons, palette) stay as they are today; only their host changes. Preact + signals rules apply (hook-free presentational components, no signal reads in the view modules). `workflow.tdd_mode` is on globally, but this is a UI move: `execute` tasks with the existing suite as the gate — no RED-first cycle (project memory: fix live behaviour before tests).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@SPECS/v2.1.0-motion-channels/README.md
@SPECS/v2.1.0-motion-channels/MOTION-CHANNELS.tsx
@SPECS/v2.1.0-motion-channels/motion-channels.css
@.claude/skills/efx-preact-reactivity/SKILL.md

Verified anchors at HEAD 5b8d9a557 (the only baseline this plan changes):

- Defect site 1 — `app/src/components/physic-paint/view/TimelineMotionChannels.tsx:388-451`: the lane renders `div.physics-paint-motion-lane-header` with `position:absolute; left:0; top:0`, `width: TIMELINE_MOTION.headerClusterWidth`, containing the six `data-motion-header-part` parts (icon, label, count, previous, diamond, next). The nav state derivation lives in the lane at 232-296; `onMoveCursorToKey`/`onToggleKeyAtCursor` are lane props at 71-72.
- Defect site 2 — `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:748-753`: `TimelineMotionBlock` renders `TimelineMotionAddChannelRow` in flow after `div.physics-paint-motion-block-gap`; the availability call is at 688-697 and the fixed overlay at 754-760 (anchor read `railMotionChannelMenuAnchor.value` at 757).
- Header side — `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx:250-273`: for `laneCount > 0` the column renders `div.physics-paint-track-header-group` (fixed height from the layout entry) with `headerCell` then an `aria-hidden` container of blank 18px spacers plus one 2px gap. It ignores the add row's 18px, which is the leftover slack. Props already include `selectedRail`, `selectedRailType` and `rowLayout` (67-155).
- Layout authority — `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:728-751`: `resolveTrackRowLayout` computes `31 + laneCount x TIMELINE_MOTION.laneHeight + postBlockGap + (addChannelRow ? laneHeight : 0)`. Strip facts: `activeMotionLaneCount` 2887, `activeMotionView` 2894, `activeMotionAddChannelRow = activeMotionLaneCount > 0` 2902, `activeMotionChannelMenuOpen` 2903, `activeMotionLocalCursorFrame` 2907, `rowLayout` 2913, `activeMotionHeader` insertion point after `motionLaneDisabledReasons` 3352-3361, header column invocation 6155-6207, active-lane block invocation 6324-6385 (nav handlers 6345-6359, menu handler 6363-6367).
- Menu identity — `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:395-418`: `railMotionChannelMenuRailId`, `railMotionChannelMenuAnchor`, `toggleRailMotionChannelMenu`, `dismissRailMotionChannelMenu`. The row test pins exactly TWO writers and pins that the strip never renders the overlay (1463) — so the fixed overlay STAYS in the row module.
- Availability authority — `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` imports `resolveMotionCommandAvailability` at 38 and calls it at 690; `app/src/components/physic-paint/roto/railMotionCommands.ts` owns the sentence. The strip already imports `resolveSelectionScope` from the same module (218-220).
- Design tokens — `app/src/components/physic-paint/view/timelineRailDesign.ts`: `TIMELINE_GEOMETRY.motionLaneHeight` 110, `TIMELINE_MOTION.laneHeight` 131, `headerClusterWidth` 133 (160), `laneLabelGap` 134 (6), `postBlockGap` 136 (2), `TIMELINE_SURFACE.motionLane` (#1B2026), `TIMELINE_SURFACE.accentFallback` (#8A939C).
- Tests that encode the current split: `TimelineMotionChannels.test.ts` lane header assertions 304-480 and the source contract 748-770 (no store/hook/signal/DOM identifiers, no bare 18/16/6/1.5 literals); `physicsPaintTrackHeaderColumn.test.ts` harness 157-197, blank-spacer test 1194, offset sequence 1165-1192, `expandComponent` whitelist 107-112; `PhysicsPaintTrackRow.test.tsx` add-row cluster 1220-1477; `PhysicsPaintWorkflowStrip.test.ts` handler slice 3286-3293; `timelineMotionSurface.contract.test.ts` lane/row/strip/header source assertions 94-157.

Project skills: `efx-preact-reactivity` — the header column, the header row and the header group stay hook-free and prop-driven; no render-body signal writes; no `useState`; the strip remains the only host that reads the rail motion signals. `vitest run` only (never watch). Never start the server.

Gates: `pnpm --filter efx-motion-editor exec vitest run <file>` and `pnpm --filter efx-motion-editor run typecheck`. Vitest collects only `src/**/*.test.ts`; the row suite runs through its import-only launcher `PhysicsPaintTrackRow.test.tsx.test.ts`.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Channel header rows render in the pinned column end-to-end (components + host + bundle)</name>
  <files>app/src/components/physic-paint/view/TimelineMotionChannels.tsx, app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx, app/src/components/physic-paint/view/TimelineMotionChannels.test.ts, app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</files>
  <behavior>
    - `TimelineMotionChannelHeaderRow` renders the six parts in order icon/label/count/previous/diamond/next, with the same labels, counts, disabled reasons and click intents as the current in-lane cluster; `TimelineMotionHeaderGroup` renders one row per visible display lane in fixed order, then a 2px gap, then an 18px aria-hidden add slot.
    - Rendering one `TimelineMotionChannelLane` yields zero header parts; the lane keeps its cells, curve paths and 6px key dots exactly as today.
    - `physicsPaintTrackHeaderColumn` with a `motionHeader` for the active track renders the real header rows inside the pinned band; the same column without `motionHeader` keeps the blank fallback; a `motionHeader` supplied for a non-active track renders the blank fallback.
    - The strip builds the bundle from the same `activeMotionRecord` / `activeMotionView` / `activeMotionLocalCursorFrame` the body uses and forwards the previous/next/diamond intents to `stepMotionKeyBackward`/`stepMotionKeyForward` and the add/remove-at-cursor commands with the lane's own model channel id.
    - Every following row's offset and the reorder insertion indicator still come from `rowLayout`, and the lane group's declared height still equals the layout entry height.
  </behavior>
  <action>
In `app/src/components/physic-paint/view/TimelineMotionChannels.tsx`:
1. Extract a module-local band predicate `resolveInBandMotionKeys(keys, frameCount)` (finite frame, 0 <= frame < frameCount) and use it in the lane for its key dots and in the new header row for its adjacency list — one band authority, never a second filter.
2. Export `TimelineMotionChannelHeaderRowProps` and `TimelineMotionChannelHeaderRow`. Lift the whole `div.physics-paint-motion-lane-header` block from the lane (388-451) into it, keeping the six `data-motion-header-part` attributes, the label/count copy, `renderLaneIcon`, `resolveTimelineRailPalette(railType, selected ? 'selected' : 'active')`, the 0.55 dim plus the "Click this lane to select the rail for canvas transforms" title when not selected, the nav state derivation (resolveControlState + resolveAdjacentKeyFrame) and the nav button style/props helpers. Change only the container: it is a normal flow row in a flex column (`display:flex`, `alignItems:center`, `gap: TIMELINE_MOTION.laneLabelGap`, `width:'100%'`, `minWidth: TIMELINE_MOTION.headerClusterWidth`, `height: TIMELINE_MOTION.laneHeight`, `flexShrink:0`, `background: TIMELINE_SURFACE.motionLane`, no absolute positioning). Props: lane, railType, selected, railFrameCount, cursorFrame, onMoveCursorToKey, onToggleKeyAtCursor, disabledReasons.
3. Export `TimelineMotionHeaderGroupProps` and `TimelineMotionHeaderGroup`. Props: channels (readonly channel array), view, selected, cursorFrame, disabledReasons, onMotionCursorStep, onToggleMotionKeyAtCursor. Derive railType from `view?.railType ?? 'standard'` and railFrameCount as `view === null ? 0 : Math.max(0, Math.floor(view.endFrameExclusive - view.startFrame))`; render `resolveVisibleMotionDisplayLanes(channels)` mapped to `TimelineMotionChannelHeaderRow` in a `div.physics-paint-motion-header-group` (flex column), resolving each lane's model channel id with an extracted `resolveDisplayLaneChannelId(lane)` (the lane's first channel id, `position-x` fallback) and mapping `onMotionCursorStep(direction, channelId)` from the row's frame callback (`frame < cursorFrame ? -1 : 1`). After the rows render `div.physics-paint-motion-header-gap` of height `TIMELINE_MOTION.postBlockGap`, then an aria-hidden `div.physics-paint-motion-header-add-slot` of height `TIMELINE_MOTION.laneHeight` (Task 2 replaces it with the live row). Import the `RailMotionRailView` type from `../roto/railMotionIdentity`.
4. Delete the lane's header div (388-451) and the lane's nav state derivation (243-272 plus the nav helpers 274-296). Remove `onMoveCursorToKey` and `onToggleKeyAtCursor` from `TimelineMotionChannelLaneProps` and its destructuring. Keep `selectKeyState` for the key dots. Export `resolveDisplayLaneChannelId` and use it in the block too.
5. Keep every literal out of the source contract's forbidden set (no bare 18/16/6/1.5, no store/hook/signal/DOM identifier); the new code reads tokens only.

In `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx`:
6. Add `readonly motionHeader?: TimelineMotionHeaderGroupProps | null;` and destructure it with a null default. Add `readonly addChannelRow?: boolean` to `PhysicsPaintTrackHeaderRowLayoutEntry` (structural; the strip's entries already carry it).
7. In the `laneCount > 0` branch, render `TimelineMotionHeaderGroup` with the bundle when `motionHeader !== null && track.id === activeTrackId` (compare against `activeTrackId`, never `effectiveActiveTrackId`, so a selected Bg clip does not blank the band). Otherwise keep the existing `div.physics-paint-track-header-lanes` fallback with its blank 18px spacers and its 2px gap, and append one more blank 18px `div.physics-paint-track-header-lane-add-slot` only when `layoutEntry.addChannelRow === true`. The fallback stays `aria-hidden`; the real path must not be. Keep the wrapper's `data-header-lane-count` and fixed `${layoutEntry.height}px`. Import the group and its type from `./TimelineMotionChannels`.

In `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`:
8. Extend the `./TimelineMotionChannels` import with the `TimelineMotionHeaderGroupProps` type. After `motionLaneDisabledReasons` (3352-3361) build `const activeMotionHeader: TimelineMotionHeaderGroupProps | null` as a plain const (no new hook): non-null only when `activeMotionRecord !== null && activeMotionLaneCount > 0`; channels from the record, view from `activeMotionView`, selected `activeRailSetIdentity !== null`, cursorFrame `activeMotionLocalCursorFrame`, disabledReasons `motionLaneDisabledReasons`, and the two intent callbacks moved verbatim from the block invocation at 6345-6359 (same command-layer calls, same channelId plumbing).
9. Pass `motionHeader: activeMotionHeader` in the `physicsPaintTrackHeaderColumn` invocation after `rowLayout` (6206).
10. Remove `onMotionCursorStep` and `onToggleMotionKeyAtCursor` from the `TimelineMotionBlock` invocation (6345-6359) so the intents have exactly one host.

In `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx`:
11. Remove `onMotionCursorStep` and `onToggleMotionKeyAtCursor` from `TimelineMotionBlockProps` and its destructuring, and stop passing them to `TimelineMotionChannelLane` (733-738). Remove the same two props from the row's own props interface (218/220), its destructuring (1083-1084) and its block invocation (1445-1446). The row host keeps `onSelectMotionKey`, `onAddMotionChannel`, `onCloseChannelMenu` and the menu writers untouched.

Then update the pins. In `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts`:
12. Delete the lane's header-part tests (304-317, 429-446, 456-479) and any lane prop helpers that only fed them. Add a `TimelineMotionChannelHeaderRow` describe: six parts in order, labels/counts, nav enablement and disabled reasons, the host disabled-reason override, and the click routing (previous goes to the earlier frame, next to the later frame, diamond calls the toggle). Move the `headerParts`/`headerPart` helpers to that describe's fixture.
13. Add a `TimelineMotionHeaderGroup` describe: one row per visible display lane in fixed order; the 2px gap; the 18px add slot; `onMotionCursorStep` receives the lane's model channel id (position -> position-x) and the right direction from the cursor; `onToggleMotionKeyAtCursor` receives the model channel id. Add the behavioural split assertion: rendering a lane yields no `data-motion-header-part` vnode.
14. Keep the source contract (748-770) green — no literal or identifier from its forbidden set may enter the module.

In `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts`:
15. Add `readonly motionHeader?: TimelineMotionHeaderGroupProps | null` to `ColumnRenderOptions` and forward it in `renderColumn`; add `TimelineMotionHeaderGroup` to the `expandComponent` whitelist.
16. Add a test: with a layout entry for the active track (laneCount 3, addChannelRow true) and a matching `motionHeader`, the group contains 3 `physics-paint-motion-lane-header` rows, one 2px gap and one 18px add slot, and the Bg header's offset equals the layout's Bg entry offset. Add the non-active guard test: the same `motionHeader` under a non-active track still renders the blank fallback. Add the fallback add-slot test: an entry with `addChannelRow: true` renders one blank 18px add slot, an entry without it renders none. Keep the existing 1194 and 1235 tests (their fixtures pass no `addChannelRow`, so no slot and their heights stay valid).

In `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`:
17. Retarget the handler slice at 3286-3293: slice from `onSelectMotionKey={(frame, channelId) => {` to the next `onAddMotionChannel=` instead of `onMotionCursorStep=`, because the nav handlers now live earlier in the file (the header bundle). Keep the assertions (both selection clears, `selectMotionKey`, no `onSelectRotoLoopClip`).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Channel header rows render in the pinned header column for the active rail with the same parts, labels, reasons and intents as before; the lane body renders no header content and exposes no nav props; the fallback column and the strip's handler pins stay green; typecheck clean.</done>
  <reversibility rating="reversible">A host change plus pure component extraction; no persisted field, command or selector changes, and every intent is re-homed verbatim.</reversibility>
</task>

<task type="execute">
  <name>Task 2: Add-channel control moves into the header band; body reserves an 18px slot; one availability authority</name>
  <files>app/src/components/physic-paint/view/TimelineMotionChannels.tsx, app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/TimelineMotionChannels.test.ts, app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx, app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts</files>
  <behavior>
    - `TimelineMotionHeaderGroup` renders `TimelineMotionAddChannelRow` as its last row (replacing the slot), passing open/disabled/reason/onToggle through unchanged and relaying the anchor object the button captures.
    - The block renders the lanes, the 2px gap and an 18px `physics-paint-motion-block-add-slot`, then the fixed overlay only when its pre-gated open prop is true and at least one keyless display lane exists; it renders no add button.
    - The strip resolves `resolveMotionCommandAvailability({ command: 'add-motion-channel', hasRail: true, hasMotionRecord: true, hasKeylessChannel })` exactly once for the active rail, and forwards the gated open to the header bundle and the block.
    - A fully-keyed rail's header add row is disabled with the authority's reason verbatim and no click handler; a keyless lane enables it; a stale menu identity can never open the disabled row.
    - The block outline still measures 31 + N x 18 + 2 + 18 and the block's rendered height still equals the layout entry height.
  </behavior>
  <action>
In `app/src/components/physic-paint/view/TimelineMotionChannels.tsx`:
1. Add `readonly addChannel: TimelineMotionAddChannelRowProps` to `TimelineMotionHeaderGroupProps` and replace the group's `physics-paint-motion-header-add-slot` with `TimelineMotionAddChannelRow` spread from it. Do not restyle the row and do not add a new wrapper/inset — the component keeps its token-derived geometry.

In `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx`:
2. In `TimelineMotionBlockProps` rename `channelMenuOpen` to `addChannelMenuOpen` and remove `onToggleChannelMenu`. Remove the `resolveMotionCommandAvailability` import and the availability block (688-697); keep `resolveKeylessMotionDisplayLanes` for the menu body. Render `div.physics-paint-motion-block-add-slot` (aria-hidden, height `TIMELINE_MOTION.laneHeight`, `flexShrink: 0`) where the add row was, and gate the overlay on `addChannelMenuOpen && keylessLanes.length > 0`. Remove the `TimelineMotionAddChannelRow` import.
3. In the row host (1437-1453) pass `addChannelMenuOpen={motionChannelMenuOpen}` and drop the `onToggleChannelMenu` arrow; drop the two nav props already removed in Task 1. Keep the menu writers, the anchor signal, the fixed overlay and the outline untouched.

In `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`:
4. Extend the `../roto/railMotionCommands` import (218-220) with `resolveMotionCommandAvailability`, and the `./TimelineMotionChannels` import (229) with `resolveKeylessMotionDisplayLanes`.
5. Near 2902-2904 compute `activeMotionAddChannelAvailability` (`null` when `activeMotionRecord === null`, else the resolver call with `hasRail: true`, `hasMotionRecord: true`, `hasKeylessChannel` from `resolveKeylessMotionDisplayLanes(activeMotionRecord.channels).length > 0`) and `activeMotionAddChannelRowOpen` (record non-null, availability enabled, `activeMotionChannelMenuOpen`). Add the `addChannel` object to `activeMotionHeader` with `open`, `disabled: !availability.enabled`, `reason: availability.reason`, and `onToggle` calling `toggleRailMotionChannelMenu(activeMotionRecord.railId, anchor)`.
6. In the block invocation pass `addChannelMenuOpen={activeMotionAddChannelRowOpen}` and remove `onToggleChannelMenu` (6363-6367). The header bundle gains the add row; the block keeps only the overlay.

In `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts`:
7. Add group assertions: the add row is the last child of the group; open/disabled/reason pass through; `onToggle` receives the anchor `{x, y}` the button captured (stub `getBoundingClientRect` on the click event's currentTarget as the existing add-row tests do). Keep the group's row-count/gap assertions from Task 1.
8. Add the split assertion on the block: rendering `TimelineMotionBlock` yields no header parts in its lanes (the existing lane-level assertion covers the lane; keep it).

In `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` (via the launcher):
9. Rewrite the expanded-block add-row assertions (1148-1153): the block renders one `physics-paint-motion-block-add-slot` with the lane-height style and zero `data-motion-add-channel-row` vnodes; the outline height stays 31 + 4 x 18 + 2 + 18.
10. Retarget the 59-17 describe (1220-1477): the enabled/disabled/aria-expanded behaviour now lives on the header group, so keep only the block-side facts — the 18px slot, the outline height for a keyless-only record, the fixed overlay (position, zIndex, backdrop, menu rows, menu picks routing `onAddMotionChannel` and dismissal), and the stale-identity case (open emitted with no keyless lane renders no overlay). Assert the authority reason by calling `resolveMotionCommandAvailability` in the test and comparing the header row's `title`/`aria-description` to its `reason` — never hardcode the sentence.
11. Retarget the "exactly once" source pin (1346-1352) to `PhysicsPaintWorkflowStrip.tsx`: exactly one `resolveMotionCommandAvailability(` call, it contains `command: 'add-motion-channel'` and `hasKeylessChannel`, and no view file contains a re-authored refusal sentence (compare against the resolver's own `reason` value). Keep the two-writer and never-persisted pins unchanged.

In `app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts`:
12. Add positive source pins: `PhysicsPaintTrackRow.tsx` contains `physics-paint-motion-block-add-slot`; `TimelineMotionChannels.tsx` contains `physics-paint-motion-header-add` or the add-row component usage; `physicsPaintTrackHeaderColumn.tsx` contains `TimelineMotionHeaderGroup`; the strip contains exactly one `resolveMotionCommandAvailability(`. Keep every existing value/absence pin (the row still references `TIMELINE_SURFACE.motionToggleInactive` for its chevron; the header column still references `TIMELINE_GEOMETRY.motionLaneHeight` and `TIMELINE_MOTION.postBlockGap`).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/timelineMotionSurface.contract.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The add-channel control renders as the last row of the pinned header band and the body holds an 18px slot; the disabled/reason/open values come from the strip's single authority; the fixed menu overlay still escapes the rows clip; the targeted suites and typecheck pass.</done>
  <reversibility rating="reversible">The control keeps its component, props, session signals and writers; only its host and the single call site of the availability resolver change.</reversibility>
</task>

<task type="execute">
  <name>Task 3: Lock the lockstep and the split; full suite; prove nothing outside the view layer moved</name>
  <files>app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts, app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts</files>
  <behavior>
    - For laneCount 1 through 4 with the add channel row counted, the header band's rendered child heights plus the 31px rail cell equal the layout entry height, on the real header path and on the fallback path, and every row's offset equals `resolveTrackRowLayout`'s offset.
    - A Bg clip selection (backgroundSelected true) still renders the real motion header rows for the active track while blanking the rail accent.
    - The strip source hands the header column `motionHeader` built from the same record/view/cursor the body consumes, and resolves the add-channel availability exactly once.
    - The full suite is green, typecheck is clean, and the diff from the plan's baseline commit lists only the four view source files and the five view test files.
  </behavior>
  <action>
In `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts`:
1. Generalize the lockstep coverage: parametrize laneCount 1-4 with `addChannelRow: true`, render the real `motionHeader` path and the blank fallback path, and assert (a) the header group contains laneCount header rows, one 2px gap and one 18px add row, (b) the wrapper's declared height equals the layout entry height, (c) the next header cell's offset equals the layout entry offset, and (d) the row with `container` scroll geometry is unchanged. Reuse the existing `headerOffsetSequence` helper.
2. Add the Bg-selection test: `backgroundSelected: true` plus a `motionHeader` for the active track still renders the header rows for that track (the blanking applies to the rail accent only).

In `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`:
3. Add a source pin that the strip passes `motionHeader: activeMotionHeader` to `physicsPaintTrackHeaderColumn` and that the bundle reads `activeMotionRecord.channels`, `activeMotionView` and `activeMotionLocalCursorFrame`; keep the existing one-layout and reorder-offset pins untouched.
4. Keep the retargeted 3286 slice green.

In `app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts`:
5. Add the single-authority pin: the strip source contains exactly one `resolveMotionCommandAvailability(` call and the row source contains none; keep every existing positive/absence token pin.

Then run the targeted suites, the full suite and typecheck. Run `git diff --name-only 5b8d9a557 -- app/src` and confirm the output is exactly the nine paths in this plan's `files_modified` (app/src subset); any path under `app/src/components/physic-paint/roto`, `app/src/stores`, `src-tauri`, `app/src/efx-paint/document` or `physicsPaintStudio.css` means the presentation-only scope broke — stop and report instead of widening. If an unrelated failure appears, stop and report it; do not edit unrelated assertions.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/timelineMotionSurface.contract.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>git diff --name-only 5b8d9a557 -- app/src</automated>
  </verify>
  <done>Lockstep is pinned for 1-4 lanes on both header paths and the Bg-selection case keeps the band; the strip's single authority and header wiring are pinned; the full suite is green, typecheck clean, and the app source diff contains only the plan's view-layer files.</done>
  <reversibility rating="reversible">Test-only hardening after the UI move; no production behaviour changes.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| view host swap -> command layer | Header buttons move between two view modules; a mis-wired callback would step or toggle a motion key on the wrong channel. |
| header band -> rows band geometry | The two bands are separate scroll domains kept in lockstep; drift would point interactive chevrons at a different lane than the one the user is editing. |
| accessibility tree -> interactive header | Interactive buttons inside an aria-hidden or clipped container become unreachable or invisible to assistive tech. |
| strip -> availability authority | A view that re-derives "why add is refused" becomes a second authority for the disabled state and its copy. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261107-MKN-01 | Tampering | `TimelineMotionHeaderGroup` nav/add handlers -> `stepMotionKeyBackward` / `stepMotionKeyForward` / `setMotionKeyAtCursor` / `removeMotionKeyAtCursor` / `addMotionChannel` | medium | mitigate | Every handler is moved verbatim from the block invocation into the strip bundle with the same channelId plumbing; the header group maps the frame callback to the lane's own model channel id, and the channels test asserts the channel id and direction received. |
| T-261107-MKN-02 | Tampering | header band vs rows band | high | mitigate | Both sides derive from the one `resolveTrackRowLayout` entry: the header wrapper keeps the entry height, the group renders N rows + 2px gap + 18px add row, the body renders the same 18px slot; Task 3 pins 1-4 lanes on both paths and the following rows' offsets. |
| T-261107-MKN-03 | Elevation of privilege | pinned header column accessibility | medium | mitigate | The real header path drops the `aria-hidden` container; only the blank fallback stays hidden; the add row keeps its aria-label, aria-haspopup, aria-expanded and reason description. |
| T-261107-MKN-04 | Repudiation | add-channel disabled reason | low | mitigate | The reason stays the resolver's own value; the test compares against `resolveMotionCommandAvailability`'s `reason` rather than a literal, and the source pin fixes exactly one call site in the strip. |
| T-261107-MKN-SC | Tampering | pnpm dependency installs | high | accept | No dependency is added, upgraded or installed by this plan; the supply-chain surface is unchanged. |
</threat_model>

<verification>
1. Channel surface: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts` — header row parts, nav/disabled behaviour, group ordering, gap, add row, lane body with no header parts.
2. Header host: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` — real path, fallback path, non-active guard, Bg-selection guard, 1-4 lane lockstep.
3. Row surface: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts` — the block's lanes, 18px slot, outline height, fixed overlay, menu picks and dismissal.
4. Strip + contract: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/timelineMotionSurface.contract.test.ts` — bundle wiring, one availability call, token pins.
5. Full suite: `pnpm --filter efx-motion-editor exec vitest run` must end with 0 failed. Never watch; never start the server.
6. Typecheck: `pnpm --filter efx-motion-editor run typecheck` reports no errors.
7. Scope tripwire: `git diff --name-only 5b8d9a557 -- app/src` lists only the plan's view files; no roto/store/desktop/document/css path. If an implementation proves such a change unavoidable, STOP and report.

UAT rows the user will run after execution (live visible UAT; automated-green is not done):
- Expand a rail with motion: its channel header rows (icon, label, "N keys", previous/diamond/next) sit in the pinned left column, one per visible channel, aligned with their lane rows.
- The lane bodies show only cells, curves and keys; nothing paints over the frame cells from the left edge.
- "Add channel" is the last 18px row of the header band; clicking it opens the menu anchored at that row and picking Scale adds both the lane and its header row.
- Collapse/expand, rail switch and vertical scrolling keep the header rows aligned with their lanes; the Bg row and following track rows keep their offsets, and the reorder insertion line still lands on row boundaries.
- A fully-keyed rail's Add channel row is disabled and shows the authority reason on hover.
- Previous/next still step the playhead between keys, the diamond still toggles a key at the cursor, and selecting a Motion key still highlights it in its lane.
</verification>

<success_criteria>
- Channel header rows and the Add channel control render inside the pinned left header column, aligned lane-for-lane, and the lane body carries only cells, curves and keys.
- Header and body heights stay in lockstep for 1-4 visible lanes, including the 2px post-block gap and the 18px add row/slot on both sides.
- Every existing intent (key select, rail select, previous/next, diamond, add channel, menu dismissal) still routes to the same command-layer handler; the availability disabled state and reason remain the single authority's, resolved once in the strip.
- No motion model, evaluator, reducer, store, serializer, compositor or stylesheet change; the app source diff is confined to the view layer files in this plan.
- Targeted suites and typecheck clean before each commit; full suite green at the end; three atomic commits, one per task.
</success_criteria>

<output>
Create `.planning/quick/261107-mkn-fix-ui-from-phase-59-rail-motion-channel/261107-mkn-SUMMARY.md` when done. Record the three task commits, the header components and their props, the `motionHeader` contract, the add-channel host move and the body slot, the single availability call site, the retargeted pins, the full-suite/typecheck results, the `git diff --name-only` scope result, and the UAT rows handed to the user.
</output>
