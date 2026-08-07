---
phase: 43
plan: 10
kind: uat-record
status: pending-correction-execution
created: 2026-08-07
revised: 2026-08-07
builds_under_test:
  - user-run native development app
  - unsigned local packaged app
packaged_app: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app
---

# Phase 43 Plan 10 — Native UAT: Integrated Loop Rail and Linked Loop Clips

## Historical failed attempt

The first native attempt stopped at old Step 1 on 2026-08-07. The Loop Clip capsule and interactions had been placed on the Motion Editor main timeline (`PPaint #1`) instead of the EFX Paint/Roto physical-frame editing surface. No later step was executed. The rejected separate-lane/full-capsule direction is not acceptance evidence.

This script replaces that failed surface contract. All Loop Clip presentation and authoring checks now occur exclusively inside EFX Paint/Roto through the integrated Loop Rail, local actions popover, contextual Scripts sidebar, and existing Studio-local edit modal.

## Automated gate evidence for the corrected build

To be filled by Plan 43-15 only after the final correction state passes every command:

- Focused HOLD/UI matrix: pending.
- Full `pnpm --dir app exec vitest run`: pending.
- `pnpm --dir app run typecheck`: pending.
- `pnpm build`: pending.
- Phase 43 dependency diff for `app/package.json` and `pnpm-lock.yaml`: pending.
- 43-11 native tracer approval: pending.

Do not begin the resumed Plan 43-10 Task 2 until the entries above contain actual successful outcomes and `43-11-SUMMARY.md` through `43-15-SUMMARY.md` exist.

## Test conventions

- The user starts and operates the native app; the executor does not start the server.
- Run Steps 1–19 in the native development app and Step 20 in the unsigned packaged app.
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

## 1. Mandatory nine-check integrated tracer

**Actions**

1. Compare loop and no-loop EFX Paint/Roto tracks.
2. Inspect the physical row, cells, toolbar, rail, linked indicators, tooltip, click behavior, Edit routes, Scripts sidebar, and Motion Editor main timeline.

**Expected outcome — all nine must pass together**

1. Workflow strip remains exactly 161px with and without loops; physical row remains 38px; no extra row, track height, or vertical scrollbar appears.
2. The 24px cells, current/selected outlines, drag feedback, blue linked indicator, and 34px action toolbar remain fully visible and operable.
3. A loop renders exactly a 3px rail with a 12px interaction band; zero loops render no rail DOM, label, placeholder, or reserved space.
4. Hover shows the styled tooltip above the rail with derived display name, Cycle math, Effective duration, and status.
5. Single click selects only the Loop Clip, opens local actions, updates the sidebar, and leaves playhead, physical selection, multi-selection, and drag state unchanged.
6. Double-click and focused Enter each open the existing `Edit Loop Clip` modal exactly once.
7. Normal script context shows Play; selected-loop context swaps that same slot to Lucide Pencil/Edit and shows name, source script, placement, Cycle, Effective, mode, and status.
8. Linked physical cells retain the accepted blue inset border and 4px top-right dot across normal/current/selected/drag states.
9. Motion Editor main timeline exposes no Loop Clip drawing, label, badge, hit region, tooltip, selection, keyboard target, context action, or edit command.

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

---

## 3. Infinity bounded by parent end

**Actions**

1. Open Edit Loop Clip locally and enable Infinity.
2. Update, then extend and shorten the parent duration where safe.

**Expected outcome**

- Tooltip/sidebar show `Cycle 5f × ∞`; `Infinityf` never appears.
- Effective range follows the current parent authored end and no farther.
- Parent changes re-derive geometry without source regeneration or asset growth.

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

---

## 7. Local actions popover and keyboard model

**Actions**

1. Single-click a rail, then separately focus it and press Space.
2. Inspect facts/actions, Tab order, Escape, outside click, Enter, Delete, Backspace, and arrow keys.

**Expected outcome**

- One labelled non-modal popover shows Source script, Placement, Cycle, Effective, Mode, Status, then applicable actions in this order: Duplicate, Repair, Relink, Unlink, Delete.
- Pointer-open preserves the rail trigger; Space-open moves to the first action; Escape restores the trigger; outside click closes only the popover and retains loop selection/sidebar context.
- Enter opens Edit Loop Clip exactly once.
- Delete/Backspace do not mutate the loop from rail focus; arrow keys do not move it.
- Popover clamps to the viewport, wraps/ellipsizes long facts, and scrolls only internally.

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

---

## 10. Duplicate, Unlink, and Delete

**Actions**

1. Duplicate to a valid empty destination; test Cancel and an invalid/rejected destination first.
2. Undo/Redo the accepted duplicate.
3. Unlink and Delete through explicit popover controls, with Undo/Redo for each.

**Expected outcome**

- Invalid/rejected Duplicate preserves the active flow, input, focus, selection, and reason; accepted Duplicate creates one new loop sharing source references with no regeneration.
- Unlink and Delete remove only the loop record and preserve source keys/assets.
- No operation double-dispatches while pending.
- Accepted Duplicate returns selection and keyboard focus to the surviving selected rail target.
- Accepted Unlink or Delete moves selection and focus to the nearest visible Loop Clip by canonical placement order; if no Loop Clip survives, focus moves to the Scripts tab and normal script context with Play is restored.
- Undo/Redo restores/reapplies exact loop placement/source identity.

**Result:** [ ] pass  [ ] fail

---

## 11. Repair and Relink unresolved loops

**Actions**

1. Open an unresolved fixture whose loop retains dangling source references verbatim.
2. Inspect red rail, tooltip/sidebar/popover, marked preview placeholder, and export block.
3. Test Repair and Relink with rejection, acceptance, Undo, Redo, and save/reopen of an unrepaired copy.

**Expected outcome**

- Unresolved loop remains visible/selectable with `Source missing`; no raw UUID becomes product name.
- `Loop source missing` marks preview; export fails before partial output with the carried-forward actionable copy.
- Rejection preserves record, selection, focus, inputs, and geometry.
- Repair/regenerate and Relink use existing atomic authority paths; after acceptance, selection and keyboard focus return to the surviving selected rail target. Undo restores dangling references byte-for-byte and Redo reapplies repair/relink.
- Unrepaired save/reopen preserves the unresolved record verbatim.

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

---

## 13. Source-key and linked-frame guards

**Actions**

1. Attempt source-key delete, single-key drag, invalid Force Spacing, and Delete/Backspace on a purely linked frame.
2. Invoke Clear on the linked frame; Undo and Redo.

**Expected outcome**

- Existing exact source-key delete and rigid-group drag rejections remain.
- Linked-frame Delete rejection now refers to selecting the Loop Clip rail to delete the loop.
- Clear materializes one empty local real key, shortens at that boundary, preserves source, and remains atomic through Undo/Redo.
- Rail selection and physical-cell selection do not leak into one another.

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

---

## 15. Save/reopen and existing-project compatibility

**Actions**

1. Save/reopen a project with finite, Infinity, truncated, duplicated, shared, unresolved, and 0f loops.
2. Open an existing v0.8.1 project without `loopClips`.

**Expected outcome**

- Loop IDs, placement, ordered source refs, Repeat/Infinity, provenance, and sharing reopen unchanged.
- Effective duration/status/rail geometry are re-derived, not persisted stale values.
- Repeated frames still reuse source assets.
- Existing v0.8.1 project opens without migration prompt, invented loops, or lost Paint data.
- No persisted loop-name field exists.

**Result:** [ ] pass  [ ] fail

---

## 16. Valid-loop preview/export parity

**Actions**

1. Arrange finite Progressive, finite Static/Hold, parent-bounded Infinity, and truncated loops.
2. Scrub and export a native PNG sequence.

**Expected outcome**

- Export frame count/order matches the selected range and on-screen preview.
- Progressive and Static/Hold source cycles repeat deterministically.
- Infinity stops at parent end; truncation stops at the canonical next boundary.
- No valid exported frame is blank or contains an unresolved placeholder.
- Durable source assets remain proportional to source cycles, not repetitions.

**Result:** [ ] pass  [ ] fail

**Export folder / notes:**

---

## 17. Motion Editor generic timeline regression

**Actions**

1. Use normal main-timeline playhead, layer selection, drag, keyboard, zoom, scroll, playback, save, and preview behavior around a project containing loops.

**Expected outcome**

- Generic timeline behavior is unchanged.
- Loop-resolved physical output still previews/plays/saves/exports correctly.
- No Loop Clip UI or action appears anywhere on the Motion Editor timeline, including former capsule coordinates.

**Result:** [ ] pass  [ ] fail

---

## 18. Many loops, horizontal scroll, and long text

**Actions**

1. Create several non-overlapping loops across a long physical timeline with long script names.
2. Scroll horizontally and inspect tab order, rail clipping/reappearance, tooltip, popover, and sidebar.

**Expected outcome**

- All loops share the same 3px overlay and follow placement order; no row stacking or extra scrollbar appears.
- Rail segments clip at the viewport and reappear on scroll.
- One target per loop participates in tab order; no subdivision becomes a focus target.
- Long text wraps/ellipsizes accessibly and never falls back to raw identifiers.

**Result:** [ ] pass  [ ] fail

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

**Result:** [ ] pass  [ ] fail

---

## 20. Unsigned packaged-app smoke

**Build under test**

`/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app`

This is a local unsigned package smoke. Do not sign, notarize, staple, inspect certificates, access Keychain certificate data, use Apple credentials, or access release secrets.

**Actions**

1. Launch the unsigned packaged app using the normal local workflow.
2. Open valid and unresolved loop projects.
3. Check integrated rail/sidebar/popover/Edit behavior, valid preview/export, unresolved placeholder/export block, and Motion Editor exclusion.

**Expected outcome**

- App launches without a dev server.
- Integrated rail remains 3px inside the unchanged row; sidebar/popover/Edit work locally.
- Valid preview/export parity and unresolved placeholder/export block match development behavior.
- Motion Editor remains free of Loop Clip UI.
- No signing/notarization/credential/certificate flow occurs; signed downloaded-artifact UAT remains Phase 44 scope.

**Result:** [ ] pass  [ ] fail

---

## Verdict

- [ ] Approved — every numbered area 1–20 matches its expected outcome.
- [ ] Issues reported — list every failing numbered step below with screenshots.

**User feedback:**

Pending native UAT through existing Plan 43-10 Task 2.
