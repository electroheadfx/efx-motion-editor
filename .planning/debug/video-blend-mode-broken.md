---
status: investigating
trigger: "Investigate why blend mode doesn't work on video layers but works on image layers"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: Video readyState < 2 causes resolveVideoSource to return null, so video never enters the resolved[] array and drawLayer (which applies blend mode) is never called for video layers. The loading placeholder ignores blend mode entirely.
test: Trace code path for video layers through renderFrame
expecting: Confirm that blend mode is only applied inside drawLayer, which is only called for resolved sources
next_action: Verify no re-render callback exists for video readyState changes (unlike onImageLoaded for images)

## Symptoms

expected: Blend mode (screen, multiply, overlay, add) should visually affect video layers the same as image layers
actual: Blend mode has no effect on video layers; works correctly on image layers
errors: None (silent failure)
reproduction: Add a video layer, change its blend mode to anything other than normal
started: Since video layer support was added

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-10T00:01:00Z
  checked: previewRenderer.ts drawLayer method (lines 270-355)
  found: Blend mode IS correctly applied via ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode) at line 281. This code path works for ANY CanvasImageSource including HTMLVideoElement.
  implication: The drawLayer method itself is not the problem. If a video source reaches drawLayer, blend mode WILL be applied.

- timestamp: 2026-03-10T00:02:00Z
  checked: previewRenderer.ts resolveVideoSource method (lines 238-265)
  found: Returns null when video.readyState < 2 (line 262). No event listener is attached to the video element for 'loadeddata', 'canplay', 'seeked', or any readyState change event. The video element is created with preload='auto' and src set, but nothing triggers a re-render when it becomes ready.
  implication: CRITICAL FINDING - Unlike images (which have img.onload -> onImageLoaded callback -> renderCurrent), videos have NO equivalent callback. When readyState transitions from <2 to >=2, nothing triggers a re-render.

- timestamp: 2026-03-10T00:03:00Z
  checked: Preview.tsx render triggers (lines 40-49, 52-65)
  found: Three render triggers exist: (1) signal effect on frame/layer/sequence changes, (2) onImageLoaded callback for async image loads, (3) rAF loop during playback. The rAF loop only renders during playback (isPlaying check at line 56). When NOT playing, only signal effects trigger renders.
  implication: If user adds a video layer and is NOT playing, the signal effect fires once (adding the layer). At that point video.readyState is likely 0 or 1 (still loading). resolveVideoSource returns null. Video goes into loadingVideoLayers and gets a placeholder. NO subsequent re-render is triggered when video finishes loading.

- timestamp: 2026-03-10T00:04:00Z
  checked: previewRenderer.ts loading placeholder code (lines 116-130)
  found: Loading placeholder draws a gray rectangle with "Loading {layer.name}..." text. It does NOT apply the layer's blend mode or opacity. ctx.save()/ctx.restore() wraps it but globalCompositeOperation is never set from the layer's blendMode.
  implication: Even the placeholder ignores blend mode, but this is a secondary issue.

- timestamp: 2026-03-10T00:05:00Z
  checked: Comparison of image vs video async loading patterns
  found: Images use getImageSource() which sets img.onload = () => { this.onImageLoaded?.() } (line 222-225). This calls renderCurrent() in Preview.tsx (line 31). Videos have NO equivalent event handler. The video element at lines 247-252 is created with no event listeners attached.
  implication: ROOT CAUSE CONFIRMED - Missing re-render callback for video readyState changes.

- timestamp: 2026-03-10T00:06:00Z
  checked: Whether rAF loop compensates during playback
  found: During playback (isPlaying=true), the rAF loop at Preview.tsx:55-64 calls renderCurrent() every frame. This WOULD re-render with the video once readyState >= 2. So blend mode likely DOES work during active playback, but NOT when scrubbing or stationary on a frame.
  implication: The bug manifests primarily when NOT playing: adding video layer, scrubbing to a frame, or changing blend mode while paused. During playback the rAF loop provides continuous re-renders that eventually catch the video in ready state.

## Resolution

root_cause: Video layers lack a re-render callback when video.readyState transitions to >= 2 (HAVE_CURRENT_DATA). Unlike image layers which trigger onImageLoaded when their HTMLImageElement loads, video elements are created in resolveVideoSource with no event listeners (loadeddata, canplay, seeked). When renderFrame runs and video.readyState < 2, the video returns null and falls into the loadingVideoLayers placeholder path. No subsequent re-render is triggered, so the video stays as a loading placeholder indefinitely (until some other change triggers a signal effect or playback starts the rAF loop). Since drawLayer (where blend mode is applied) only runs for resolved sources, blend mode never takes effect on a video that never resolves.
fix:
verification:
files_changed: []
