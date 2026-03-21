---
phase: 14-png-export
plan: 03
subsystem: export
tags: [canvas, preact-signals, tauri-ipc, png, compositing, notification, progress, sidecar]

# Dependency graph
requires:
  - phase: 14-01
    provides: "renderGlobalFrame shared function, export types/store, Rust IPC commands"
  - phase: 14-02
    provides: "ExportView UI shell, FormatSelector, ExportPreview, EditorMode 'export'"
provides:
  - "startExport async function: frame-by-frame PNG export with yielding loop"
  - "resumeExport function: resume from last successful frame after error"
  - "ExportProgress overlay: frame counter, ETA, cancel, resume, Open in Finder"
  - "generateJsonSidecar: D-21 JSON metadata sidecar"
  - "generateFcpxml: D-22 FCPXML sidecar for ProRes exports"
  - "D-31 macOS native notification on background export completion"
  - "ExportPreview canvas rendering of sample frame"
  - "Export button wired with disabled state"
affects: [14-04-ffmpeg, 14-05-metadata]

# Tech tracking
tech-stack:
  added: ["@tauri-apps/plugin-notification", "tauri-plugin-notification"]
  patterns:
    - "Offscreen canvas export at exact pixel resolution without DPR scaling"
    - "Rolling-average ETA computation with 20-frame window"
    - "Dynamic import for optional Tauri plugins (notification)"

key-files:
  created:
    - "Application/src/lib/exportEngine.ts"
    - "Application/src/lib/exportSidecar.ts"
    - "Application/src/components/export/ExportProgress.tsx"
  modified:
    - "Application/src/components/views/ExportView.tsx"
    - "Application/src/components/export/ExportPreview.tsx"
    - "Application/src-tauri/src/lib.rs"
    - "Application/src-tauri/Cargo.toml"
    - "Application/src-tauri/capabilities/default.json"
    - "Application/package.json"

key-decisions:
  - "Used projectStore.name (not projectName) since projectStore exports 'name' signal"
  - "Dynamic import for notification plugin with try/catch fallback for graceful degradation"
  - "ExportSidecar created in Task 1 commit as Rule 3 dependency (needed by exportEngine import)"
  - "Preview canvas renders middle frame of timeline as sample (Math.floor(frames / 2))"

patterns-established:
  - "Offscreen canvas PNG export: createElement('canvas') at export resolution, no DPR"
  - "Progress overlay pattern: absolute positioning inside relative parent"
  - "Tauri notification plugin: dynamic import with permission check before send"

requirements-completed: [EXPORT-01, EXPORT-03, EXPORT-04]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 14 Plan 03: Export Engine & Progress Summary

**Frame-by-frame PNG export engine with yielding loop, cancel/resume support, rolling-average ETA, JSON/FCPXML sidecars, progress overlay, and macOS background notification**

## Performance

- **Duration:** 5 min 50s
- **Started:** 2026-03-21T11:00:09Z
- **Completed:** 2026-03-21T11:05:59Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Built the complete export pipeline: offscreen canvas rendering at exact export resolution, PNG blob extraction, IPC writes to disk, with yielding between frames for UI responsiveness
- Created ExportProgress overlay modal with real-time frame counter, rolling-average ETA, cancel button, resume-from-error, and Open in Finder on completion
- Implemented JSON metadata sidecar (D-21) with project info, sequence mapping, and transition data; FCPXML sidecar (D-22) for ProRes with v1.11 DTD
- Added macOS native notification via @tauri-apps/plugin-notification when export completes while app is in background (D-31)
- Upgraded ExportPreview from placeholder to actual canvas rendering of a sample frame from the middle of the timeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create exportEngine.ts with yielding export loop** - `ad62e40` (feat)
2. **Task 2: ExportProgress, sidecar, preview, notification, wire Export button** - `b89f855` (feat)

## Files Created/Modified
- `Application/src/lib/exportEngine.ts` - Export loop: frame iteration, PNG extraction, IPC writes, progress, cancel, resume
- `Application/src/lib/exportSidecar.ts` - JSON and FCPXML sidecar generation
- `Application/src/components/export/ExportProgress.tsx` - Progress modal overlay with frame counter, time estimate, cancel, resume, Open in Finder
- `Application/src/components/views/ExportView.tsx` - Wired startExport onClick, disabled state, ExportProgress overlay
- `Application/src/components/export/ExportPreview.tsx` - Canvas-rendered sample frame thumbnail
- `Application/src-tauri/src/lib.rs` - Registered tauri_plugin_notification::init()
- `Application/src-tauri/Cargo.toml` - Added tauri-plugin-notification dependency
- `Application/src-tauri/Cargo.lock` - Updated lock file
- `Application/src-tauri/capabilities/default.json` - Added notification:default permission
- `Application/package.json` - Added @tauri-apps/plugin-notification
- `Application/pnpm-lock.yaml` - Updated lock file

## Decisions Made
- **projectStore.name vs projectName**: Plan referenced `projectStore.projectName` but the actual store exports `projectStore.name`. Used the correct signal name.
- **Dynamic import for notification**: Used dynamic `await import('@tauri-apps/plugin-notification')` inside try/catch so the export engine degrades gracefully if the plugin is unavailable.
- **exportSidecar.ts created in Task 1**: The exportEngine.ts imports generateJsonSidecar, so the sidecar module was created as a Rule 3 blocking dependency in Task 1's commit rather than waiting for Task 2.
- **Preview sample frame**: Renders the middle frame of the timeline (Math.floor(frames / 2)) for a representative preview thumbnail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created exportSidecar.ts in Task 1 (needed for import resolution)**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** exportEngine.ts imports `generateJsonSidecar` from `./exportSidecar` which doesn't exist until Task 2
- **Fix:** Created the full exportSidecar.ts in Task 1 (included in Task 1 commit), with Task 2 adding the remaining changes
- **Files modified:** Application/src/lib/exportSidecar.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** ad62e40 (Task 1 commit)

**2. [Rule 1 - Bug] Used projectStore.name instead of projectStore.projectName**
- **Found during:** Task 1 (implementation)
- **Issue:** Plan's code template referenced `projectStore.projectName.peek()` but the actual store exports `projectStore.name` signal
- **Fix:** Changed to `projectStore.name.peek()` to match the real API
- **Files modified:** Application/src/lib/exportEngine.ts
- **Verification:** TypeScript compiles cleanly, signal reads correct value
- **Committed in:** ad62e40 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Export engine is fully functional for PNG image sequences
- Ready for Plan 04 (FFmpeg management) to extend with video encoding
- Ready for Plan 05 (integration) to add final polish and end-to-end testing
- ExportProgress overlay pattern can be extended for video encoding status

## Self-Check: PASSED

All 3 created files verified present. All 6 modified files verified present. Both task commits (ad62e40, b89f855) verified in git log.

---
*Phase: 14-png-export*
*Completed: 2026-03-21*
