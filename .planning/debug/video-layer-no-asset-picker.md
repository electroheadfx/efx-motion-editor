---
status: diagnosed
trigger: "Investigate why Add Video Layer opens file dialog instead of asset picker popover"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Video flow was never given the popover-based asset picker pattern
test: Compared static image flow vs video flow side-by-side in AddLayerMenu.tsx
expecting: N/A - confirmed
next_action: Return diagnosis

## Symptoms

expected: Clicking "Video" in Add Layer menu shows a popover grid of already-imported video assets (like the static image flow)
actual: Clicking "Video" opens a native OS file dialog to pick a new video file
errors: None (functional, but wrong UX pattern)
reproduction: Click "+ Add" button in layer panel, then click "Video"
started: Video flow was never updated; only static image flow received the popover treatment in plan 06-06

## Eliminated

(none - hypothesis confirmed on first pass)

## Evidence

- timestamp: 2026-03-10T00:01:00Z
  checked: AddLayerMenu.tsx static image flow (lines 261-314)
  found: Static image uses two-step flow - (1) setImagePickerOpen(true) shows popover grid of imageStore.images, (2) fallback "Import new..." opens file dialog. Has imagePickerOpen state, imagePickerRef, handleAddStaticImageFromAsset, handleImportNewStaticImage.
  implication: This is the reference pattern the video flow needs to replicate.

- timestamp: 2026-03-10T00:02:00Z
  checked: AddLayerMenu.tsx video flow (lines 275-280, 191-248)
  found: Video button directly calls handleAddVideo which immediately calls open() (file dialog). No videoPickerOpen state, no video picker popover JSX, no handleAddVideoFromAsset function.
  implication: Video flow was never refactored to match the static image popover pattern.

- timestamp: 2026-03-10T00:03:00Z
  checked: imageStore.ts VideoAsset interface (lines 9-13)
  found: VideoAsset has {id, name, path} but NO thumbnail_path field. Images have thumbnail_path for visual grid rendering; videos do not.
  implication: The video picker popover can render video names/icons (like ImportGrid does) but cannot show visual thumbnails without adding thumbnail support.

- timestamp: 2026-03-10T00:04:00Z
  checked: ImportGrid.tsx video rendering (lines 50-70)
  found: ImportGrid already renders videoAssets as a name+icon grid (purple dot + filename). This is the existing pattern for displaying videos without thumbnails.
  implication: A video picker popover can use this same name+icon pattern -- visual thumbnails are nice-to-have, not a blocker.

- timestamp: 2026-03-10T00:05:00Z
  checked: 06-06-PLAN.md line 253
  found: Plan explicitly says "No thumbnail (video thumbnailing would require ffmpeg -- out of scope)."
  implication: Video thumbnails were intentionally excluded. Popover should use name-based display, not thumbnail grid.

- timestamp: 2026-03-10T00:06:00Z
  checked: imageStore.ts addVideoAsset (line 83-85) and handleAddVideo (lines 228-232)
  found: addVideoAsset is called AFTER file dialog import. videoAssets signal already tracks imported videos. But there is no function to create a layer from an existing video asset (analogous to handleAddStaticImageFromAsset).
  implication: The data layer (videoAssets signal) already exists; only the UI layer (picker popover + handler) is missing.

## Resolution

root_cause: The video "Add Layer" flow was never updated to use the asset-picker popover pattern. When plan 06-06 added the popover grid for static images, the video flow was left unchanged -- it still directly opens a native file dialog. The data infrastructure exists (imageStore.videoAssets tracks imported videos), but the UI components (popover, select-from-existing handler) were never built.
fix:
verification:
files_changed: []
