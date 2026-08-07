---
phase: 43
plan: 10
kind: uat-record
status: failed
failed_at: step-1
failure_kind: scope-mismatch
created: 2026-08-07
builds_under_test:
  - user-run native development app
  - unsigned local packaged app
packaged_app: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app
---

# Phase 43 Plan 10 — Native UAT: Linked Loop Clips and Filmstrip Capsule

## Gate evidence before UAT

The executor completed the automated integration gates on 2026-08-07:

- Full suite: `114` test files passed, `3` skipped; `1527` tests passed, `1` skipped, `101` todo; `0` failed.
- Typecheck: passed.
- Monorepo production build: passed; production main chunk `1,012.28 kB` under the locked `1,100 kB` desktop budget.
- Dependency drift: passed from the parent of the first Phase 43 commit (`fa13febd512d7f1ebce79d7de45bf2d62716ebbb`) through the integrated Phase 43 HEAD; no changes to `app/package.json` or `pnpm-lock.yaml`.
- Unsigned macOS package: built with Tauri `--bundles app --no-sign --ci`; signing was explicitly skipped. No signing identity, certificate, Apple credential, notarization material, release secret, or Keychain certificate content was accessed.
- Packaged app under test: `/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app`.

## Test conventions

- Run Steps 1–19 in the native development app that you start on your side.
- Run Step 20 in the unsigned packaged app at the path above. This is only a local package smoke test; signed/notarized downloaded-artifact UAT remains Phase 44 scope.
- Use one saved working project for normal loop tests and separate copies for destructive/unresolved tests.
- Record `pass` or `fail` in each result row. For a failure, include the exact numbered step, observed behavior, and a screenshot.
- Frame ranges below use half-open semantics: a range starting at F10 with duration 25 occupies F10–F34 and ends before F35.
- When this script asks for Undo or Redo, use the application's normal Undo/Redo controls or shortcuts and verify the visible data result, not only that a command was accepted.

## Prerequisites

1. Open or create a saved project with one parent Paint/Physics Paint layer and enough room for at least 80 frames.
2. Open EFX Paint for that layer and select a durable Play Script with visually distinguishable paint content. A script with both paint and erase strokes is preferred.
3. Keep at least one existing v0.8.1 project available for the compatibility check in Step 15.
4. Use a short, recognizable 5-frame source cycle for most checks so the repetition order can be inspected visually.

---

## 1. Finite 5-frame cycle × 5 loop

**Actions**

1. In EFX Paint, apply the selected Play Script at an empty destination using a 5-frame source cycle.
2. Select either Progressive or Static / Hold, set Repeat to `5`, leave Infinity off, and create the loop.
3. Return to the main timeline and inspect the capsule, timeline frames, source keys, and preview from the loop start through 25 frames.

**Expected outcome**

- The capsule badge reads exactly `Cycle 5f × 5 = 25f`.
- The loop resolves exactly 25 destination frames in five repetitions of the same five source frames.
- Only five durable source real keys/assets exist for the cycle; the repeated occurrences are linked/virtual and do not create 20 extra durable source assets.
- Preview order is source 1, 2, 3, 4, 5, then the same order four more times.
- Repeated linked cells have no real-key diamonds.

**Result:** [ ] pass  [x] fail

**Notes:**

- Scope failure: the Loop Clip capsule and its interactions were implemented on the Motion Editor main timeline (`PPaint #1`) instead of the EFX Paint/Roto physical-frame editing surface.
- Verification stopped at Step 1. No later UAT steps were executed.
- Correction decision: remove the main-timeline capsule and move the full workflow into a dedicated EFX Paint/Roto Loop Clip lane before UAT restarts.

---

## 2. Infinity loop bounded by parent end

**Actions**

1. Click the loop badge and enable Infinity in loop-edit mode.
2. Choose `Update loop`.
3. Inspect the badge and scrub from the loop start to the current parent Paint end.
4. If the parent duration can be changed safely in the working project, extend it and then shorten it.

**Expected outcome**

- The badge reads exactly `Cycle 5f × ∞`; it never displays `Infinityf`.
- The effective loop reaches the parent Paint authored end and no farther.
- Extending the parent grows the effective loop and shortening the parent shrinks it without regenerating source keys/assets.
- The source-cycle durable asset count remains five.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 3. Next-clip truncation: partial and complete cycles

**Actions**

1. Return the loop to a finite repeat large enough to reach beyond the test boundaries.
2. Place a new real key or later Loop Clip at a frame that interrupts the first loop midway through a five-frame cycle.
3. Hover the first loop's truncation edge.
4. Move the blocker to a frame that lands exactly on a complete five-frame cycle boundary and hover again.

**Expected outcome**

- The first loop ends at the next clip/key start; the later clip is not pushed.
- A forward-leaning amber diagonal cuts the whole trailing capsule edge.
- For the partial interruption, the diagonal lands inside the final repeated cell and the tooltip contains `Loop shortened by next clip (partial cycle)`.
- For the complete-cycle interruption, the diagonal lands exactly on the cycle boundary and the tooltip contains `Loop shortened by next clip (complete cycles)`.
- The compact math badge continues to show the requested duration and does not change to the effective duration.
- The prohibited term `clip bloquant` does not appear.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 4. Re-expansion after moving or removing the next clip

**Actions**

1. With the loop truncated as in Step 3, move the blocking real key/later loop farther right.
2. Observe the first loop.
3. Remove or move the blocker completely outside the first loop's requested range.

**Expected outcome**

- The first loop re-expands immediately to the newly available effective end.
- Removing the blocker restores the requested finite duration, or the parent end for Infinity.
- Re-expansion performs no source regeneration and creates no duplicate source assets.
- The capsule, preview, and linked occurrences all update together.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 5. Capsule at all three zoom bands

**Actions**

1. Zoom the timeline until one frame is at least 16 px wide.
2. Zoom to a middle scale where one frame is 8–15 px wide.
3. Zoom out until one frame is below 8 px wide.
4. Repeat the inspection with a truncated loop if practical.

**Expected outcome**

- At `≥16 px/frame`, repetitions render as lighter ghost linked cells with dashed borders, no thumbnails, and no diamonds.
- At `8–15 px/frame`, repetitions render as a compact perforated/hatched band plus the badge.
- At `<8 px/frame`, repetitions render as a solid compact band plus badge; label clipping/hiding is clean and never overlaps unrelated timeline content.
- The source-cycle region remains the visual anchor where space permits.
- The amber truncation diagonal remains visible at all three zoom bands.
- Capsule geometry stays aligned to the same frames while zooming.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 6. Badge click, loop edit, Update loop, Undo, and Redo

**Actions**

1. With EFX Paint Studio already open, click the capsule's compact math badge.
2. Verify loop-edit mode, change Repeat from its current value to a different valid value, and choose `Update loop`.
3. Undo once, then Redo once.
4. Close EFX Paint Studio completely.
5. Click the capsule badge again and wait for the Studio to launch/focus and show loop-edit mode.

**Expected outcome**

- With Studio open or closed, badge click opens `Edit Loop Clip` for the targeted loop.
- Loop-edit mode exposes Repeat, Infinity, and Requested/Effective readout; source fields and Frames per cycle remain locked with their values preserved.
- Primary action reads `Update loop`; secondary action reads `Edit source cycle…`.
- Update changes linked duration without regenerating the source cycle.
- One Undo restores the exact prior Repeat/Infinity state and prior capsule duration.
- One Redo restores the new Repeat/Infinity state and new capsule duration.
- The Studio-closed path does not create duplicate operations or apply the edit more than once.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 7. Edit source cycle regeneration, shared count, Undo, and Redo

**Actions**

1. Ensure at least two loops share the same source cycle; Step 9 can create the second loop first if needed.
2. Open loop edit and choose `Edit source cycle…`.
3. Change a visible source option, such as Motion or Frames per cycle, then choose `Regenerate source cycle`.
4. Inspect every linked loop.
5. Undo once, then Redo once.

**Expected outcome**

- The dialog title is `Edit Source Cycle` and fields are prefilled from the current source cycle.
- The notice says confirming regenerates the source cycle and updates every linked Loop Clip referencing it.
- When shared, it says `This source cycle is shared by {N} loops.` with the correct count.
- Confirmation regenerates the source exactly once and every linked loop resolves the updated cycle.
- Requested/effective duration and truncation are re-derived for every linked loop.
- One Undo restores the prior source cycle and prior loop resolutions.
- One Redo restores the regenerated source cycle and updated loop resolutions.
- No partial destination state remains if regeneration is cancelled or fails.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 8. Link to existing cycle versus Create new cycle

**Actions**

1. Apply the same script with options identical to an existing compatible source cycle.
2. Verify the apply-time choice appears.
3. Choose `Link to existing cycle` and complete the apply.
4. Repeat at another empty destination with the same options, choose `Create new cycle`, and complete the apply.

**Expected outcome**

- The segmented choice appears only when an identical compatible source cycle exists.
- Options read exactly `Link to existing cycle` and `Create new cycle`.
- Link reuses the existing source key IDs/assets and creates only a new loop record; no source rendering/regeneration occurs.
- Create generates an independent source cycle with independent durable source keys/assets.
- Editing the linked source later updates loops sharing it; the independently created cycle remains unaffected.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 9. Duplicate, Unlink, Delete loop, and placement/source identity

**Actions**

1. On a selected capsule, invoke `Duplicate linked loop` and choose an empty destination start.
2. Inspect the duplicate at the destination and its source identity.
3. Undo once and Redo once.
4. Invoke `Unlink loop` on the duplicate; Undo once and Redo once.
5. Restore or create another duplicate, invoke `Delete loop`, then Undo once and Redo once.
6. Rigid-group drag the original source-cycle keys and compare the original loop with a duplicate placed elsewhere.

**Expected outcome**

- Duplicate creates one new capsule at the chosen destination with the same source thumbnails/key references and no source regeneration.
- The duplicated first-cycle cells show shared thumbnails with dashed linked styling, no real-key diamonds, and linked-occurrence click behavior rather than selecting a destination real key.
- Clicking a linked first-cycle/repeated occurrence selects the Loop Clip and opens occurrence details; it does not move the playhead automatically.
- Duplicate Undo removes only the duplicate loop; Redo restores it at the same destination with the same source references.
- Unlink removes only the loop reference; source-cycle real keys remain. Undo restores the loop; Redo removes it again.
- Delete loop is also unlink-only. Undo restores the loop; Redo removes it again; source keys/assets remain throughout.
- Rigid group drag moves the original loop that is anchored to its source keys, while a duplicate keeps its independent destination `placementStart` and continues to resolve the moved shared source keys.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 10. Linked-source and linked-frame guards

**Actions**

1. Try to delete a source-cycle real key while a loop references it.
2. Try to drag one linked source key individually.
3. Select linked source keys and try Force Spacing without selecting/moving the whole cycle as a rigid group.
4. On a linked repetition frame that has no local real key, press Delete/Backspace.
5. On that linked frame, invoke Clear.
6. Undo and Redo the Clear materialization.

**Expected outcome**

- Source-key deletion is rejected with `This key belongs to a source cycle used by {N} linked loop(s). Unlink the loop(s) before deleting it.`
- Single-key drag and invalid Force Spacing are rejected with `Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it.`
- Delete/Backspace on a linked frame is rejected exactly: `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.`
- Clear materializes one local empty real key at the current frame, keeps the source cycle untouched, and shortens the loop at that boundary.
- One Undo removes the empty local key and re-expands the loop; Redo restores the empty key and shortened loop.
- No rejected action mutates loop records, source keys, or selection unexpectedly.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 11. Paint on a linked frame materializes a local key

**Actions**

1. Seek to a linked repetition frame with no local real key.
2. Paint or erase a visible stroke.
3. Inspect the timeline, preview, and loop end.
4. Undo once and Redo once.

**Expected outcome**

- The linked resolved pixels become the base for a new local real key plus the new paint/erase stroke.
- A real-key marker appears at the current frame.
- The loop shortens at that frame because the local key becomes the next-content boundary.
- Canvas and playhead stay on the edited frame.
- The source-cycle key and every other linked occurrence remain unchanged.
- Undo removes the local key and re-expands the loop; Redo restores the materialized key and shortened loop.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 12. Zero-effective anchor flag

**Actions**

1. Place valid blocking content or another loop exactly at a loop's `placementStart` so Effective becomes `0f`.
2. Inspect and interact with the remaining marker.
3. Move the blocker away.

**Expected outcome**

- The loop record survives and renders as a slim grey `0f` anchor flag at its placement start; it never disappears.
- Tooltip reads `Cycle 5f × 5 = 25f · Effective 0f — fully shortened by the next clip` for the matching fixture values.
- The flag is clickable, selectable, keyboard-focusable, editable, unlinkable, and deletable.
- Its hit target does not hide or steal the blocking real key's target.
- Moving the blocker away re-expands the full capsule without regeneration.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 13. Linked occurrence tooltip and source seek

**Actions**

1. Click a linked occurrence corresponding to repeat 3, source frame 2 of a 5-frame cycle.
2. Inspect the pinned tooltip.
3. Invoke `Edit source frame`.

**Expected outcome**

- Tooltip includes exactly `Repeat 3 · Source frame 2 of 5` for that occurrence.
- The initial linked-occurrence click selects the loop but does not automatically move the playhead.
- `Edit source frame` seeks to and selects the modulo-resolved real source key.
- Ghost/linked cells are never exposed as selectable real keys at their destination frames.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 14. Studio workflow-strip additive link badge

**Actions**

1. Open EFX Paint Studio for a layer containing real source keys, ordinary empty/cached/generated cells, linked occurrences, and if available an unresolved linked occurrence.
2. Compare cell geometry, fill palette, key diamonds, and linked badges.

**Expected outcome**

- Linked repetition cells gain only an inset accent border and a small top-right link dot.
- Existing 18×24 cell geometry and spacing do not change.
- Existing empty/cached/generated/background-only palette and legend remain unchanged.
- Source-cycle real keys keep their real-key diamonds.
- Linked occurrences do not gain diamonds or become a new first-class cell state.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 15. Save/reopen and v0.8.1 compatibility

**Actions**

1. Save the working Phase 43 project containing finite, Infinity, truncated, duplicated, and source-sharing loops.
2. Close the project/app and reopen it.
3. Scrub the same ranges and inspect capsules, badges, source sharing, and preview.
4. Separately open an existing v0.8.1 project that has no `loopClips` collection.

**Expected outcome**

- Every saved Loop Clip reopens with the same ID, placement, ordered source references, Repeat/Infinity state, provenance, and source sharing.
- Effective duration and truncation are recomputed correctly; they are not stale persisted values.
- Reopened preview/capsule output matches the pre-save output.
- The repeated frames still reuse source assets; save/reopen does not materialize repeated assets.
- The v0.8.1 project opens unchanged with no migration prompt, no invented loops, no lost Paint data, and no format-break behavior.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 16. Unresolved-loop placeholder and export block

**Actions**

1. Use an unresolved fixture prepared in Step 18, or another project whose loop contains a dangling source-key reference.
2. Scrub before, onto, and after the affected linked frame.
3. Attempt PNG sequence export including the affected frame.

**Expected outcome**

- Preview/playback shows a marked non-blank placeholder reading `Loop source missing` at the unresolved frame.
- Neighboring resolvable frames continue to preview normally.
- Export fails before directory creation or frame rendering with `Export blocked — Loop Clip at frame {S} references a missing source frame ({F}). Repair or unlink the loop, then export again.` using the fixture's substituted frames.
- No placeholder or partial deliverable is exported.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 17. Capsule keyboard model

**Actions**

1. Move timeline keyboard focus to a capsule.
2. Inspect the focus ring.
3. Press Enter, then Escape.
4. Focus/select a disposable duplicate capsule and press Delete or Backspace.
5. Undo once and Redo once.

**Expected outcome**

- The capsule participates as one focus unit and shows a visible accent focus ring around the whole capsule.
- Enter opens/pins the capsule tooltip and actions.
- Escape closes the tooltip/actions and returns focus to the timeline host.
- Delete/Backspace invokes unlink-only `Delete loop` through Studio authority; it never deletes source keys.
- The UI clears selection only after a matching successful acknowledgement; rejection keeps focus/selection and shows the reason.
- Undo restores the deleted loop and Redo removes it again.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## 18. Unresolved-loop Repair, Relink, Undo/Redo, and verbatim persistence

### 18A. Prepare fixtures with the executor

**Actions**

1. Save a copy of a working loop project containing a source cycle with at least two keys and one linked loop. Name it clearly, for example `phase43-unresolved-source.mce`.
2. Close that project so it is not being written.
3. Send the executor the exact saved file path. The executor will make two safe copies and remove one referenced source-cycle key entry from each saved JSON while leaving the loop's `sourceKeyIds` array untouched:
   - repair fixture, for example `phase43-unresolved-repair.mce`;
   - relink/persistence fixture, for example `phase43-unresolved-relink.mce`.
4. Do not manually normalize or remove the dangling loop reference; the unresolved record must remain verbatim.

**Expected outcome**

- Both fixture files retain the original loop record and dangling source reference exactly.
- Only a source-cycle real-key entry is removed; unrelated project data is unchanged.
- The executor reports the prepared fixture paths before native testing continues.

### 18B. Repair flow

**Actions**

1. Open the repair fixture natively.
2. Inspect the unresolved capsule and tooltip, then invoke `Repair loop…`.
3. Verify the prefilled source-edit flow and choose `Regenerate source cycle`.
4. Inspect preview and export availability.
5. Undo once and Redo once.

**Expected outcome**

- The unresolved capsule remains visible with a red error outline.
- The error tooltip lists every missing reference, one per line, then says `Repair, relink, unlink, or delete the loop.`
- `Repair loop…` opens the prefilled source-edit flow.
- `Regenerate source cycle` recreates the source keys and retargets the loop in one atomic commit.
- Placeholders are replaced by real linked content and export becomes available.
- One Undo restores the unresolved record and its dangling references byte-for-byte, restoring red capsule/placeholder/export block.
- One Redo reapplies the repaired source cycle and retargeted resolved loop.

### 18C. Relink flow

**Actions**

1. Open a fresh relink fixture containing an unresolved loop and a separate compatible existing source cycle.
2. Invoke `Relink loop…` and choose the compatible source cycle.
3. Inspect the resolved loop.
4. Undo once and Redo once.

**Expected outcome**

- Relink reuses the chosen compatible existing source cycle without regenerating it.
- The loop re-resolves against the new ordered source references; red error styling and placeholders disappear.
- One Undo restores the original unresolved loop record and dangling references verbatim.
- One Redo reapplies the relinked resolved state.

### 18D. Unrepaired save/reopen preservation

**Actions**

1. Reopen a fresh unresolved fixture or Undo back to the unresolved state.
2. Save it without repairing, close it, and reopen it.

**Expected outcome**

- The unresolved loop survives save/reopen.
- The dangling source references are preserved exactly; they are never dropped, rewritten, or normalized.
- Red error capsule, missing-reference tooltip, marked placeholder, and export block remain available after reopen so repair is still possible.

**Result:** [ ] pass  [ ] fail

**Notes / fixture paths:**

---

## 19. Valid-loop PNG sequence export parity

**Actions**

1. In one project, arrange four non-overlapping valid loop cases within the export range:
   - finite Progressive loop;
   - finite Static / Hold loop;
   - Infinity loop bounded by parent end;
   - finite loop truncated by a later real key or Loop Clip.
2. Scrub and note the expected visible source-cycle order and total export range.
3. Export the range as a native PNG sequence.
4. Inspect the number and ordering of PNG files and compare representative exported frames to the on-screen preview.
5. Save/reopen the project and verify durable source keys/assets remain proportional to source cycles, not repetitions.

**Expected outcome**

- Exported PNG count exactly matches the selected frame range.
- Progressive repetition restarts its source build each cycle; for a five-frame source the visible order repeats 1→2→3→4→5.
- Static / Hold repetition shows the intended complete held drawing on every source-cycle frame and repeats that deterministic cycle.
- Infinity exports only through the current parent end.
- The truncated loop stops at the next-content boundary, including correct partial-cycle order when applicable.
- No exported frame is blank or contains the unresolved placeholder.
- Representative PNGs are visually identical to the corresponding on-screen preview frames.
- The saved project contains no duplicated durable source assets for repeated occurrences; changing repeat count does not increase the durable source-key count.

**Result:** [ ] pass  [ ] fail

**Notes / export folder:**

---

## 20. Unsigned packaged-app smoke

**Build under test**

`/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app`

This app was built locally with signing explicitly disabled. Do not sign, notarize, staple, inspect certificates, or access Apple credentials for this step.

**Actions**

1. Quit the development build, then launch the unsigned packaged app above using the normal Finder/open workflow for an unsigned local app.
2. Open a valid saved linked-loop project and verify capsule rendering at a usable zoom.
3. Click the compact badge and verify the loop-edit dialog opens.
4. Scrub a valid linked loop and confirm preview content.
5. Open an unresolved fixture and confirm its placeholder and error capsule.
6. Export a short valid linked-loop PNG sequence.
7. Attempt export from the unresolved fixture.

**Expected outcome**

- The unsigned packaged app launches and loads projects without depending on a dev server.
- Capsule source cells, linked band/ghost cells, badge, and interaction states render correctly.
- Badge click opens the targeted `Edit Loop Clip` dialog.
- Valid linked-loop preview matches the development build.
- Unresolved frames show the marked `Loop source missing` placeholder and retain the red error capsule.
- Valid PNG export succeeds with preview parity and no blank/placeholder frames.
- Unresolved export is blocked with the locked actionable error before any partial output.
- No signing/notarization flow, credential prompt, certificate access, or release-secret access occurs. Signed/notarized packaged UAT remains explicitly deferred to Phase 44.

**Result:** [ ] pass  [ ] fail

**Notes:**

---

## Verdict

- [ ] Approved — every numbered area 1–20 matches its expected outcome.
- [ ] Issues reported — list every failing numbered step below with screenshots.

**User feedback:**

Pending native UAT.
