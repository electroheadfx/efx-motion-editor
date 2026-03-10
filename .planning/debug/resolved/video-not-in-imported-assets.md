---
status: resolved
trigger: "Video layer added but video does not appear in IMPORTED assets window"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: handleAddVideo bypasses imageStore.importFiles entirely -- it only does a raw copyFile + layerStore.add, never registering the asset
test: Compare handleAddStaticImage (works) vs handleAddVideo (broken) code paths
expecting: handleAddVideo missing imageStore registration call
next_action: return diagnosis

## Symptoms

expected: After adding a video layer, the video file should appear in the IMPORTED assets panel in LeftPanel
actual: Video file is correctly copied to project videos/ directory, layer is added, but IMPORTED panel does not show the video
errors: none
reproduction: Use Add > Video menu to import a video file
started: Likely since video layer support was first implemented

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-10T00:00:00Z
  checked: AddLayerMenu.tsx handleAddStaticImage (lines 47-89)
  found: Calls imageStore.importFiles(paths, dir) which goes through Rust IPC import pipeline, generates thumbnail, creates ImportedImage record, appends to imageStore.images signal
  implication: This is the correct import registration flow

- timestamp: 2026-03-10T00:00:00Z
  checked: AddLayerMenu.tsx handleAddImageSequence (lines 92-148)
  found: Also calls imageStore.importFiles(imagePaths, dir) -- same correct pipeline
  implication: Both image-based flows use imageStore.importFiles

- timestamp: 2026-03-10T00:00:00Z
  checked: AddLayerMenu.tsx handleAddVideo (lines 151-201)
  found: Does raw copyFile(filePath, destPath) then layerStore.add() -- NEVER calls imageStore.importFiles or any other registration mechanism
  implication: Video is copied to disk but never registered in any asset tracking store

- timestamp: 2026-03-10T00:00:00Z
  checked: ImportGrid.tsx and LeftPanel.tsx IMPORTED section
  found: ImportGrid reads imageStore.images.value and renders thumbnails. LeftPanel Import button only accepts image extensions. There is no concept of "imported videos" in the current architecture.
  implication: Even if we called imageStore.importFiles for video, it would go through the Rust image import pipeline which likely doesn't handle video files. A separate video asset tracking mechanism is needed.

- timestamp: 2026-03-10T00:00:00Z
  checked: imageStore.ts and types/image.ts
  found: imageStore is exclusively for images (ImportedImage type has width/height/format for images, import goes through ipcImportImages which processes images via Rust). No video equivalent exists.
  implication: The system has no video asset store or video asset type

## Resolution

root_cause: handleAddVideo in AddLayerMenu.tsx performs a raw file copy (copyFile) and creates a layer, but never registers the video in any asset tracking system. Unlike handleAddStaticImage and handleAddImageSequence which call imageStore.importFiles() to register assets, the video path completely bypasses asset registration. Furthermore, the architecture has no video-aware asset store -- imageStore is image-only (backed by a Rust image processing pipeline), and ImportGrid/LeftPanel IMPORTED section only displays imageStore.images.

fix: (not applied -- diagnosis only)
verification: (not applied -- diagnosis only)
files_changed: []
