---
status: partial
phase: 35-interactive-physics-paint-controls
source: 35-01-SUMMARY.md, 35-02-SUMMARY.md, 35-03-SUMMARY.md, 35-04-SUMMARY.md, 35-05-PLAN.md, 35-UI-SPEC.md
started: 2026-06-09T11:31:00Z
updated: 2026-06-09T11:52:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create and Inspect Physic Paint Layer
expected: In the editor, the PAINT layer menu includes a distinct Physic Paint item. Creating/selecting it shows Physic Paint sidebar properties with current layer/frame details, rendered-output status or the empty-state copy, and a visible primary `[open fx paint canvas]` button without removing existing basic paint or p5.brush FX paint controls.
result: pass

### 2. Open Standalone With Layer and Frame Context
expected: Clicking `[open fx paint canvas]` opens the standalone physics paint canvas with the selected layer and current frame context. The standalone diagnostics/apply strip becomes visible and reports ready/not-ready state, layer/frame context, engine/canvas state, active tool/settings, physics mode, bridge transport mode, and last error without requiring the console.
result: pass

### 3. Use Live Standalone Physics Controls
expected: The standalone canvas remains the dominant surface, the existing toolbar controls remain visible, Paint and Erase are mutually exclusive, and changing brush/color/physics settings affects the real live physics paint session rather than a fake preview.
result: pass

### 4. Save and Load Editable State
expected: The standalone persistence controls are labelled `Save state` and `Load state`. Saving downloads or saves editable physics paint state JSON, loading valid state replaces the standalone canvas state, and loading an invalid file shows the required invalid-state-file error copy rather than applying rendered output to the editor.
result: issue
reported: "save button doesn't save a file, I see nothing, maybe its for the next release ?"
severity: major

### 5. Apply Current Canvas to Editor Frame
expected: Clicking `[apply canvas]` sends rendered physics paint output back to the editor for the captured current frame. The editor preview visibly updates on that frame, the standalone receives matching apply-result feedback, and success copy says `Applied to frame {frame}`.
result: issue
reported: "apply canvas out an error: \"Could not apply physics paint output. The main editor did not return an apply result.\""
severity: blocker

### 6. Apply Play Canvas Sequence
expected: The standalone shows a `Frames to apply` input with default 120 and valid range 1 to 600. Clicking `[apply play canvas]` applies generated rendered frames starting at the captured app frame, disables apply buttons while applying, shows `Applying physics paint output...`, updates the editor preview across those frames, and success copy says `Applied {count} frames starting at frame {frame}`.
result: issue
reported: "apply play canvas : applying (its very slow, maybe a rerender excess ?) [screenshot shows Not ready to apply / Applying physics paint output... / Apply operation is still running], but in end its say the same issue for apply canvas: \"Could not apply physics paint output. The main editor did not return an apply result.\" Additional diagnostic: server says \"RemoteLayerTreeDrawingAreaProxyMac::scheduleDisplayLink(): page has no displayID\""
severity: blocker

### 7. Replace Existing Physics Paint Output
expected: When applying to a frame that already has physics paint output, the app shows non-blocking warning copy `This frame already has physics paint output. Applying will replace it.` Applying again replaces that frame's physics paint output without duplicating or corrupting previous output.
result: blocked
blocked_by: other
reason: "for help from the previous issue (test 6) the server say: \"RemoteLayerTreeDrawingAreaProxyMac::scheduleDisplayLink(): page has no displayID\"; for test 7, it can't apply paint to main app layer because test 6 has an error for transport the data"

### 8. Error and Not-Ready Feedback
expected: If the standalone lacks app layer context, canvas readiness, bridge/listener availability, or another required condition, the apply state is visibly not ready with plain-language missing-condition text. Apply errors remain visible with `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.` until the next successful action or dismissal.
result: issue
reported: "I have errors when I apply physics paint canvas. Screenshot shows standalone ready state with \"Could not apply physics paint output. The main editor did not return an apply result.\" and app sidebar error \"Target layer is not a physic-paint rendered-output layer\"."
severity: blocker

### 9. Preview Compositing and Timeline Redraw
expected: Applied physics paint output composites in the editor preview using the layer blend mode and opacity. Moving across frames redraws the correct physics paint output, frames without output draw nothing safely, and existing basic paint and p5.brush FX paint rendering still works.
result: blocked
blocked_by: other
reason: "I can't test and other tests because previous tests fail"

## Summary

total: 9
passed: 3
issues: 4
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "The standalone persistence controls are labelled `Save state` and `Load state`. Saving downloads or saves editable physics paint state JSON, loading valid state replaces the standalone canvas state, and loading an invalid file shows the required invalid-state-file error copy rather than applying rendered output to the editor."
  status: failed
  reason: "User reported: save button doesn't save a file, I see nothing, maybe its for the next release ?"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Clicking `[apply canvas]` sends rendered physics paint output back to the editor for the captured current frame. The editor preview visibly updates on that frame, the standalone receives matching apply-result feedback, and success copy says `Applied to frame {frame}`."
  status: failed
  reason: "User reported: apply canvas out an error: \"Could not apply physics paint output. The main editor did not return an apply result.\""
  severity: blocker
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "The standalone shows a `Frames to apply` input with default 120 and valid range 1 to 600. Clicking `[apply play canvas]` applies generated rendered frames starting at the captured app frame, disables apply buttons while applying, shows `Applying physics paint output...`, updates the editor preview across those frames, and success copy says `Applied {count} frames starting at frame {frame}`."
  status: failed
  reason: "User reported: apply play canvas : applying (its very slow, maybe a rerender excess ?) [screenshot shows Not ready to apply / Applying physics paint output... / Apply operation is still running], but in end its say the same issue for apply canvas: \"Could not apply physics paint output. The main editor did not return an apply result.\" Additional diagnostic: server says \"RemoteLayerTreeDrawingAreaProxyMac::scheduleDisplayLink(): page has no displayID\""
  severity: blocker
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "If the standalone lacks app layer context, canvas readiness, bridge/listener availability, or another required condition, the apply state is visibly not ready with plain-language missing-condition text. Apply errors remain visible with `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.` until the next successful action or dismissal."
  status: failed
  reason: "User reported: I have errors when I apply physics paint canvas. Screenshot shows standalone ready state with \"Could not apply physics paint output. The main editor did not return an apply result.\" and app sidebar error \"Target layer is not a physic-paint rendered-output layer\"."
  severity: blocker
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
