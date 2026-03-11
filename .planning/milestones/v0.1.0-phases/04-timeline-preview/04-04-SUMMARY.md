---
phase: 04-timeline-preview
plan: 04
subsystem: preview
tags: [webkit, cache-control, custom-protocol, canvas, image-loading]

# Dependency graph
requires:
  - phase: 04-timeline-preview (plan 01)
    provides: PreviewRenderer with Canvas 2D compositing and efxasset protocol
provides:
  - Cache-busted efxasset:// protocol responses (no-cache, no-store headers)
  - Unique per-imageId URLs via cache-buster query param
  - Clean Preview.tsx without debug logging
affects: [04-timeline-preview, preview, export]

# Tech tracking
tech-stack:
  added: []
  patterns: [cache-buster query param on custom protocol URLs]

key-files:
  created: []
  modified:
    - Application/src-tauri/src/lib.rs
    - Application/src/lib/ipc.ts
    - Application/src/lib/previewRenderer.ts
    - Application/src/components/Preview.tsx

key-decisions:
  - "Belt-and-suspenders cache busting: both Cache-Control headers and URL query param"
  - "imageId used as bustKey since each distinct image already has a unique imageId in store"

patterns-established:
  - "Cache-buster pattern: assetUrl(path, bustKey) appends ?v={bustKey} for unique URLs"

requirements-completed: [PREV-01, PREV-02, PREV-03]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 04 Plan 04: Preview Cache Fix Summary

**Cache-Control headers and per-imageId cache-buster URLs fix WebKit WebView aggressive caching of efxasset:// protocol responses**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T17:35:27Z
- **Completed:** 2026-03-09T17:37:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added Cache-Control: no-cache, no-store, must-revalidate and Pragma: no-cache headers to efxasset protocol handler in Rust
- Added optional bustKey parameter to assetUrl() with ?v={bustKey} query string for per-imageId unique URLs
- PreviewRenderer now passes imageId as cache-buster when loading images, breaking WebKit URL-level caching
- Removed debug console.log block from Preview.tsx render effect

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Cache-Control headers to efxasset protocol and cache-buster to image URLs** - `f23a1c5` (feat)
2. **Task 2: Fix previewRenderer image loading to use cache-buster and clean up Preview.tsx** - `145cedf` (fix)

## Files Created/Modified
- `Application/src-tauri/src/lib.rs` - Added Cache-Control and Pragma no-cache headers to efxasset protocol response
- `Application/src/lib/ipc.ts` - Added optional bustKey parameter to assetUrl() function
- `Application/src/lib/previewRenderer.ts` - Pass imageId as cache-buster to assetUrl() in getImageSource()
- `Application/src/components/Preview.tsx` - Removed debug logging block from render effect

## Decisions Made
- Belt-and-suspenders approach: Cache-Control headers may not be respected by WebKit on custom protocols, so URL query param ensures uniqueness regardless
- imageId is the natural bustKey since each distinct image already has a unique imageId in the store

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Preview should now correctly display different images when stepping, playing, and seeking through frames
- UAT Tests 2, 3, 5 should pass with these cache-busting fixes
- Manual verification recommended: open project with multiple key photos and confirm visual frame changes

## Self-Check: PASSED

All files exist, all commits verified, all content changes confirmed.

---
*Phase: 04-timeline-preview*
*Completed: 2026-03-09*
