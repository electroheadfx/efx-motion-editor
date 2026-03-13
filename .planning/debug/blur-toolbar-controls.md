---
status: diagnosed
trigger: "Investigate two related issues with the blur toolbar controls: HQ Preview toggle shows no quality difference, Bypass Blur toggle doesn't work at all"
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:00:00Z
---

## Current Focus

hypothesis: Both issues share the same root cause -- blurStore.isHQ() and blurStore.isBypassed() use .peek() which reads signals without subscribing, so toggling the signals never triggers a canvas re-render
test: Trace the reactivity chain from signal toggle -> render loop
expecting: Confirmed that no reactive subscription exists for blur signals in the render path
next_action: Return diagnosis

## Symptoms

expected: (1) HQ toggle switches between fast downscale-upscale blur and StackBlur algorithm with visible quality difference. (2) Bypass toggle disables all blur effects immediately.
actual: (1) No visible quality difference when toggling HQ. (2) Bypass toggle has no visible effect -- blur remains applied.
errors: None -- no console errors reported
reproduction: Click HQ button or Bypass button in toolbar, or press B / Shift+B
started: Since blur controls were implemented

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-13T00:01:00Z
  checked: blurStore.ts -- isHQ() and isBypassed() method implementations
  found: Both use .peek() -- `hqPreview.peek()` (line 26) and `bypassBlur.peek()` (line 31). The .peek() method reads a Preact signal's current value WITHOUT creating a reactive subscription.
  implication: Any code that calls isHQ() or isBypassed() will get the current value but will NOT re-run when the value changes.

- timestamp: 2026-03-13T00:02:00Z
  checked: previewRenderer.ts -- all call sites of blurStore.isHQ() and blurStore.isBypassed()
  found: Six call sites in previewRenderer.ts use these methods: (1) line 141 `blurStore.isBypassed()` in generator blur check, (2) line 185 `blurStore.isBypassed()` in content layer blur check, (3) line 440 `blurStore.isBypassed()` in adjustment-blur layer, (4) line 449 `blurStore.isHQ()` in adjustment-blur layer, (5) line 491 `blurStore.isBypassed()` in applyBlurToCanvas, (6) line 492 `blurStore.isHQ()` in applyBlurToCanvas. ALL use .peek() via the store methods.
  implication: The renderer reads blur state but is not reactive to blur state changes.

- timestamp: 2026-03-13T00:03:00Z
  checked: Preview.tsx -- the reactive render effect (lines 70-103)
  found: The render effect subscribes to `timelineStore.displayFrame.value`, `frameMap.value`, and `sequenceStore.sequences.value`. It does NOT subscribe to `blurStore.hqPreview.value` or `blurStore.bypassBlur.value`. The effect calls `renderer.renderFrame()` which internally calls `blurStore.isHQ()` and `blurStore.isBypassed()` -- but those use `.peek()` so they don't create subscriptions within the effect either.
  implication: Toggling HQ or Bypass changes the signal values correctly, but nothing triggers a re-render of the canvas. The new values only take effect the NEXT time the canvas re-renders for some other reason (e.g., scrubbing to a new frame).

- timestamp: 2026-03-13T00:04:00Z
  checked: Preview.tsx -- rAF tick loop (lines 109-118)
  found: The rAF loop only renders when `timelineStore.isPlaying.peek()` is true AND `currentFrame !== lastRenderedFrame`. During pause (normal editing), it does nothing. This confirms there is no continuous render loop that would pick up blur state changes.
  implication: When paused, blur toggle changes are invisible until the user scrubs to a different frame.

- timestamp: 2026-03-13T00:05:00Z
  checked: Toolbar.tsx -- blur button onClick handlers and signal reads
  found: Lines 111, 115, 119, 123-124, 128, 131-132 correctly read `blurStore.hqPreview.value` and `blurStore.bypassBlur.value` using `.value` (not `.peek()`). The buttons themselves are reactive and will visually update (highlight/unhighlight) when toggled.
  implication: The Toolbar buttons work correctly -- they toggle the signals AND their visual state updates. The problem is purely in the render pipeline not responding.

- timestamp: 2026-03-13T00:06:00Z
  checked: shortcuts.ts -- keyboard bindings for B and Shift+B
  found: Lines 221-230 correctly bind KeyB to `blurStore.toggleHQ()` and Shift+KeyB to `blurStore.toggleBypass()`. Both have proper `shouldSuppressShortcut` guards and `e.preventDefault()`.
  implication: Keyboard shortcuts are wired correctly. The signals DO change. The problem is downstream.

- timestamp: 2026-03-13T00:07:00Z
  checked: blurStore.ts -- toggleHQ() and toggleBypass() implementations
  found: Lines 16 and 21 correctly toggle using `.value = !signal.value`. This IS reactive and WILL notify any subscribers.
  implication: The store correctly mutates signals. Toolbar buttons visually reflect the change. But the canvas render path has no subscription to these signals.

## Resolution

root_cause: |
  TWO DISTINCT ROOT CAUSES (sharing the same mechanism):

  **Issue 1 -- HQ Preview toggle shows no quality difference:**
  The PreviewRenderer reads `blurStore.isHQ()` which uses `hqPreview.peek()` (blurStore.ts:26).
  The Preview.tsx render effect (line 70) does not subscribe to `blurStore.hqPreview.value`.
  Therefore, toggling HQ never triggers a canvas re-render. The quality change only appears
  the next time something ELSE triggers a render (scrubbing, frame change, layer edit).

  **Issue 2 -- Bypass Blur toggle doesn't work:**
  Same mechanism. The PreviewRenderer reads `blurStore.isBypassed()` which uses `bypassBlur.peek()`
  (blurStore.ts:31). The Preview.tsx render effect does not subscribe to `blurStore.bypassBlur.value`.
  Toggling bypass never triggers a canvas re-render.

  The .peek() usage in blurStore was intentional (comments say "for use in render loop") to avoid
  double-subscriptions in the rAF loop. But the side effect is that the signals became invisible
  to Preact's reactive system in the effect() that drives scrub/seek rendering.

fix: (diagnosis only -- not applied)
verification: (diagnosis only)
files_changed: []
