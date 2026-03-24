---
status: resolved
trigger: "keyframe-label-z-index-overlap: When a keyframe in the timeline is near the title label of a sequence, the user can't click the label because the keyframe has higher z-index"
created: 2026-03-24T00:00:00Z
updated: 2026-03-24T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - Root cause found and fix applied
test: n/a
expecting: n/a
next_action: Awaiting human verification that label clicks work when keyframes are nearby

## Symptoms

expected: Clicking on a sequence's title label in the timeline should select/activate the label, even when a keyframe is positioned nearby
actual: Keyframes capture the click instead of the label because they have higher z-index, making labels unclickable when a keyframe is near
errors: No errors — it's a z-index/pointer-events priority issue
reproduction: Place a keyframe near the beginning of a sequence timeline (close to where the title label is), then try to click the label
started: Has always been like this

## Eliminated

## Evidence

- timestamp: 2026-03-24T00:00:30Z
  checked: TimelineInteraction.ts pointerdown handler hit-test order (lines 734-788)
  found: Hit priority is keyframeHitTest (line 734) > transitionHitTest (line 764) > nameLabelHitTest (line 780). Keyframes are checked first and return early, preventing label hit test.
  implication: Any click near a keyframe X position is intercepted regardless of Y position.

- timestamp: 2026-03-24T00:00:45Z
  checked: keyframeHitTest for content tracks (lines 415-433)
  found: Content track keyframe hit test is purely X-based — NO Y coordinate check. Uses hitThresholdFrames = max(0.6, 18/frameWidth), which at default zoom (60px/frame) = 0.6 frames = 36px.
  implication: The keyframe hit zone covers the entire vertical extent of the content track, including the label area at the bottom.

- timestamp: 2026-03-24T00:00:55Z
  checked: Geometry of labels vs keyframes in renderer
  found: Keyframe diamonds drawn at TRACK_HEIGHT/2 = 26px from track top (size 9). Labels drawn at TRACK_HEIGHT-18 = 34px from track top (height 16). They don't visually overlap in Y, but the hit test doesn't use Y, so clicks on labels at the bottom of the track still hit keyframes.
  implication: Fix should either reorder hit tests (labels before keyframes) or add Y-awareness to keyframe hit testing.

## Resolution

root_cause: In TimelineInteraction.ts, the pointerdown handler checks keyframeHitTest before nameLabelHitTest. The keyframe hit test for content tracks uses only X-position (no Y check), so its hit zone covers the entire track height including the label area at the bottom. When a keyframe is near a label's X position, the keyframe intercepts the click even though the user clicked on the label (which is at a different Y position than the diamond).
fix: Reordered hit-test priority in both pointerdown and pointermove handlers so nameLabelHitTest runs BEFORE keyframeHitTest. Since label hit testing uses a precise bounding box (both X and Y), it only catches clicks that are actually on the label text. Clicks elsewhere in the track (e.g., on the diamond itself at the center of the row) still fall through to the keyframe hit test. Also updated hover handler to show pointer cursor on labels even when a keyframe is nearby in X.
verification: TypeScript compiles cleanly. All existing tests pass (3 pre-existing failures in audioWaveform unrelated).
files_changed: [Application/src/components/timeline/TimelineInteraction.ts]
