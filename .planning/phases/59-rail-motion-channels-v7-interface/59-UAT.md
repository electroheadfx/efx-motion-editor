---
phase: 59-rail-motion-channels-v7-interface
plan: 14
status: live-uat-pending
started: 2026-11-06T19:24:00Z
updated: 2026-11-07T13:40:00Z
source: [59-14-PLAN.md, 59-VALIDATION.md, .planning/REQUIREMENTS.md]
---

# Phase 59 — rail motion channels: UAT and requirement traceability

Every requirement ID carried by this phase (22) appears in exactly one row of
the traceability table below with a named piece of evidence. Automated evidence
is a test file plus a test name; live evidence is a numbered row in the Live
UAT section. **No live row is marked passed by this document's author.** Rows
stay `pending` until a human runs them in the app and records the observed
behaviour here.

## Current Test

[awaiting live UAT — 15 rows pending]

## Automated gates

Recorded 2026-11-07 (gap closure 59-22..59-25) on branch `gsd/phase-59-rail-motion-channels-v7-interface`.

### Gate 1 — typecheck

```
$ pnpm --filter efx-motion-editor run typecheck
> efx-motion-editor@2.0.1 typecheck
> tsc --noEmit
```

**PASS** — exit 0, no diagnostics.

### Gate 2 — full vitest suite

```
$ pnpm --filter efx-motion-editor exec vitest run
 Test Files  396 passed | 2 skipped (398)
      Tests  7911 passed | 1 skipped | 96 todo (8008)
   Duration  16.79s
```

**PASS** — exit 0. The 2 skipped files and 96 todo cases are pre-existing
suite state, not this phase's: this plan modified no existing test file.

### Gate 3 — Rust canonical / guard suite

```
$ cargo test --manifest-path app/src-tauri/Cargo.toml services::script_library
     Running unittests src/lib.rs
running 23 tests
test result: ok. 200 passed; 0 failed; 0 ignored; 0 measured (full `cargo test` suite)
```

**PASS** — exit 0, **23 tests actually ran**. (A first invocation raced a
`cargo` rebuild and reported `0 passed … 4 filtered out`; that vacuous run is
recorded here so the 23-test count is the evidence, not the mere exit code.)
The 23 include `canonical_rail_motions_*`, `rail_motion_canonical_parity*` and
`canonical_physical_hash_*` — the guard path that accepts or refuses a
motion-bearing document.

## Requirement traceability

Test paths are repo-relative. `::` separates file from test name.

| ID | Claim (abridged) | Evidence |
|----|------------------|----------|
| MOTN-01 | Add/edit/remove Motion keys on any rail, no conversion, no cycle value | `app/src/components/physic-paint/roto/railMotionCommands.test.ts` :: "animates Reveal and Static rails the same way — no conversion and no type gate"; "binds a Loop Clip rail by its own loopId and mints nothing"; "mints exactly one rail id for a bare Key Rail and keeps the first key as the anchor hint"; "adds a key at the rail-local cursor with the channel current evaluated value"; "removes only the addressed key and keeps the rest of the rail". Live rows 1–4. |
| MOTN-02 | Motion keys independent of drawing keys | `app/src/components/physic-paint/roto/railMotionCommands.test.ts` :: "never touches a drawing key, loop clip or break: every input stays deep-equal"; `app/src/lib/railMotionGateBEdits.test.ts` :: "re-anchors the motion record in the same commit as the delete, and one undo restores it"; "keeps the collection byte-identical when a non-first key is deleted". Live rows 7–8. |
| MOTN-03 | Position (grouped or split), Scale, Rotation, Opacity | `app/src/components/physic-paint/roto/railMotionModel.test.ts` :: "accepts exactly the five model channel ids and rejects the lane id"; "rejects a lone Position axis (D-12)"; `railMotionCommands.test.ts` :: "writes the grouped Position pair at the rail-local cursor in ONE result"; "converts Scale from UI percent to the model factor through the 59-02 pair"; "writes Rotation in degrees with NO normalization"; "converts Opacity between percent and the stored fraction"; "adds rail-motion as a third target with no opacity affordance and no rotation wrap"; "mounts a third handles instance gated on a non-null railId". |
| MOTN-04 | Channels open on demand, one at a time; no lane by default | `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` :: "renders nothing while the block is collapsed (MUI-03)"; "reports four keyless display lanes when nothing carries keys"; "lists only the keyless display lanes in fixed order at the 18px rhythm"; `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` :: "Animate leaves the block collapsed: the session signal stays null and the glyph is chevron-right (D-03)". |
| MOTN-05 | Rail-local time; survives moving or repeating the rail | `app/src/components/physic-paint/roto/railMotionEvaluator.test.ts` :: "subtracts the rail start and clamps before the rail at zero"; `railMotionIdentity.test.ts` :: "returns the same record reference when the rail start moves"; `app/src/lib/railMotionGateBEdits.test.ts` :: "keeps every rail-local frame when the rail start moves"; `railMotionCommands.test.ts` :: "never seeds frame 0 when the cursor is elsewhere in the rail (D-02)". Live row 5. |
| MOTN-06 | Repeat semantics observable — hold at last key / fit the full occurrence | `railMotionEvaluator.test.ts` :: "holds the first value before the first key and the last value after the last key"; `railMotionIdentity.test.ts` :: "derives one view per loop clip with the loop lifecycle span"; `app/src/lib/railMotionGateBEdits.test.ts` :: "duplicates an animated rail onto a fresh identity through duplicateTrackFrames". Live row 4 (loop rail, repeat > 1). Status stays Pending until row 4 passes. |
| MOTN-07 | Compositor transform: one raster per track per frame, content cycles, no re-bake | `app/src/lib/railMotionExportParity.test.ts` :: "applies exactly one affine to the shared content raster (no second application)"; "resolves content at the integer frame for every sub-frame"; `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` :: "rotates the key on a motion-only edit while the content revisions stay put"; "keeps the pre-Phase-59 key byte-identical for a motion-free document". Live rows 4, 12. |
| MOTN-08 | Edit view, Play, export produce the same transform | `app/src/lib/railMotionExportParity.test.ts` :: "applies the evaluator transform at the fractional frame (one interpolation authority)"; "carries the same transform through getFlattenedFrame and getFlattenedFrameExcluding"; `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` :: "sources the playback availability memo structurally so Studio playback and the program monitor never diverge from the main editor". Live rows 12–13. |
| MOTN-09 | Rotation unbounded; hold outside keys; time-invariant pivot | `railMotionModel.test.ts` :: "accepts any finite Rotation, including negative and beyond 360, with no wrap"; `railMotionEvaluator.test.ts` :: "interpolates rotation in degrees with no wrap and converts once at the boundary"; `app/src/components/physic-paint/roto/railMotionPivot.test.ts` :: "is independent of the evaluated transform values"; "does not re-measure when only the evaluated frame changes". |
| MOTN-10 | Ease/Wiggle/Hold only on Motion keys; seeded wiggle deterministic at export | `railMotionCommands.test.ts` :: "accepts only hold and ease and preserves the key value"; "bounds Wiggle to 0..1,000,000 and rejects non-finite or negative values"; `railMotionEvaluator.test.ts` :: "seeds differently per rail, channel and key frame"; "is deterministic across repeated and interleaved calls"; `railMotionModel.test.ts` :: "rejects unknown record members" (a drawing key has no easing/wiggle surface). |
| MOTN-11 | Three independent selection scopes | `railMotionCommands.test.ts` :: "maps every selection state to exactly one scope and one command list"; "gives every command exactly one scope — a command from another scope is absent"; "clearing the motion-key selection keeps the rail set (expanded block stays open)"; "selecting a motion key clears the drawing-key selection"; "selecting a drawing key clears the motion-key selection"; "deleting the rail clears every scope". |
| MOTN-12 | Save → close → reopen; undo/redo per key operation | `app/src/components/physic-paint/roto/railMotionPersistence.test.ts` :: "defaults an absent railMotions member to the frozen empty collection"; "rejects a document whose railMotions changed without recomputing the revision"; `app/src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts` :: "serialize → parse → register → hydrate → serialize is byte-identical"; `app/src/lib/railMotionPackageRoundTrip.test.ts` :: "reopens with the collection deep-equal and the canonical revision identical"; `app/src/components/physic-paint/hooks/physicsPaintRotoRailMotionHistory.test.ts` :: "records one command for a motion-only change; Undo restores the prior collection and Redo restores the edit". Live rows 10–11. |
| MUI-01 | Coloured chevron / chevron-down on expand / grey minus with no motion | `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` :: "renders the three chevron kinds from motion presence and expansion"; "renders the grey minus on a track with no motion — a disabled 14×14 button with its reason"; "clicking the collapsed chevron on the selected motion rail expands it, clicking again collapses it"; "disables the chevron of a motion-bearing track whose rail is not the selected one — with a visible reason"; `timelineMotionSurface.contract.test.ts` :: "pins the grey chevron colour on the surface token block". |
| MUI-02 | 18px lanes, header cluster, 16×18 cells, 1.5px curves, 6×6 keys, lighter type rim | `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` :: "renders one motionLane surface of the 18px lane height"; "renders the header cluster as icon, label, key count, previous, diamond, next"; "draws one 6px key per SHARED Position frame, never one per axis"; "renders exactly the evaluator curve path for each model channel"; "draws the 16 x 18 motion cells at the 18px pitch"; `timelineMotionSurface.contract.test.ts` :: "pins the locked lane, cell, key, curve and outline measures"; "derives every type rim from the selected palette — one palette authority". |
| MUI-03 | Rounded bright outline wraps row + expanded channels, absent when collapsed | `TimelineMotionChannels.test.ts` :: "renders nothing while the block is collapsed (MUI-03)"; "wraps the rail row plus its lanes in a rounded 1.5px rect"; `PhysicsPaintTrackRow.test.tsx` :: "renders the expanded block only while expanded: four display lanes, the outline and the post-block gap"; `timelineMotionSurface.contract.test.ts` :: "wraps the rail row plus its lanes plus the post-block gap, never collapsed". |
| MUI-04 | Switching rail selection collapses the previous block | `PhysicsPaintTrackRow.test.tsx` :: "keeps at most one block open: toggling another rail replaces the recorded identity"; "writes the session expansion signal in exactly one place — the chevron toggle — and adds no effect"; "expands only while the recorded session identity still IS the selected rail". |
| MUI-05 | Header/lanes aligned while scrolling incl. 2px post-block gap; measured reorder indicator never inside a block | `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` :: "adds one 18px lane row per visible display lane plus ONE 2px post-block gap"; "caps a fully populated block at four display lanes (105px), never five (123px)"; "derives the content height, the row offsets and the lane count from the SAME measured array"; "computeReorderInsertionIndex"; `timelineMotionSurface.contract.test.ts` :: "header column: the spacer rows derive from the same lane token". |
| MUI-06 | Previous/next/diamond behave; unavailable actions disabled with a real reason | `TimelineMotionChannels.test.ts` :: "routes key and nav clicks to the frame handlers"; "disables an inert nav control WITH a visible reason, never a silent no-op"; "lets the host override a disabled reason"; `railMotionCommands.test.ts` :: "answers every case and never reports an empty reason (T-59-35)"; "steps to the adjacent key frame without wrapping"; "removes a Motion key at a frame that carries none with a plain reason". |
| REL-01 | No new runtime dependencies | `app/src/lib/railMotionDependencySurface.test.ts` :: "resolves every bare import to a workspace-declared package"; "adds no entry to app/package.json dependencies — frozen against the phase start"; "finds the bare specifiers the phase really imports — the scan is not vacuous". |
| REL-02 | Every new `.mce` field round-trips byte-identically, pinned by a test | `app/src/lib/railMotionPackageRoundTrip.test.ts` :: "reopens with the collection deep-equal and the canonical revision identical"; "re-writes the reopened document to the same persisted physical bytes"; "puts the motion collection inside the persisted canonical revision"; "fails closed on a tampered revision rather than re-deriving it"; `app/src/lib/railMotionCanonicalParity.test.ts` :: "matches the frozen canonical source and project equality: rail-motion"; `efxPaintPersistenceRailMotionRoundTrip.test.ts` (store leg). |
| REL-03 | Motion joins the canonical revision; sampled values never enter the flattened cache key | `app/src/components/physic-paint/roto/railMotionPersistence.test.ts` :: "adds nothing when the collection is empty (append-only 6th parameter)"; "contributes exactly one term when the collection is non-empty"; "sorts records by railId so input array order never changes the revision"; "moves all six carriers when one record is added"; `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` :: "rotates the key on a motion-only edit while the content revisions stay put"; "never mixes a sampled value into the key: the same revision is stable"; "ignores motion revisions for non-participating (hidden) tracks". |
| REL-04 | Motion-blur export keeps paint on every frame — integer content raster, fractional transform | `app/src/lib/railMotionExportParity.test.ts` :: "delivers paint on every motion-blur sub-frame (REL-04)"; "resolves content at the integer frame for every sub-frame"; "evaluates the rail transform at the unfloored frame"; "never serves a fractional delivery from the integer flattened memo (T-59-27)". Live row 12. |

**Status note.** This plan changed no requirement checkbox in
`.planning/REQUIREMENTS.md`. MOTN-06, MOTN-07 and MUI-01..MUI-05 remain
`Pending` there because their rows still need live evidence (rows 1–9); flipping
them from an automated pin alone would be the exact false claim T-59-40 names.

## Live UAT

Run these in the app (Studio). Each row names its preconditions, the exact
gesture sequence and the observable outcome. Record `result: pass` with what
you saw, or `result: fail` with the observed behaviour verbatim. Do not edit a
test to match an observed product defect.

### 1. Animate a Standard rail

- **Preconditions:** A paint layer with at least two drawing keys (e.g. F0 and
  F8). A Standard (grey) rail selected on the active track.
- **Steps:** Click `Animate` in the key-action row. Place the playhead at a
  different rail-local frame (e.g. F4). Expand the track's motion chevron.
  Drag the Position handle or type a Position value.
- **Expected:** `Animate` seeds one Position key at the playhead and the rail
  gains a Motion block; the chevron is coloured and `chevron-right` until
  expanded, then `chevron-down`; one Position lane appears with a 6×6 key at
  each keyed frame and a 1.5px curve between them; the rail paints at the new
  position and the drawing keys in the rail are unchanged (same count, same
  frames, same cells).
- **Result:** pending

### 2. Animate a Reveal rail

- **Preconditions:** A Reveal rail on the active track.
- **Steps:** Select the rail. Click `Animate`. Set a Scale key at the rail-local
  playhead, move the playhead, set a different Scale.
- **Expected:** Animate is enabled for the Reveal rail with no conversion step
  and no "unsupported rail type" message; the Motion block shows a Scale lane;
  the reveal paints scaled on frames after the second key; no cycle value is
  required or shown.
- **Result:** pending

### 3. Animate a bare Key Rail

- **Preconditions:** A bare Key Rail (drawing keys, no Loop Clip) on the active
  track.
- **Steps:** Select the rail. Click `Animate`. Expand the chevron. Add a
  Rotation key at one frame and a second Rotation key 360°+ away (e.g. 0° then
  720°). Scrub between them.
- **Expected:** The bare Key Rail gets a Motion block without being converted
  into a Loop Clip or a cycle; the Rotation lane shows two keys; scrubbing
  passes through the intermediate angles and 720° is distinct from 0° (no
  wrap); the drawing keys/cells are untouched.
- **Result:** pending

### 4. Animate a loop rail (repeat > 1)

- **Preconditions:** A Loop Clip rail with `repeat` ≥ 2 on the active track.
- **Steps:** Select the rail. Click `Animate`. Add Position keys inside the
  rail's first occurrence. Expand the block. Scrub across the repeat boundary
  and to the last repeat instance.
- **Expected:** The Motion lanes span the rail's lifecycle span, not just the
  source cycle; every repeat occurrence shows the same motion rhythm (content
  cycles while motion continues); after the last key the value holds, and a
  hold/ease key behaves identically in every occurrence. No second raster
  bake is triggered when scrubbing (no repaint flash of the source cycle).
- **Result:** pending

### 5. Move a rail and observe motion follow

- **Preconditions:** An animated rail from rows 1–4 with keys at distinct
  rail-local frames.
- **Steps:** Note the motion at one frame. Drag the whole rail to a new start
  frame. Scrub to the same rail-local frame (new absolute frame = new start +
  old local offset).
- **Expected:** The key frames move with the rail (same rail-local offsets, no
  renumbering); the evaluated transform at the same rail-local frame is
  identical to before the move; no key is dropped or duplicated.
- **Result:** pending

### 6. Copy/paste an animated rail and observe motion follow the copy

- **Preconditions:** An animated rail with at least two Motion keys.
- **Steps:** Select and copy the rail (`Copy`). Place the cursor on free space.
  `Paste`. Select the pasted rail and expand its block. Then re-select the
  source rail.
- **Expected:** The pasted rail carries its own copy of the motion (identical
  key frames relative to the new rail start and identical values/curves); the
  copy animates independently — editing the copy's keys leaves the source
  untouched, and editing the source leaves the copy untouched. The source
  keeps all its keys.
- **Result:** pending

### 7. Delete the first drawing key and observe motion stay

- **Preconditions:** A rail animated with at least two Motion keys, whose first
  drawing key is not its only key.
- **Steps:** Delete the rail's FIRST drawing key. Expand the motion block.
- **Expected:** The Motion block stays attached to the rail with every Motion
  key at its previous rail-local frame (frames unchanged; only the anchor hint
  is re-stamped); the curve is unchanged. One undo restores the drawing key and
  the motion record together.
- **Result:** pending

### 8. Delete the last drawing key and observe the block collapse

- **Preconditions:** A rail whose last remaining drawing key is about to be
  deleted (a Key Rail with a single drawing key, animated).
- **Steps:** Delete that drawing key.
- **Expected:** The rail disappears and its Motion block disappears with it —
  the chevron returns to the grey `minus`, no orphan lane row is left, and the
  track's row layout collapses by the block height. One undo restores both the
  key and the motion.
- **Result:** pending

### 9. Merge two rails where BOTH sides carry motion

- **Preconditions:** Two adjacent rails that both carry Motion keys, such that
  merging them must drop the tail record.
- **Steps:** Perform the rail merge (the same gesture used to merge two
  contiguous rails). Read the confirmation row. Press undo once.
- **Expected:** A session-only confirmation row appears naming the dropped
  frame range (the tail's own span) and the two-sided nature of the drop; the
  merged rail keeps the head motion. ONE undo step restores the pre-merge
  rails, the tail's motion, and dismisses the confirmation row — no second
  undo is needed and no notice survives the restore.
- **Result:** pending

### 10. Save/close/reopen with motion intact

- **Preconditions:** A project with an animated Standard rail, a bare Key Rail,
  a Reveal rail and a loop rail (rows 1–4).
- **Steps:** Save the project. Close it (or quit and relaunch). Reopen it.
  Expand each animated rail's Motion block and scrub.
- **Expected:** Every rail keeps its Motion records, key frames, values,
  easing, wiggle and per-type rim colour; the block starts collapsed (no lane
  by default); scrubbing reproduces the same transforms as before the reopen;
  no "revision mismatch" or refused-document error appears.
- **Result:** pending

### 11. Undo/redo a motion edit

- **Preconditions:** An animated rail; the motion block expanded.
- **Steps:** Add a Motion key at a new frame. Undo. Redo. Then change one
  key's value and undo/redo that too.
- **Expected:** Each Motion-key operation is exactly one undo step; Undo
  removes the added key (and its lane if it was the last), Redo restores it at
  the same frame and value; undo/redo never touches drawing keys and never
  changes the rail's drawing cells.
- **Result:** pending

### 12. Export with motion blur and verify paint on every frame

- **Preconditions:** An animated rail with a fast Position or Rotation move and
  motion blur enabled; a project short enough to export.
- **Steps:** Export the sequence. Inspect consecutive exported frames across
  the motion (including between integer frames if the export is sub-frame).
- **Expected:** Every exported frame carries the painted content (no blank,
  transparent or "lost content" frames); the transform advances smoothly
  between frames (sub-frame transform, integer content); no frame shows a
  double-applied transform or a re-baked/smeared source cycle.
- **Result:** pending

### 13. Studio monitor transform matches Play

- **Preconditions:** An animated rail on the active track, with a visible
  Studio program monitor.
- **Steps:** Scrub the Studio timeline across the animated range. Then press
  Play. Compare the monitor's transform against the Edit view at the same
  frames.
- **Expected:** The monitor applies the same transform as the Edit view at the
  same frame — position, scale, rotation and opacity agree; Play interpolates
  identically (no jump at playback start, no transform lag); a rail on the
  active track is not treated differently from any other track.
- **Result:** pending

### 14. Motion block chevron expand/collapse visual state

- **Preconditions:** A track whose rail carries at least one Motion channel.
- **Steps:** Click the Motion block's chevron to collapse the lanes, then click
  it again to expand. Move the pointer over the chevron and over a lane row.
- **Expected:** The chevron reflects the expanded state and its hover state is
  visible; collapsing hides the lane rows and removes the `+` row with them;
  expanding restores the exact same rows in the same order. No layout jump and
  no stale hover on a hidden row.
- **Result:** pending

### 15. v7 chrome, theme and vocabulary

- **Preconditions:** Studio open on the Phase 59 build.
- **Steps:** Compare the live Studio timeline against
  `SPECS/v2.1.0-motion-channels/reference/section-01-motion-channels.png`:
  18px lanes, 6×6 motion keys, the selected-block outline, header alignment,
  colours and label vocabulary.
- **Expected:** Lane height, key size, outline and header columns match the
  reference; terminology is consistent ("playhead", "Motion", "easing",
  "Wiggle"); no leftover pre-v7 styling.
- **Result:** pending

## Summary

total: 15
passed: 0
failed: 0
pending: 15
