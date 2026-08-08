---
phase: 43
plan: 10
kind: uat-record
status: approved
created: 2026-08-07
revised: 2026-08-08
builds_under_test:
  - user-run native development app
  - unsigned local packaged app
packaged_app: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app
---

# Phase 43 Plan 10 — Native UAT: Integrated Loop Rail and Linked Loop Clips

## Historical failed attempt

The first native attempt stopped at old Step 1 on 2026-08-07. The rejected rich Loop Clip capsule system—identity-bearing capsule visuals plus interactions—had been placed on the Motion Editor main timeline (`PPaint #1`) instead of keeping authoring inside EFX Paint/Roto. No later step was executed. That interactive filmstrip/capsule direction is not acceptance evidence.

This script replaces that failed authoring contract. Loop Clip authoring remains exclusively inside EFX Paint/Roto through the integrated Loop Rail, styled rail tooltip, contextual Scripts sidebar, and existing Studio-local edit modal. The proposed dedicated local-actions popover was explicitly superseded during closure reconciliation and is not part of the approved surface. The Motion Editor main timeline is allowed only one passive Repeat-duration marker per canonical effective interval: an exact 3px Progressive-purple or Static/Hold-cyan strip with white canonical endpoint cuts inside the existing PPaint FX bar, from paint-only `{startFrame, frameCount, mode}` data and with zero Loop Clip-specific interaction.

## Automated gate evidence for the corrected build

Recorded on the final correction state on 2026-08-08:

- Focused D-57/D-58 recovery matrix: **pass** — 13 test files passed; 353 tests passed, 1 skipped.
- Focused structural cleanup matrix: **pass** — 9 test files passed; 175 tests passed, 1 skipped.
- Full `pnpm --dir app exec vitest run`: **pass** — 116 test files passed, 3 skipped; 1,521 tests passed, 1 skipped, 101 todo.
- `pnpm --dir app run typecheck`: **pass** — `tsc --noEmit` exited 0.
- `pnpm build`: **pass** — `@efxlab/efx-physic-paint` package and `efx-motion-editor` app builds exited 0.
- Phase 43 dependency diff for `app/package.json` and `pnpm-lock.yaml`: **pass** — no dependency-file changes.
- `git diff --check`: **pass**.
- User-run native tracer, Issue #0/#0b/#1/#2, numbered areas 1–20, and unsigned packaged smoke: **pass** — user approved the complete phase on 2026-08-08.

The final correction state is automated-green and native-approved. The user-operated development and unsigned packaged checks match every expected outcome below.

## Test conventions

- The user starts and operates the native app; the executor does not start the server.
- Run the separate Issue #0, Issue #0b, Issue #1, and Issue #2 checks plus Steps 1–19 in the native development app, then Step 20 in the unsigned packaged app.
- Use one saved working project for normal loops and separate copies for destructive/unresolved tests.
- Every result begins unchecked. Record `pass` or `fail`; for a failure, include the numbered check, observed behavior, and screenshot.
- Frame ranges are half-open: F10 with duration 25 occupies F10–F34 and ends before F35.
- Use the normal Undo/Redo controls and verify the visible data result, not only command availability.

## Prerequisites

1. Open or create a saved project with one parent Paint/Physics Paint layer and room for at least 80 frames.
2. Open EFX Paint/Roto for that layer and select a durable Play Script with visually distinguishable content.
3. Keep a no-loop track/project available for geometry comparison.
4. Keep an existing v0.8.1 project without `loopClips` for Step 15.
5. Use a recognizable 5-frame source cycle for the main scenarios.

---

## Issue #0 — Static/Hold Repeat-1 Loop Clip creation

**Actions**

1. Select an empty destination with room for at least ten frames.
2. Apply a Static/Hold Play Script with `Frames per cycle = 10`, finite `Repeat = 1`, and Infinity off.
3. Inspect the ten committed source keys, integrated Loop Rail, Scripts sidebar, and Edit Loop Clip route.
4. Repeat once with Progressive mode, fifteen frames, finite Repeat 1.
5. Arrange adjacent Progressive and Static/Hold Loop Clips, then inspect their Studio rail/cell boundaries, hover each rail tooltip, and inspect the matching passive markers in the Motion Editor PPaint bar.
6. Create another fresh Physics Paint layer with no prior keys, choose an active textured `canvas1`/paper background, then make its first operation a Progressive Play Script with `Frames per cycle = 5`, finite `Repeat = 2`, and Infinity off. Compare Physics Paint, main Studio, preview, and export.

**Expected outcome**

- Static/Hold commits ten real source keys and one canonical Loop Clip record in the same atomic transaction.
- The first Progressive Apply on a fresh layer is accepted without a pre-existing parent physical document; it atomically installs five real source keys, one Repeat-2 Loop Clip, and the current active background instead of reporting a rejected or timed-out physical commit.
- Physics Paint, main Studio, preview, and export show the same accepted textured background rather than transparent paint over the underlying photo.
- Immediately after Generate completes, the current Studio canvas displays the committed first frame; no playhead movement is required to refresh it.
- The Loop Clip uses those ten ordered source key IDs, stores Repeat 1, and immediately paints the integrated capsule rail across the source cycle.
- Selecting the rail exposes the Loop Clip inspector; double-click and focused Enter open Edit Loop Clip exactly once.
- No repeated destination keys or virtual occurrences are materialized for Repeat 1.
- Progressive Repeat 1 commits one canonical Loop Clip and paints a purple rail across the complete generated source cycle; Repeat 1 creates no repeated occurrences.
- Progressive rails are purple and Static/Hold rails are cyan; selected Studio rails use orange.
- The passive Motion Editor marker uses the same purple/cyan mode distinction and white canonical endpoint cuts while remaining textless and non-interactive.
- Every actual capsule start/end has a white rail cut and matching white boundary-cell border; adjacent clips visibly read as `|---clip 1---||---clip 2---|` with no false divider at a clipped viewport edge.
- Each rail tooltip explicitly shows `Mode: Progressive` or `Mode: Static/Hold`.
- One Undo removes the Static/Hold source cycle and Loop Clip together; one Redo restores both.

**Result:** [x] pass  [ ] fail

**Notes:**

---

## Issue #0b — Custom color palette remains accessible behind Play Script

**Actions**

1. Open Play Script and choose `Custom color`.
2. Drag the floating dialog away from the Studio brush palette.
3. Click several palette swatches and the custom color controls behind the dialog, then return focus to the dialog.
4. Press Tab from a dialog control and verify focus is not trapped; verify Escape and Generate still work when focus is inside the dialog.

**Expected outcome**

- No dark backdrop dims the Studio.
- Pointer interaction passes through every area outside the floating card; the card itself remains draggable and fully interactive.
- Palette changes update the live Custom color chip/value without closing or resetting the dialog.
- The surface is a non-modal labelled dialog, Tab may leave it, and Studio shortcuts remain contained while focus is inside it.

**Result:** [x] pass  [ ] fail

**Notes:**

---

## Issue #1 — Playback confirmation (separate result)

Keep this confirmation separate from Issue #2 Key Spacing so a cadence-edit failure cannot be reported as a playback-host failure or vice versa.

**Actions**

1. Create or open a valid linked Loop Clip with a visually distinct ordered source cycle and at least three repeats.
2. Play through the full interval in EFX Paint/Roto, then scrub backward and replay across repeat boundaries.
3. Confirm the same frames in main-editor preview without interacting with the passive marker.

**Expected outcome**

- Playback follows the complete ordered source cycle on every repeat and crosses repeat boundaries without skipping, duplicating, stalling, or materializing occurrences.
- EFX Paint/Roto playback and main-editor preview resolve the same source/generated frame at the same app frame.
- The integrated rail and passive Motion Editor marker remain presentation-only during playback; no selection, placement, repeat record, source key, or cache asset changes.
- This result is recorded independently from Issue #2.

**Result:** [x] pass  [ ] fail

**Notes:**

---

## Issue #2 — Rail-owned Key Spacing, cumulative ripple, and background recovery

**Actions**

1. Create adjacent Progressive capsule A followed by Static/Hold capsule B, both with recognizable stable real-key source cycles.
2. Plain-click rail A. Confirm only the rail line changes selection paint; source cells and linked occurrences stay unselected while the Scripts inspector targets A.
3. Shift-click rail B, then Cmd/Ctrl-click B to toggle it. Repeat with a non-contiguous third rail if available and with two rails sharing identical ordered `sourceKeyIds`.
4. Select a physical real key, then select a rail again. Confirm each mode clears the other selection and anchor synchronously.
5. Use Select All in physical mode. Confirm every real key is visibly selected, then attempt multi-capsule physical Key Spacing.
6. Turn Interpolation Off, rail-select B, and apply Key Spacing `2`.
7. Undo once. Turn Interpolation On and repeat the same B spacing operation.
8. Undo to the original fixture. Rail-select A and apply Key Spacing `2`.
9. Undo again. Plain-click A, Shift-click B, and apply Key Spacing `2` to both selected capsules.
10. Undo once, then Redo once.
11. Retry the multi-capsule operation near layer capacity so the proposed final mapping cannot fit.
12. On a fresh layer with active `canvas1`/paper background, make Progressive Play Script the first operation; compare Physics Paint, main Studio, preview, and export.
13. Change the active Paint background and apply another Play Script; compare the accepted parent composite again.
14. Save and reopen after a successful multi-capsule rail-selected spacing operation; inspect source rhythm, generated interiors, Loop Clip placements, rails, and shared-source identity.
15. On an ordinary non-loop fixture, repeat the previously accepted Shift/Cmd physical selection, Key Spacing ripple, Undo, and Redo workflow.

**Expected outcome**

- Plain rail click selects exactly one Loop Clip and its complete ordered source cycle while retaining the correct Scripts inspector/Edit target. Shift selects the inclusive contiguous canonical rail range; Cmd/Ctrl toggles non-contiguous rails without dropping the remaining selection. Identical selected cycles deduplicate at Apply time.
- Repeat zones preserve three distinct states: darkest ordinary repeat frames, subtly lighter neutral mirrored source-key rhythm frames, and a separate slate selected-mirror background. Selecting a physical key leaves the orange ring only on the original key; its repeated mirror keeps the slate background and repeat dot with no orange border, outline, or glow.
- Rail selection is visually line-only: source cells and equivalent linked occurrences receive no rail-derived orange frame treatment, `aria-selected`, or selected-source tooltip copy, while the selected complete cycles remain the exact invisible Key Spacing scope. Explicit physical same-cycle proxy selection remains visibly marked and non-draggable. Generated interiors, linked gaps, and unresolved frames remain navigation-only.
- Rail and physical selection never coexist. Entering either mode clears the other mode and anchor; Select All clears rail/proxy state and its visible physical keys are the exact operation scope.
- Multi-capsule physical Key Spacing rejects with explicit guidance to select Loop Rails. Partial physical spacing remains valid only inside one current ordered source cycle; stale, missing, reordered, duplicate-covered, or ambiguous authorization rejects before coordinator execution.
- Interpolation remains exactly as chosen. Off leaves two empty slots between accepted source keys; On derives generated blue in-betweens without materialized records or automatic mode changes.
- Spacing A keeps A's first source key anchored, expands its internal rhythm, and shifts every later real key right by A's exact growth. B's complete source cycle moves rigidly with that ripple; B's `placementStart`, cyan rail, and white endpoint boundaries follow by the same delta.
- Spacing A and B together processes their complete cycles left-to-right: B first receives A's cumulative growth, then B is spaced internally, and later content receives total growth. Loop IDs, source IDs, mode, repeat, Infinity, script provenance, motion, and override color remain unchanged.
- The complete records-plus-Loop-Clips result publishes once and creates one history command. One Undo restores both rhythms and placements; one Redo reapplies both. Capacity rejection changes nothing and creates no history entry.
- No linked occurrence is materialized, unlinked, cloned, or persisted as a new key. No rail or physical selection/provenance is persisted.
- First Play Script on a fresh layer succeeds without a pre-existing parent physical document and stores the current active background in the same transaction. Main Studio, preview, and export match Physics Paint. A later Play Script replaces stale parent background with the current accepted snapshot.
- Save/reopen preserves source rhythm, generated interiors, Loop Clip placements, rails, and shared-source identity exactly.
- Ordinary non-loop Key Spacing retains its accepted physical Shift/Cmd selection, ripple, Undo, and Redo behavior.

**Result:** [x] pass  [ ] fail

**Notes:**

---

## 1. Mandatory nine-check integrated tracer

**Actions**

1. Compare loop and no-loop EFX Paint/Roto tracks.
2. Inspect the physical row, cells, toolbar, rail, linked indicators, tooltip, click behavior, Edit routes, Scripts sidebar, and Motion Editor main timeline.

**Expected outcome — all nine must pass together**

1. Workflow strip remains exactly 161px with and without loops; physical row remains 38px; no extra row, track height, or vertical scrollbar appears.
2. The 24px cells, current/selected outlines, drag feedback, blue linked indicator, and 34px action toolbar remain fully visible and operable.
3. A loop renders exactly a 3px rail with a 12px interaction band; zero loops render no rail DOM, label, placeholder, or reserved space.
4. Hover shows the styled tooltip above the rail with derived display name, Cycle math, Effective duration, and status.
5. Plain rail click selects exactly one Loop Clip and its complete source cycle, updates the contextual Scripts sidebar, clears physical selection/proxy scope, and leaves the playhead and drag state unchanged. Shift/Cmd rail gestures extend or toggle the rail set without activating physical selection or opening another surface.
6. Double-click and focused Enter each open the existing `Edit Loop Clip` modal exactly once.
7. Normal script context shows Play; selected-loop context swaps that same slot to Lucide Pencil/Edit and shows name, source script, placement, Cycle, Effective, mode, and status.
8. Linked physical cells retain the accepted blue inset border and 4px top-right dot across normal/current/selected/drag states.
9. Motion Editor PPaint FX bar shows one exact 3px Progressive-purple or Static/Hold-cyan passive strip per canonical effective interval with white actual endpoint cuts, no false viewport-edge cuts, and no new row/height, text, badge, tooltip, hover/focus styling, own hit target, selection, keyboard route, navigation, Edit, drag, context menu, callback, command, or mutation. Generic FX-track behavior remains available beneath the paint.

**Result:** [x] pass  [ ] fail

**Notes:**

---

## 2. Finite 5-frame cycle × 5 resolution

**Actions**

1. In EFX Paint/Roto, apply a 5-frame source cycle with Repeat `5`, Infinity off.
2. Inspect the rail tooltip/sidebar and scrub the 25 resolved frames.

**Expected outcome**

- Tooltip/sidebar show `Cycle 5f × 5 = 25f`, `Effective 25f`, mode, and `Linked` status.
- Exactly 25 destination frames resolve as five repetitions of the same five source frames.
- Only five durable source keys/assets exist; repeat occurrences create no extra durable/cache assets.
- The rail contains no persistent Cycle badge, filmstrip thumbnails, or repetition band.

**Result:** [x] pass  [ ] fail

---

## 3. Infinity bounded by parent end

**Actions**

1. Open Edit Loop Clip locally and enable Infinity.
2. Update, then extend and shorten the parent duration where safe.

**Expected outcome**

- Tooltip/sidebar show `Cycle 5f × ∞`; `Infinityf` never appears.
- Effective range follows the current parent authored end and no farther.
- Parent changes re-derive geometry without source regeneration or asset growth.

**Result:** [x] pass  [ ] fail

---

## 4. Truncation and re-expansion

**Actions**

1. Place a real key or later loop inside a finite loop, first mid-cycle and then on a complete-cycle boundary.
2. Hover/select the first rail and inspect the sidebar.
3. Move the blocker farther right, then outside the requested range.

**Expected outcome**

- The later content is not pushed; Effective end is the next canonical boundary.
- The final 6px rail treatment is amber and text says `Loop shortened by next clip`.
- Requested Cycle math remains unchanged while Effective duration changes.
- Moving/removing the blocker re-expands the rail immediately without regeneration.
- The term `clip bloquant` never appears.

**Result:** [x] pass  [ ] fail

---

## 5. Effective 0f marker

**Actions**

1. Place blocking content exactly at a loop's placement start.
2. Inspect, focus, select, and edit the remaining marker; then move the blocker away.

**Expected outcome**

- The loop remains visible as the compact 8×6 flag with a 12×12 target.
- Tooltip/sidebar expose `Effective 0f` and the canonical shortened status.
- The marker remains selectable, keyboard-focusable, editable, and actionable without hiding the blocking cell.
- Removing the blocker re-expands the loop without regeneration.

**Result:** [x] pass  [ ] fail

---

## 6. Rail visual, focus, unresolved, busy, and reduced-motion states

**Actions**

1. Inspect normal, hover, selected, focused, truncated, and unresolved loops.
2. Trigger an operation long enough to observe busy state and an operation rejection.
3. Repeat with reduced motion enabled at OS level if available.

**Expected outcome**

- Normal/selected/focus/amber/red states follow the approved precedence and never change rail height or position.
- Focus remains visible over error; selection does not hide the amber terminal treatment.
- Busy keeps accepted geometry at reduced opacity with `aria-busy`; rejection preserves geometry/selection/focus and shows the reason.
- No new slide, scale, shimmer, pulse, width tween, or spring animation appears.

**Result:** [x] pass  [ ] fail

---

## 7. Rail keyboard model and no-popover boundary

**Actions**

1. Single-click a rail, then separately focus it and press Space.
2. Inspect selection, sidebar context, Tab order, Escape, Enter, Delete, Backspace, and arrow keys.

**Expected outcome**

- Single click and Space select the rail and update the contextual Scripts sidebar without mounting an anchored facts/actions dialog.
- Escape hides transient tooltip state without clearing rail selection or moving focus.
- Enter opens Edit Loop Clip exactly once through the Studio-local route.
- Delete/Backspace do not mutate the loop from rail focus; arrow keys do not move it.
- No `PhysicsPaintLoopClipPopover`, outside-click lifecycle, popover focus transfer, hidden menu, context menu, or specialized bridge substitute appears.

**Result:** [x] pass  [ ] fail

---

## 8. Contextual Scripts sidebar and script rename distinction

**Actions**

1. Select a normal script, then a Loop Clip.
2. Click the source script name, test Enter commit and Escape cancel, then click the primary Pencil/Edit button.
3. Test long names and the narrow supported sidebar width.

**Expected outcome**

- Normal context retains Play; loop context swaps only that slot to `Edit Loop Clip — {displayName}`.
- Inspector order is display name, source script, placement, Cycle, Effective, mode, status.
- Script name is renamed by clicking text; no dedicated rename Pencil remains.
- Rename never opens Edit Loop Clip; the primary Pencil/Edit never begins rename.
- Existing tab, resizer, scrollbar, other script actions, and toolbar row count remain unchanged.
- Long values ellipsize without horizontal scrolling and full values remain accessible.

**Result:** [x] pass  [ ] fail

---

## 9. Update loop and Edit source cycle with Undo/Redo

**Actions**

1. Open Edit Loop Clip from rail Enter/double-click and sidebar Edit.
2. Change Repeat/Infinity, update, Undo, and Redo.
3. Use `Edit source cycle…`, regenerate a shared source, Undo, and Redo.

**Expected outcome**

- All entry points target the same current loop through the Studio-local path.
- Loop Edit locks source fields and updates linked duration without regenerating source assets.
- Source Edit reports shared-loop count and regenerates the source once for every linked loop.
- Rejection preserves inputs/focus/current geometry; accepted operations close/update only after authority acknowledgement.
- Undo and Redo restore/reapply each complete atomic result.

**Result:** [x] pass  [ ] fail

---

## 10. Canonical loop operations and deferred action surface

**Actions**

1. Inspect the rail and contextual Scripts sidebar for the final approved controls.
2. Confirm the existing Edit Loop Clip / Edit Source Cycle flow remains available and no dedicated action popover appears.

**Expected outcome**

- The final surface exposes rail selection, tooltip facts, contextual sidebar facts, sidebar/rail Edit, and the existing floating Edit dialog only.
- Duplicate, Repair, Relink, Unlink, and Delete remain canonical controller operations with atomic authority/history regression coverage, but Phase 43 makes no native claim for new rail-triggered controls exposing them.
- No hidden menu, context menu, anchored dialog, optimistic mutation path, or specialized cross-window substitute is introduced.
- Existing controller tests continue proving unlink-only semantics, source preservation, exact acknowledgement, and atomic Undo/Redo independently of UI exposure.

**Result:** [x] pass  [ ] fail

---

## 11. Repair and Relink unresolved loops

**Actions**

1. Open an unresolved fixture whose loop retains dangling source references verbatim.
2. Inspect red rail, tooltip/sidebar status, marked preview placeholder, and export block.
3. Test Repair and Relink with rejection, acceptance, Undo, Redo, and save/reopen of an unrepaired copy.

**Expected outcome**

- Unresolved loop remains visible/selectable with `Source missing`; no raw UUID becomes product name.
- `Loop source missing` marks preview; export fails before partial output with the carried-forward actionable copy.
- Rejection preserves record, selection, focus, inputs, and geometry.
- Repair/regenerate and Relink use existing atomic authority paths; after acceptance, selection and keyboard focus return to the surviving selected rail target. Undo restores dangling references byte-for-byte and Redo reapplies repair/relink.
- Unrepaired save/reopen preserves the unresolved record verbatim.

**Result:** [x] pass  [ ] fail

**Fixture paths / notes:**

---

## 12. Link/Create and source sharing

**Actions**

1. Apply compatible options where an existing source cycle is available.
2. Test `Link to existing cycle`, then `Create new cycle` at another destination.

**Expected outcome**

- Link reuses ordered source key IDs/assets without rendering a new source cycle.
- Create generates an independent cycle.
- Editing the linked source updates every sharing loop; the independent cycle is unaffected.
- Rail/sidebar facts re-derive from canonical accepted state only.

**Result:** [x] pass  [ ] fail

---

## 13. Source-key and linked-frame guards

**Actions**

1. Attempt source-key delete, single-key drag, linked-occurrence drag, Force Spacing with no current rail/one-cycle physical authorization, multi-cycle physical selection, and Delete/Backspace on a purely linked frame.
2. Attempt Key Spacing from generated, gap, unresolved, stale, reordered, duplicate-covered, and ambiguous source authorization.
3. Invoke Clear on the linked frame; Undo and Redo.

**Expected outcome**

- Existing source-key delete and single-key/linked-drag rejections remain. D-11 permits only Issue #2's current rail-owned complete-cycle or one-cycle physical Key Spacing transaction; every unauthorized request rejects before coordinator execution.
- D-23 still treats linked occurrences as non-durable: exact source positions may reflect a valid session scope, while generated interiors, gaps, and unresolved frames remain navigation-only.
- Multi-cycle physical selection explicitly directs the user to Loop Rail selection; invalid authorization never falls back to a hidden proxy scope.
- Linked-frame Delete rejection refers to selecting the Loop Clip rail to delete the loop.
- Clear materializes one empty local real key, shortens at that boundary, preserves source, and remains atomic through Undo/Redo.
- Rail selection and physical-cell selection never remain active together.

**Result:** [x] pass  [ ] fail

---

## 14. Paint/erase materialization and physical-cell interactions

**Actions**

1. Paint or erase on a linked occurrence with no local real key; Undo and Redo.
2. Exercise plain click, Ctrl/Cmd toggle, Shift range selection, single-key drag, and rigid group drag below the rail.

**Expected outcome**

- Paint/erase materializes from resolved pixels, creates a local real key, and shortens the loop without mutating source/other occurrences.
- Undo/Redo restores/reapplies the complete result.
- Physical navigation, real-key selection, multi-selection, and drag behavior remain unchanged below y=12px.
- Rail event targets never start a physical drag or move the playhead.

**Result:** [x] pass  [ ] fail

---

## 15. Save/reopen and existing-project compatibility

**Actions**

1. Save/reopen a project with finite, Infinity, truncated, duplicated, shared, unresolved, and 0f loops.
2. Open an existing v0.8.1 project without `loopClips`.

**Expected outcome**

- Loop IDs, placement, ordered source refs, Repeat/Infinity, provenance, and sharing reopen unchanged.
- Accepted source real-key `appFrame` positions reopen as the timing authority; source offsets, cycle duration, generated interiors, Effective duration/status, and rail geometry are re-derived, not persisted as stale loop timing values.
- Repeated frames still reuse source assets.
- Existing v0.8.1 project opens without migration prompt, invented loops, or lost Paint data.
- No persisted loop-name field exists.

**Result:** [x] pass  [ ] fail

---

## 16. Valid-loop preview/export parity

**Actions**

1. Arrange finite Progressive, finite Static/Hold, parent-bounded Infinity, and truncated loops.
2. Scrub and export a native PNG sequence.

**Expected outcome**

- Export frame count/order matches the selected range and on-screen preview.
- Progressive and Static/Hold source cycles repeat deterministically with the authoritative non-uniform source-key cadence, including generated interiors.
- Infinity stops at parent end; truncation stops at the canonical next boundary.
- No valid exported frame is blank or contains an unresolved placeholder.
- Durable source assets remain proportional to source cycles, not repetitions.

**Result:** [x] pass  [ ] fail

**Export folder / notes:**

---

## 17. Motion Editor passive marker and generic timeline regression

**Actions**

1. Use normal main-timeline playhead, layer selection, drag, keyboard, zoom, scroll, playback, save, and preview behavior around a project containing loops.
2. Inspect the existing PPaint FX bar at each canonical effective interval and at former capsule coordinates.

**Expected outcome**

- The PPaint FX bar paints one exact 3px Progressive-purple or Static/Hold-cyan strip per canonical effective interval with white actual endpoint cuts, no false clipped-edge cuts, no new row/height, and no text, badge, tooltip, hover/focus styling, or own hit target.
- Generic timeline behavior is unchanged beneath the marker paint.
- Loop-resolved physical output still previews/plays/saves/exports correctly.
- No Loop Clip-specific selection, keyboard route, navigation, Edit, drag, context menu, callback, command, or mutation appears anywhere on the Motion Editor timeline.

**Result:** [x] pass  [ ] fail

---

## 18. Many loops, horizontal scroll, and long text

**Actions**

1. Create several non-overlapping loops across a long physical timeline with long script names.
2. Scroll horizontally and inspect tab order, rail clipping/reappearance, tooltip, and sidebar.

**Expected outcome**

- All loops share the same 3px overlay and follow placement order; no row stacking or extra scrollbar appears.
- Rail segments clip at the viewport and reappear on scroll.
- One target per loop participates in tab order; no subdivision becomes a focus target.
- Long text wraps/ellipsizes accessibly and never falls back to raw identifiers.

**Result:** [x] pass  [ ] fail

---

## 19. No placement drag and no optimistic publication

**Actions**

1. Pointer-down/move across a selected rail and attempt common drag gestures.
2. Trigger a rejected or delayed loop operation while observing rail/sidebar facts.

**Expected outcome**

- Cursor remains pointer; there is no grab/grabbing state, pointer capture, drag preview, drop target, threshold, or placement mutation.
- Existing horizontal scroll remains usable.
- Rail/sidebar remain on prior accepted geometry/facts until canonical accepted state arrives.
- Rejection leaves prior state intact and announces the reason.

**Result:** [x] pass  [ ] fail

---

## 20. Unsigned packaged-app smoke

**Build under test**

`/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app`

This is a local unsigned package smoke. Do not sign, notarize, staple, inspect certificates, access Keychain certificate data, use Apple credentials, or access release secrets.

**Actions**

1. Launch the unsigned packaged app using the normal local workflow.
2. Open valid and unresolved loop projects.
3. Check integrated rail/tooltip/sidebar/Edit behavior and the absence of a dedicated actions popover, plus valid preview/export, unresolved placeholder/export block, and the Motion Editor passive-marker-only contract.

**Expected outcome**

- App launches without a dev server.
- Integrated rail remains 3px inside the unchanged row; tooltip/sidebar/Edit work locally and no dedicated actions popover is mounted.
- Valid preview/export parity and unresolved placeholder/export block match development behavior.
- Motion Editor shows only passive 3px mode-colored PPaint FX-bar markers with white actual endpoint cuts and exposes zero Loop Clip-specific interaction.
- No signing/notarization/credential/certificate flow occurs; signed downloaded-artifact UAT remains Phase 44 scope.

**Result:** [x] pass  [ ] fail

---

## Verdict

- [x] Approved — separate Issue #0, Issue #0b, Issue #1, and Issue #2 results plus every numbered area 1–20 match their expected outcomes.
- [ ] Issues reported — list every failing numbered step below with screenshots.

**User feedback:**

2026-08-08 — “congrats I approve all for this phase”
