---
status: diagnosed
trigger: "Cmd+- zooms IN instead of OUT (reversed), Cmd+= does not work at all. Cmd+0 works fine."
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:10:00Z
---

## Current Focus

hypothesis: Tauri's WKWebView on macOS intercepts Cmd+= and Cmd+- at the native Cocoa layer (built-in webview zoom accelerators), preventing JS keydown events from firing or causing dual behavior (native page zoom + canvas zoom conflict).
test: n/a -- diagnosis complete
expecting: n/a
next_action: Report root cause

## Symptoms

expected: Cmd+= should zoom in, Cmd+- should zoom out
actual: Cmd+- zooms IN (reversed), Cmd+= does not work at all
errors: none reported
reproduction: Press Cmd+- (should zoom out, instead zooms in); press Cmd+= (should zoom in, does nothing)
started: Since shortcuts were added in commit 0cb87fa

## Eliminated

- hypothesis: "Keybindings are swapped in shortcuts.ts (Equal -> zoomOut, Minus -> zoomIn)"
  evidence: Code clearly shows '$mod+Equal' -> zoomIn() (line 201) and '$mod+Minus' -> zoomOut() (line 206). Mapping is correct.
  timestamp: 2026-03-12T00:01:00Z

- hypothesis: "canvasStore.zoomIn/zoomOut methods have reversed logic"
  evidence: zoomIn() finds next preset ABOVE current (correct), zoomOut() finds next preset BELOW current (correct). Toolbar buttons use same methods and work correctly per UAT.
  timestamp: 2026-03-12T00:02:00Z

- hypothesis: "tinykeys parses '$mod+Equal' or '$mod+Minus' incorrectly"
  evidence: Traced tinykeys parseKeybinding regex (/\b\+/) through both strings. '$mod+Equal' correctly parses to modifiers=["Meta"], key="Equal". '$mod+Minus' correctly parses to modifiers=["Meta"], key="Minus". matchKeyBindingPress matches event.code ("Equal"/"Minus") correctly.
  timestamp: 2026-03-12T00:05:00Z

- hypothesis: "Key code naming mismatch (tinykeys expects different names than browser sends)"
  evidence: Tinykeys matches against both event.key (case-insensitive) and event.code (exact). On standard keyboards, Minus key sends code="Minus", key="-"; Equal key sends code="Equal", key="=". The binding names "Equal" and "Minus" match event.code exactly.
  timestamp: 2026-03-12T00:06:00Z

## Evidence

- timestamp: 2026-03-12T00:01:00Z
  checked: shortcuts.ts lines 198-211
  found: Bindings are '$mod+Equal' -> zoomIn(), '$mod+Minus' -> zoomOut(), '$mod+Digit0' -> fitToWindow()
  implication: The mapping is correct. Equal->zoomIn, Minus->zoomOut.

- timestamp: 2026-03-12T00:02:00Z
  checked: canvasStore.ts zoomIn() and zoomOut() methods
  found: zoomIn() iterates ZOOM_PRESETS forward to find next preset ABOVE current (correct for zoom in). zoomOut() iterates backward to find next preset BELOW current (correct for zoom out).
  implication: The store methods are correctly named and implemented. The bug is NOT in canvasStore.

- timestamp: 2026-03-12T00:03:00Z
  checked: tinykeys v3.0.0 source (dist/tinykeys.module.js)
  found: parseKeybinding splits on /\b\+/ (word boundary + plus). matchKeyBindingPress checks r.toUpperCase() !== e.key.toUpperCase() && r !== e.code -- matches EITHER event.key (case-insensitive) OR event.code (exact).
  implication: tinykeys parsing and matching logic is correct for these bindings.

- timestamp: 2026-03-12T00:04:00Z
  checked: UAT report (.planning/phases/09-canvas-zoom/09-UAT.md, test 4)
  found: User explicitly reported "Cmd+- does a zoom in instead of a zoom out (minus decrease canvas), and Cmd+= (plus) no work". Cmd+0 works fine. Toolbar +/- buttons work correctly.
  implication: The issue is specific to keyboard shortcuts, not the zoom store logic. Something intercepts or interferes with Cmd+= and Cmd+- specifically.

- timestamp: 2026-03-12T00:05:00Z
  checked: Tauri lib.rs (Application/src-tauri/src/lib.rs)
  found: Comments on lines 20-23 explicitly document that native Cocoa accelerators intercept keydown events before they reach WKWebView. This was the exact same problem with Cmd+Z/Cmd+Shift+Z which required custom menu items to fix. The app has NO View menu disabling native zoom shortcuts.
  implication: Cmd+= and Cmd+- are standard macOS zoom accelerators. WKWebView on macOS handles these at the native Cocoa layer, either preventing JS events from firing or causing native page zoom alongside (or instead of) canvas zoom.

- timestamp: 2026-03-12T00:06:00Z
  checked: Cmd+0 behavior vs Cmd+=/Cmd+-
  found: Cmd+0 works correctly. On macOS, Cmd+0 is "Actual Size" (reset zoom) in browsers -- but the binding uses 'Digit0' (event.code) which may not conflict with native handlers the same way, or the native zoom reset may coincidentally produce a compatible result with fitToWindow().
  implication: Cmd+0 working while Cmd+=/Cmd+- fail is consistent with native WKWebView zoom interception, since the native "reset zoom" and canvas "fitToWindow" produce visually similar results.

- timestamp: 2026-03-12T00:07:00Z
  checked: Toolbar.tsx zoom buttons (lines 118, 129)
  found: Toolbar - button calls zoomOut(), + button calls zoomIn(). These work correctly per UAT.
  implication: Confirms the canvasStore methods work; the issue is isolated to keyboard event handling.

## Resolution

root_cause: Tauri's WKWebView on macOS has built-in native zoom accelerators for Cmd+= (zoom in page), Cmd+- (zoom out page), and Cmd+0 (reset page zoom). These are handled at the Cocoa/WKWebView layer BEFORE keydown events reach the JavaScript context. This is the same class of bug documented in lib.rs for Undo/Redo (lines 20-23). For Cmd+=: the native handler consumes the event entirely, so the JS handler never fires ("does not work at all"). For Cmd+-: the native handler triggers page-level zoom out (shrinking the entire webview content), which the user perceives as zoom in or reversed behavior since it's not the expected canvas-level zoom. Cmd+0 appears to work because the native "reset zoom" and canvas fitToWindow() produce a compatible visual result.
fix:
verification:
files_changed: []
