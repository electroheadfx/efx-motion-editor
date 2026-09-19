---
status: passed
phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
source: [47-VERIFICATION.md]
started: 2026-08-25T20:15:00.000Z
updated: 2026-08-27T00:00:00.000Z
---

## Current Test

number: 5
name: Phase 47 overall (regression)
expected: |
  Track 1 and new tracks keep their keys across save/reopen; painting stays fluid (no stutter at stroke start); hover cursors are the select pointer on frames/keys; no black window on reopen after a long idle.
awaiting: user response — CONFIRMED PASSED 2026-08-27 (user: "5. Overall regression part are fixed now")

## Tests

### 1. Header column + track CRUD UI (47-02)
expected: Rename, duplicate, delete dialog, reorder grab, active accent, Bg lock all behave as described above; delete of the last Paint track is refused with "At least one Paint track is required".

### 2. Right-panel Track section (47-03)
expected: The right panel shows the active track's name, an Opacity slider (0-1) and a Blend select with exactly normal/screen/multiply/overlay/add; changing tracks re-renders the section; Cmd/Ctrl+Shift+N adds a track and Cmd/Ctrl+Shift+D duplicates the active track (never while painting or with a text input focused).

### 3. Filmstrip capsules (47-04)
expected: Hold Loop Clips render as filmstrip capsules — source-cycle cells, ×N/×∞ badge, shortened visual with "Loop shortened by next clip" tooltip, diagonal cut on a partial cycle; the Bg row shows imported clip capsules; zoom above the threshold expands the repetition band.

### 4. Cross-track drag (47-05)
expected: Dragging real keys from one track's row onto another track's row highlights the destination and shows the insertion preview; releasing commits the move (keys leave the source row, appear on the destination row); rejections (occupied destination frame, partial loop) surface in the status capsule with the red warning triangle.

### 5. Phase 47 overall (regression)
expected: Track 1 and new tracks keep their keys across save/reopen; painting stays fluid (no stutter at stroke start); hover cursors are the select pointer on frames/keys; no black window on reopen after a long idle.

## Summary

### Round 7 (2026-08-27) — test 5 overall regression PASSED + rail status dot close-out

User confirmed "5. Overall regression part" is fixed (crash + paint slowness
resolved; keys persist across save/reopen; no black window on reopen after a
long idle). This closes the last open UAT item — Phase 47 is ready to close.

Rail status dot close-out (session fixes, commits 166b1d9d → ce1008af):
- The 6x6 sphere status indicator on Motion/Static rails is now a 20x4px
  rectangle stacked OVER the 4px rail line (covering it), shown on ALL tracks
  (not just the active/selected one); the Key Rail line height was raised to
  4px to match the Motion rail.
- Status palette: synchronized #A6D334 (green), modified #FBBF24
  (yellowish-amber, distinct from the orange selection line), detached
  #BBC0C8 (gray), unavailable #FF2E56 (red).
- The rail tooltip now shows a colored status swatch before the "Status:"
  line; tooltip max-height raised 96px → 200px so the multi-line loop-clip
  tooltip keeps its bottom padding.
- Lifecycle consistency: the active lane and the non-active track rows now
  resolve the lifecycle from the clip's own scriptId (never the resolved
  library name), so a rail linked to an Action stays Synchronized/Modified
  even when the script library isn't loaded — no more red-when-selected /
  green-when-unselected flip.

Watchdog reload disabled (user request, commit ce1008af):
- The compositor-death watchdog's window.location.reload() is commented out —
  the paint window never auto-reloads. The stall detection stays live as a
  cooldown-bounded console warn so a future compositor death is traceable and
  the reload can be re-enabled.

### Round 6 (2026-08-26) — test 3 capsule regression: FULL removal (commit 346d47bc)

User report (screenshot + follow-up): the capsule evolution added text
and pill noise over frames and keys on the Motion/Static rails AND on
unselected tracks; the demanded outcome is ALL this detail removed from
the rails. A first attempt (62053516) only stripped the cell numbers and
compacted the badge — insufficient; the user confirmed the noise was
STILL there.

Final fix: the filmstrip capsule layer is removed ENTIRELY from the
timeline — the loop-clip rails (Motion/Static) and every track row
(including the Background row) return to the locked Phase 43 surface.
- Deleted the capsule component + its tests + the per-row capsule
  projection chain (`buildPaintRowLoopCapsules`,
  `buildBackgroundRowLoopCapsules`) + the background clip projection
  (`projectBackgroundFrameLoopClipCapsule`) + all capsule CSS.
- Loop facts (cycle label, effective duration, shortened state) remain
  available in the rail tooltip only — nothing painted on the rail.

Re-verification pending user response.

### Round 5 (2026-08-25) — test 2 regression fix (commit 9f570d9a)

User report (round 4 fix insufficient): the Track option tab still reverts
to Paint option ~1s after a track selection, and manual clicks on the tab
were reverted too.

Per the user's explicit fallback direction, the tab auto-select is REMOVED:
track selection, tool changes, and paint activity never move the tab. The
two tabs are manual-only, so a click on 'Track option' stays until the user
clicks 'Paint option'. Regression test: manual tab survives track/tool
changes and paint-revision bumps.

### Round 4 (2026-08-25) — test 2 regression fix (commit 6ca409ab)

User report: selecting a track opens the Track option tab, then it reverts to
Paint option a fraction of a second later ("event conflict").

Root cause: clicking a track row ALSO emits paint-revision activity shortly
after (runtime re-projection / document sync round-trip), which the
paint-flip signals effect translated into an instant tab revert.

Fix: paint-revision bumps inside a 600ms quiet window after a track
selection are treated as selection side effects and ignored
(`TRACK_TAB_SETTLE_MS`); a real paint stroke after the window still snaps
back to Paint option. Regression tests cover both paths (bump inside the
window keeps the Track tab; bump after the window flips to Paint).

### Round 3 (2026-08-25) — test 2 (right sidebar) feedback + fixes (commit 82fc8a91)

- The tool pane now hosts two tabs, matching the bottom Actions/Onion/Motion
  pattern: 'Paint option' (Shape detail / Color blending / Spread / Erase
  strength / Brush smoothing) and 'Track option' (active track name, Opacity
  0-1, Blend select) — the track options are out of the brush-tools pane.
- Auto-selection: choosing a track (activeTrackId change) opens 'Track
  option'; choosing a tool (activeTool change) or painting (physicPaintVersion
  bump, subscribed via a signals effect so the memoized panel flips the tab
  without re-rendering per stroke) snaps back to 'Paint option'.

Re-verification of this group is pending user response; remaining UAT items
(3-5) are still awaiting the user's group-by-group reports.

### Round 2 (2026-08-25) — test 1 feedback + fixes (commit d437f053)

- Open tools panel now takes over the WHOLE row: grip, eye, blend, name and
  the more-button hide; the solo / copy / trash buttons stretch across the
  track's full width (flex: 1 each).
- Header column widened again: 160px -> 185px.
- NEW per-track frame-blending toggle after the eye: shows the Blend icon,
  its pressed state reads that track's canonical interpolation state, the
  click writes `setRotoPhysicalInterpolationState(layerId, trackId, ...)`
  (revision bump -> pushed into the parent document via serialize; guarded
  while a physical edit is pending).

Re-verification of this group is pending user response; remaining UAT items
(2-5) are still awaiting the user's group-by-group reports.

### Round 1 (2026-08-25) — test 1 feedback + fixes (commit 6d19e5f6)

User feedback on the header column:
- Solo 'S' chip removed from the standing row; moved into the hover tools panel.
- Pencil (rename) icon removed from the hover tools — double-click on the name
  renames in place (confirmed working by the user).
- Eye toggle moved OUT of the hover tools to a standing row control, placed
  before the name and after the reorder grip.
- The row now shows only: grip, eye, name, more-button; the tools panel opens
  solo / copy / trash.
- Header column widened from 140px to 160px (`.physics-paint-header-column`).
- Delete-track dialog now centered on the EFX Paint window (`position: fixed`,
  no transformed ancestor — tracked to the webview viewport).
- Drag reorder confirmed working by the user.

Re-verification of this group is pending user response; remaining UAT items
(2-5) are still awaiting the user's group-by-group reports.
