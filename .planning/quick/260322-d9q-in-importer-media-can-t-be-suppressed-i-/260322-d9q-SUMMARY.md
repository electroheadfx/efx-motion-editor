---
phase: quick
plan: 260322-d9q
subsystem: ui
tags: [context-menu, import-grid, asset-management, tauri-fs]

provides:
  - Context menu on ImportGrid for removing/deleting imported assets
  - imageStore removeVideoAsset, removeAudioAsset, and isImageInUse methods
  - Tauri fs:allow-remove capability for filesystem deletion
affects: [import-grid, image-store]

tech-stack:
  added: []
  patterns:
    - Portal-based context menu with outside-click dismiss for asset grid items

key-files:
  created: []
  modified:
    - Application/src/stores/imageStore.ts
    - Application/src/components/import/ImportGrid.tsx
    - Application/src-tauri/capabilities/default.json

key-decisions:
  - "Context menu uses portal pattern consistent with SequenceList.tsx"
  - "Delete File also removes thumbnail for images"

requirements-completed: []

duration: 3min
completed: 2026-03-22
---

# Quick Task 260322-d9q: Import Grid Asset Removal Summary

**Right-click context menu on ImportGrid with Remove Reference and Delete File options for images, videos, and audio assets**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T08:38:22Z
- **Completed:** 2026-03-22T08:41:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- All three asset types (image, video, audio) have context menus with Remove Reference and Delete File options
- Images in use by key photos or layers show a confirmation warning before removal
- Delete File removes from store AND deletes from filesystem via Tauri fs plugin (including thumbnail for images)
- Added fs:allow-remove capability to Tauri permissions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fs:allow-remove capability and imageStore removal methods** - `17d7a82` (feat)
2. **Task 2: Add context menu to ImportGrid for all asset types** - `89cf160` (feat)

## Files Created/Modified
- `Application/src-tauri/capabilities/default.json` - Added fs:allow-remove permission
- `Application/src/stores/imageStore.ts` - Added removeVideoAsset, removeAudioAsset, and isImageInUse methods
- `Application/src/components/import/ImportGrid.tsx` - Added context menu with Remove Reference and Delete File options for all asset types

## Decisions Made
- Context menu uses portal-based pattern matching SequenceList.tsx style (bg=var(--sidebar-panel-bg), border, text-xs items)
- Delete File for images also removes the thumbnail file from disk
- In-use check for images covers both keyPhotos.imageId and layer source imageId/imageIds

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

All files exist. All commits verified.

---
*Quick task: 260322-d9q*
*Completed: 2026-03-22*
