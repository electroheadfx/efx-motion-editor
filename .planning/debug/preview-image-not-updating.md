---
status: awaiting_human_verify
trigger: "Playback shows only last key image per sequence. All preceding keys ignored."
created: 2026-03-09T15:00:00Z
updated: 2026-03-09T16:50:00Z
---

## Current Focus

hypothesis: CSP missing blob: in img-src blocks all blob URL image loads via Image.onerror, so images never get cached. The renderer's "keep previous frame" logic then persists whatever was last displayed.
test: added blob: to CSP img-src in tauri.conf.json; diagnostic logs in getImageSource will confirm images load
expecting: after CSP fix, [IMG-LOAD] Cached logs should appear for ALL unique imageIds, and preview should show different images per frame
next_action: user verifies the fix works end-to-end

## Symptoms

expected: Frames advance at project fps - preview image updates frame by frame showing different key photo images
actual: Playback logs show imageId changes between frames (3 different IDs across 14 frames) but preview visually stays on one image. Affects playback, step forward/backward, and click-to-seek.
errors: None (ResizeObserver loop warning only)
reproduction: Tests 2, 3, 5 in UAT - play, step, or seek all show same stale image
started: Discovered during UAT

## Eliminated

- hypothesis: frameMap data layer produces wrong imageIds for frames
  evidence: prior debug session confirmed 3 different imageIds cycle correctly per frame (gf=0..13)
  timestamp: 2026-03-09T15:00:00Z

- hypothesis: render effect doesn't fire on frame change
  evidence: debug log confirms effect subscribes to currentFrame.value and fires, passing correct localFrame
  timestamp: 2026-03-09T15:01:00Z

- hypothesis: resolveLayerSource doesn't reach the base layer path
  evidence: code analysis confirms base layer has isBase=true AND imageIds.length===0, both conditions enter base path
  timestamp: 2026-03-09T16:10:00Z

- hypothesis: localFrame calculation is wrong (points to end of sequence)
  evidence: localFrame = globalFrame - startFrame; for single sequence startFrame=0, so localFrame=globalFrame which ranges correctly 0..N
  timestamp: 2026-03-09T16:15:00Z

- hypothesis: imageStore.getById returns same image for different IDs
  evidence: getById uses .find() on unique UUID-based IDs from Rust backend; each import generates new uuid::Uuid::new_v4()
  timestamp: 2026-03-09T16:20:00Z

- hypothesis: Multiple renderer instances due to component remount
  evidence: Preview component's parent CanvasArea always renders it unconditionally; useEffect([]) only runs once on mount
  timestamp: 2026-03-09T16:25:00Z

## Evidence

- timestamp: 2026-03-09T15:00:00Z
  checked: UAT logs
  found: "gf=0..13 shows 3 different imageIds (0b89995c, ce3ee08e, c1ead52c) cycling correctly per frame"
  implication: frameMap data layer is correct, bug is in rendering pipeline

- timestamp: 2026-03-09T15:01:00Z
  checked: Preview.tsx render effect
  found: "Effect subscribes to currentFrame.value, computes localFrame, calls renderer.renderFrame(). Debug log confirms imageId changes per frame."
  implication: The signal effect fires correctly and passes correct data to renderer

- timestamp: 2026-03-09T15:02:00Z
  checked: PreviewRenderer.renderFrame() -> resolveLayerSource()
  found: "For image-sequence base layer, resolves entry = frames[frame] then calls getImageSource(entry.imageId)"
  implication: Each frame should look up correct imageId - need to verify getImageSource returns different images

- timestamp: 2026-03-09T16:30:00Z
  checked: CSP in tauri.conf.json img-src directive
  found: "img-src 'self' asset: http://asset.localhost efxasset: https://* -- missing blob: directive"
  implication: blob: URLs created by readFile+Blob approach in getImageSource may be blocked by CSP, preventing image caching

- timestamp: 2026-03-09T16:31:00Z
  checked: Tauri docs on CSP configuration
  found: "Tauri recommended img-src includes blob: and data:; current config lacks both"
  implication: confirms blob: must be explicitly listed; CSP Level 3 requires explicit blob:/data: inclusion

- timestamp: 2026-03-09T16:32:00Z
  checked: commit b78cdc9 that introduced readFile + blob URL approach
  found: "Changed from img.src = assetUrl(path, id) to readFile(path).then(bytes => blob URL). This is when blob: became needed in CSP."
  implication: the bug was likely introduced by this commit, which switched to blob URLs without updating CSP

## Resolution

root_cause: CSP in tauri.conf.json missing 'blob:' in img-src directive. Commit b78cdc9 switched from efxasset:// protocol to readFile+blob URLs for image loading but didn't add blob: to the CSP. Without blob:, Image elements cannot load blob: URLs, so img.onerror fires and images never get cached. The "last key" behavior occurs because when no images are cached, resolved[] is always empty and the renderer keeps whatever was last drawn. The last-loaded image (typically the last key photo due to async ordering) gets displayed and persists across all frame changes.
fix: Add blob: to CSP img-src directive in tauri.conf.json. The readFile+blob URL approach introduced in commit b78cdc9 requires blob: in CSP to allow Image elements to load blob URLs.
verification: pending user test
files_changed:
  - Application/src-tauri/tauri.conf.json (added blob: to img-src CSP)
