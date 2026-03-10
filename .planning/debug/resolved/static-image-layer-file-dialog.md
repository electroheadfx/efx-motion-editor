---
status: resolved
trigger: "Add Static Image Layer opens a file dialog instead of showing a grid of already imported assets"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: handleAddStaticImage directly calls Tauri open() file dialog instead of showing an asset picker popover from imageStore.images
test: Read code path in AddLayerMenu.tsx line 47-89
expecting: Confirmed -- no asset grid exists, only file dialog
next_action: Return diagnosis

## Symptoms

expected: Clicking "Static Image" in Add Layer menu should show a grid of already-imported assets (like the Key Photos manager does), with an optional fallback to import new files via file dialog
actual: Clicking "Static Image" immediately opens the OS file dialog (Tauri open()) requiring the user to browse the filesystem
errors: None (functional, but wrong UX)
reproduction: Click "+ Add" in layer panel, then click "Static Image"
started: Always been this way -- original implementation only used file dialog

## Eliminated

(none -- root cause identified on first pass)

## Evidence

- timestamp: 2026-03-10T00:00:00Z
  checked: AddLayerMenu.tsx handleAddStaticImage (lines 47-89)
  found: Directly calls `await open({...})` from @tauri-apps/plugin-dialog. No popover, no asset grid, no reference to imageStore.images for browsing existing assets.
  implication: This is the root cause -- the handler was built as "import new file" rather than "pick from existing assets"

- timestamp: 2026-03-10T00:00:00Z
  checked: KeyPhotoStrip.tsx AddKeyPhotoButton (lines 177-241)
  found: Complete working pattern for an asset picker popover. Uses `imageStore.images.value` to get all imported images, renders a grid of thumbnail buttons using `assetUrl(img.thumbnail_path)`, and calls a callback with the selected imageId.
  implication: This is the exact pattern to replicate for the static image layer picker

- timestamp: 2026-03-10T00:00:00Z
  checked: imageStore.ts
  found: `imageStore.images` is a signal<ImportedImage[]> containing all imported images. Each image has id, thumbnail_path, project_path, original_path, width, height, format. The `assetUrl()` helper converts paths to displayable URLs.
  implication: The data source for the asset grid already exists and is proven to work

## Resolution

root_cause: |
  `handleAddStaticImage` in AddLayerMenu.tsx (line 47-89) directly calls the Tauri `open()` file dialog.
  It never consults `imageStore.images` to show already-imported assets.
  The entire flow is: open file dialog -> import file -> create layer.
  It should be: show asset grid popover -> user picks existing image -> create layer (with optional "Import new..." button as fallback).

fix: (not applied -- diagnosis only)
verification: (not applied -- diagnosis only)
files_changed: []
