---
status: diagnosed
trigger: "HQ Blur Toggle Causes Visual Corruption - blur disappears on HQ enable, zoomed/cropped on disable"
created: 2026-03-13T15:00:00Z
updated: 2026-03-13T15:45:00Z
---

## Current Focus

hypothesis: "StackBlur calls getImageData() on the main canvas which is tainted by efxasset:// custom protocol images, causing a SecurityError that disrupts rendering and corrupts the 2D context save/restore stack"
test: "Confirmed through code trace + documented Tauri tainted canvas issue #12999"
expecting: "getImageData throws SecurityError, blur is never applied (disappears), ctx.restore() calls are skipped corrupting context state (zoomed/cropped on next render)"
next_action: "Return structured diagnosis"

## Symptoms

expected: HQ button toggles between fast blur and StackBlur rendering. Canvas should show smoother blur in HQ mode without artifacts.
actual: HQ makes blur disappear. Disabling HQ after that shows image strangely zoomed and cropped. User must re-fit to recover.
errors: None reported (user likely did not check console)
reproduction: Test 5 in UAT - toggle HQ button
started: Discovered during UAT retest

## Eliminated

- hypothesis: "DPR dimension mismatch between fast and HQ blur paths"
  evidence: "Both paths use identical dimension parameters (this.canvas.width/height for adjustment-blur, off.canvas.width/height for per-layer blur). Traced all callsites -- dimensions are consistent."
  timestamp: 2026-03-13T15:10:00Z

- hypothesis: "Accumulated DPR scaling from stale ctx.save/restore stack"
  evidence: "Each renderFrame call applies fresh ctx.save() + ctx.scale(dpr, dpr) and uses setTransform(1,0,0,1,0,0) for identity. Despite stale stack entries, each render independently applies correct transforms."
  timestamp: 2026-03-13T15:20:00Z

- hypothesis: "StackBlur import/export issue"
  evidence: "Verified stackblur-canvas v3.0.0 dist/stackblur.mjs exports processCanvasRGBA as canvasRGBA correctly. Function is well-formed."
  timestamp: 2026-03-13T15:25:00Z

- hypothesis: "Canvas element recreated by Preact re-render"
  evidence: "useRef persists across re-renders. useEffect([]) runs once. PreviewRenderer references stable canvas element."
  timestamp: 2026-03-13T15:28:00Z

## Evidence

- timestamp: 2026-03-13T15:05:00Z
  checked: fxColorGrade.ts implementation pattern
  found: "Color grade was specifically rewritten to use globalCompositeOperation blending INSTEAD of getImageData/putImageData or ctx.filter. Comment on line 4-5 says 'Uses Canvas 2D globalCompositeOperation blending instead of ctx.filter (which silently fails in Tauri's WebKit WebView on tainted canvases).' The entire color grade module avoids any pixel-level API."
  implication: "The codebase already knows the canvas is tainted and designed around it -- except fxBlur.ts which uses StackBlur (getImageData) for HQ mode"

- timestamp: 2026-03-13T15:08:00Z
  checked: Image element creation in previewRenderer.ts getImageSource() (line 315-324)
  found: "img = new Image(); img.src = assetUrl(...). No crossOrigin attribute set. Images loaded from efxasset://localhost protocol without CORS request mode."
  implication: "Without img.crossOrigin = 'anonymous', browser does not send CORS request even though server sets Access-Control-Allow-Origin:*. Images taint the canvas."

- timestamp: 2026-03-13T15:12:00Z
  checked: Rust custom protocol handler in lib.rs (line 106-236)
  found: "register_uri_scheme_protocol('efxasset', ...) serves files with header Access-Control-Allow-Origin:* on all responses (images and videos). CORS header is present server-side."
  implication: "Server is CORS-ready but client doesn't request CORS mode. Adding crossOrigin='anonymous' to Image elements could untaint the canvas."

- timestamp: 2026-03-13T15:15:00Z
  checked: Tauri tainted canvas issue (referenced in 10-RESEARCH.md line 608)
  found: "GitHub issue tauri-apps/tauri#12999 titled 'Tainted canvas with custom protocol' confirms canvas taint with custom protocols in Tauri 2. The 10-RESEARCH.md cites this issue directly."
  implication: "Canvas tainting is a known, documented Tauri 2 issue with custom protocols."

- timestamp: 2026-03-13T15:18:00Z
  checked: StackBlur processCanvasRGBA source code (stackblur.mjs lines 125-157)
  found: "getImageDataFromCanvas() calls context.getImageData() in a try/catch, re-throws as new Error('unable to access image data: ' + e). No graceful fallback. processCanvasRGBA calls putImageData to write back."
  implication: "On tainted canvas, getImageData throws SecurityError. StackBlur re-throws. Error propagates through applyHQBlur -> drawAdjustmentLayer -> renderFrame -> effect callback."

- timestamp: 2026-03-13T15:22:00Z
  checked: Exception propagation path in drawAdjustmentLayer (previewRenderer.ts lines 439-455)
  found: "adjustment-blur case does ctx.save(), ctx.setTransform(1,0,0,1,0,0), then calls applyHQBlur. If applyHQBlur throws, ctx.restore() on line 454 is SKIPPED. The outer ctx.restore() on line 226 is also SKIPPED. Two save stack entries are orphaned."
  implication: "Context save/restore stack corruption explains the zoomed/cropped symptom after toggling HQ off. The 'fit' operation changes canvas CSS dimensions -> triggers canvas.width reset in renderFrame -> resets entire context state -> fixes corruption."

- timestamp: 2026-03-13T15:30:00Z
  checked: Fast blur path (applyFastBlur) for comparison
  found: "applyFastBlur uses only drawImage, clearRect, and imageSmoothingEnabled -- no getImageData/putImageData. Works perfectly on tainted canvases. This is why fast blur works but HQ blur fails."
  implication: "Confirms the root cause is specifically getImageData on tainted canvas, not a general blur algorithm issue"

- timestamp: 2026-03-13T15:35:00Z
  checked: 10-RESEARCH.md anti-patterns section (line 277)
  found: "Research doc lists anti-pattern: 'Using getImageData/putImageData for fast preview: Pixel-level operations are too slow for real-time playback. Only use for HQ/export mode via StackBlur.' The research acknowledged tainted canvas issue for ctx.filter but did not flag getImageData/putImageData as also affected by canvas tainting."
  implication: "Design oversight: the research correctly identified ctx.filter as broken on tainted canvases but failed to recognize that getImageData (used by StackBlur) has the same tainted-canvas restriction"

## Resolution

root_cause: "StackBlur's canvasRGBA/canvasRGB functions call getImageData() internally, which throws a SecurityError on the tainted canvas. The canvas is tainted because images are loaded from the efxasset:// custom protocol without setting crossOrigin='anonymous' on the Image elements. The research phase identified that ctx.filter fails on tainted canvases (and designed fxColorGrade.ts around it), but failed to recognize that getImageData() -- used by StackBlur for HQ blur -- has the same tainted-canvas restriction. The thrown exception skips ctx.restore() calls, corrupting the 2D context save/restore stack, which explains the zoomed/cropped visual corruption after toggling HQ off."

fix: (not applied - diagnosis only)
verification: (not applicable)
files_changed: []
