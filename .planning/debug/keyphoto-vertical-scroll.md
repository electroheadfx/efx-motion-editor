---
status: investigating
trigger: "Key photo click doesn't scroll timeline vertically"
created: 2026-03-18T00:00:00Z
updated: 2026-03-18T00:00:00Z
---

## Current Focus

hypothesis: KeyPhotoCard onClick handler calls playbackEngine.seekToFrame() which does NOT call ensureTrackVisible(), only ensureFrameVisible() (horizontal scroll only)
test: Trace the click handler code path and confirm ensureTrackVisible is never invoked
expecting: No call to ensureTrackVisible in the seekToFrame path or in the click handler itself
next_action: Confirm root cause and propose fix

## Symptoms

expected: Clicking a key photo should seek the playhead AND scroll the timeline vertically so the selected layer's track is visible
actual: Playhead seeks to the correct horizontal position, but timeline does NOT scroll vertically to show the relevant layer/track
errors: none (behavioral bug, not a crash)
reproduction: Click any key photo in the strip when that sequence's track is scrolled out of the visible area of the timeline canvas
started: Feature was never implemented (missing from the key photo click handler)

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-18T00:01:00Z
  checked: KeyPhotoCard onClick handler (KeyPhotoStrip.tsx lines 184-207)
  found: Handler does three things: (1) sequenceStore.selectKeyPhoto, (2) layerStore.setSelected + uiStore.selectLayer, (3) playbackEngine.seekToFrame(range.startFrame). No call to timelineStore.ensureTrackVisible.
  implication: Vertical scroll is never triggered on key photo click.

- timestamp: 2026-03-18T00:02:00Z
  checked: playbackEngine.seekToFrame (playbackEngine.ts lines 58-64)
  found: seekToFrame calls timelineStore.seek, syncDisplayFrame, ensureFrameVisible (HORIZONTAL only), syncActiveSequence, syncPlayer. It does NOT call ensureTrackVisible.
  implication: The seek path only handles horizontal scroll. Vertical scroll must be explicitly added.

- timestamp: 2026-03-18T00:03:00Z
  checked: playbackEngine.syncActiveSequence (playbackEngine.ts lines 83-94)
  found: syncActiveSequence DOES call ensureTrackVisible, but ONLY when the playhead crosses into a DIFFERENT sequence (entry.sequenceId !== activeId). When clicking a key photo within the already-active sequence, this condition is false, so ensureTrackVisible is never called.
  implication: Even if seekToFrame triggers syncActiveSequence, vertical scroll is skipped when clicking a key photo in the already-active sequence because the sequence doesn't change.

- timestamp: 2026-03-18T00:04:00Z
  checked: timelineStore.ensureTrackVisible (timelineStore.ts lines 124-142)
  found: This method EXISTS and works correctly. It accepts a sequenceId, finds the track index, and adjusts scrollY so the track is visible. It is already used during playback (tick loop) and during sequence switching.
  implication: The infrastructure for vertical scroll is already in place. It just needs to be called from the key photo click handler.

- timestamp: 2026-03-18T00:05:00Z
  checked: All callers of ensureTrackVisible
  found: Only called in (1) syncActiveSequence (on sequence change during seek), (2) playback tick loop. Never called from key photo click, sequence selection, or any sidebar interaction.
  implication: Confirms the fix location -- the key photo click handler needs to add one line.

## Resolution

root_cause: The KeyPhotoCard onClick handler in KeyPhotoStrip.tsx calls playbackEngine.seekToFrame() which only does horizontal scroll (ensureFrameVisible). The vertical scroll method timelineStore.ensureTrackVisible() is never called during the key photo click path. Additionally, playbackEngine.syncActiveSequence() has ensureTrackVisible but guards it with a "different sequence" check, so it's skipped when clicking a key photo within the already-active sequence.

fix: Add `timelineStore.ensureTrackVisible(sequenceId)` to the KeyPhotoCard onClick handler in KeyPhotoStrip.tsx, after the seekToFrame call. This is a one-line addition.

verification: empty
files_changed: []
