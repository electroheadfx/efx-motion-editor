---
phase: quick-261012-kxg
plan: 261012-kxg
subsystem: export
tags: [video, export, readiness, seek, motion-blur, fail-closed, preact, vitest]

# Dependency graph
requires:
  - phase: quick-261012-exn
    provides: SND-02 fail-closed export diagnostic law that VID-04 mirrors for video clips
provides:
  - PreviewRenderer.preloadVideos + settleVideoSeeks seam (bounded, cancellable, fail-closed naming the clip)
  - async renderFrameWithMotionBlur with per-sub-frame settle + conditional second pass
  - "exportEngine wiring: one AbortController over image preload + video preload + frame loop, 200ms cancel poll, aborted-vs-failed routing"
  - ExportPreview dialog closed on the same preload+settle seam (warning-only asymmetry documented)
  - VID-04 headless legs (readiness A1-A3/B1-B4, engine C/D, motion-blur E) and VID-04 requirement entry
affects: [release-261012, quick-261012-kxg-uat]

# Actuals (#2632) — pairs with the plan's estimate (tokens 30000 / tasks 2).
actuals:
  tokens: 11138   # chars/4 over the realized diff (44553 bytes)
  tasks: 2
  commits: 2      # measured: git rev-list --count 009c94b7..HEAD
plan_head_before: 009c94b7d2327026a2b0eb05937e45c7d2296118
plan_head_after: b2722a753b4af581df5328f26e8fd598ff3fddab

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "two-gap export readiness: initial preloadVideos (readyState >= 2) + settleVideoSeeks (await seeked) two-pass capture"
    - "bounded one-shot waits with listeners attached BEFORE final state re-check; cleanup on every exit path"
    - "fail-closed named errors (videoBlockedError) sharing the SND-02 export-diagnostic law"
    - "shared video state across cloneForCanvas so GL-transition clones seek the same elements"

key-files:
  created:
    - app/src/lib/previewRenderer.videoReadiness.test.ts
  modified:
    - app/src/lib/previewRenderer.ts
    - app/src/lib/exportRenderer.ts
    - app/src/lib/exportEngine.ts
    - app/src/components/export/ExportPreview.tsx
    - app/src/lib/exportEngine.test.ts
    - app/src/lib/exportRenderer.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Settle returns false synchronously when nothing is pending so video-less exports render exactly once (existing call-count assertions stay valid)"
  - "Draw owns the seek math: settle waits for seeks registered by the draw pass itself, never duplicating local-frame/fps computation"
  - "Dialog preview degrades broken video sources to a console warning (dialog canvas is not a delivered artifact); only the export fail-closes"
  - "FakeVideo harness installs as both document.createElement('video') and the global HTMLVideoElement so instanceof checks match in Node env"

patterns-established:
  - "Export video readiness law (VID-04): preload before the loop, settle before capture, fail-closed naming the clip"

requirements-completed: []  # VID-04 defined in REQUIREMENTS.md but stays Pending until the user's 4 native UAT rows pass

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "PreviewRenderer preloadVideos + settleVideoSeeks seam with bounded cancellable waits and named fail-closed errors"
    requirement: VID-04
    verification:
      - kind: unit
        ref: "app/src/lib/previewRenderer.videoReadiness.test.ts#261012-kxg export video readiness (VID-04) — A1-A3, B1-B4"
        status: pass
    human_judgment: false
  - id: D2
    description: "exportEngine wiring: preload before the frame loop, settle before capture, one AbortController + 200ms cancel poll, aborted-vs-named-error routing"
    requirement: VID-04
    verification:
      - kind: unit
        ref: "app/src/lib/exportEngine.test.ts#261012-kxg export fail-closed video (VID-04) — legs C/D"
        status: pass
    human_judgment: true
    rationale: "Cancel mid-wait, the 30s/5s bounds, and real-file fail-closed behavior must be judged live against HyperEspaceSUPP.mov — native UAT rows 1/4 (unit legs pin the wiring only)"
  - id: D3
    description: "Motion-blur async path settles every sub-frame before accumulation; ExportPreview dialog preview closed on the same preload+settle seam"
    requirement: VID-04
    verification:
      - kind: unit
        ref: "app/src/lib/exportRenderer.test.ts#261012-kxg motion-blur sub-frame settle (VID-04) — leg E"
        status: pass
    human_judgment: true
    rationale: "Exported-pixel correctness (start/middle/end frames match the timeline) and the dialog preview showing video content are visual judgments — native UAT rows 2/3"
  - id: D4
    description: "VID-04 requirement defined in REQUIREMENTS.md (checklist, traceability Quick 4 Pending, coverage 11/11)"
    requirement: VID-04
    verification:
      - kind: other
        ref: ".planning/REQUIREMENTS.md — VID-04 appears in checklist, traceability, coverage, footer"
        status: pass
    human_judgment: false

# Metrics
duration: 24min
completed: 2026-10-12
status: complete
audit_acknowledged:
  milestone: v1.0.1
  at: 2026-10-14
  status: complete
---

# Phase quick-261012-kxg: Export Video Readiness Summary

**Two-gap export readiness seam (preloadVideos readyState>=2 + settleVideoSeeks await seeked) so no exported frame can bake the "Loading <name>..." placeholder, fail-closed naming the clip (VID-04)**

## Performance

- **Duration:** 24 min
- **Started:** 2026-10-12T13:33:13Z
- **Completed:** 2026-10-12T13:57Z
- **Tasks:** 2 / 2
- **Files modified:** 8

## Accomplishments

- Initial readiness: `preloadVideos(sequences, signal)` runs after `preloadExportImages` and before the frame loop; every video layer reaches readyState >= 2 or the export stops with `Export blocked — video "<name>" ...` (SND-02 law). A missing videoAsset row fail-closes too.
- Seek completion: `settleVideoSeeks(signal)` gates a second render pass per frame — and per motion-blur sub-frame in the now-async `renderFrameWithMotionBlur` — so captured pixels always come from the settled pass.
- Cancellation: one AbortController spans image preload + video preload + frame loop with the existing 200ms `isCancelled` poll; mid-wait abort routes to status 'cancelled', failures route to the named error; all waits bounded (30s readiness / 5s seek) with listeners attached before the final state re-check.
- Export dialog preview closed on the same seam (warning-only asymmetry documented in-code); live preview path (loadeddata/seeked listeners, readyState gate), video asset resolution, and `preloadExportImages` image logic untouched — grep-verified.
- 10 new headless legs across 3 suites, all green; full suite 4868 passed / 96 todo with no new failures; typecheck clean; VID-04 added to REQUIREMENTS.md (11/11 mapped, Pending).

## Task Commits

Each task was committed atomically (code only; docs artifacts left for the orchestrator):

1. **Task 1: export readiness fix (preload loadeddata, settle seeked, fail-closed)** - `d185193b` (fix)
2. **Task 2: pin export video readiness legs + define VID-04** - `b2722a75` (test)

**Measured commits:** 2 (base `009c94b7`..HEAD)

## Files Created/Modified

- `app/src/lib/previewRenderer.ts` — VIDEO_*_TIMEOUT_MS, videoLayerNames, videoBlockedError, waitForVideo, awaitVideoSettled, preloadVideos, settleVideoSeeks; cloneForCanvas shares the three video maps; live listener/readyState lines byte-identical (one additive layerNames.set line)
- `app/src/lib/exportRenderer.ts` — renderFrameWithMotionBlur is async and settles after every sub-frame render before reading pixels; preloadExportImages unchanged
- `app/src/lib/exportEngine.ts` — AbortController + 200ms cancel poll, preloadVideos after image preload, per-frame settle two-pass capture, aborted→'cancelled' / else named error, outer finally clearInterval
- `app/src/components/export/ExportPreview.tsx` — dialog preload+settle on the same seam with local AbortController aborted on cleanup; no new state/signals
- `app/src/lib/previewRenderer.videoReadiness.test.ts` (new) — FakeVideo harness; legs A1-A3 (initial readiness/fail-closed), B1-B4 (settle no-op, in-flight wait, abort, 30s bound)
- `app/src/lib/exportEngine.test.ts` — legs C (error fail-closes before any frame/PNG, name in errorMessage) and D (ready video exports 4 frames, one render each)
- `app/src/lib/exportRenderer.test.ts` — leg E (settle called exactly 3x for 3 sub-frames; final currentTime = (2/3)/24)
- `.planning/REQUIREMENTS.md` — VID-04 checklist line (unchecked, Pending), traceability row, coverage 10→11, footer line

## Decisions Made

- Settle returns `false` synchronously when no element is pending — video-less exports render exactly once and existing renderGlobalFrame call-count assertions stay valid.
- The draw pass owns seek math; settle only awaits what the draw registered (single source of truth, no duplicated fps/local-frame computation).
- Dialog preview warns instead of fail-closing (not a delivered artifact) — commented in-code as the VID-04 asymmetry.
- Fix-before-tests carve-out applied per plan and project law (live export bug validated before pinning).

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** No unplanned work; guardrail greps (live preview path, asset resolution, preloadExportImages, vitest.config.ts, package.json untouched) all passed.

## Issues Encountered

- The new readiness suite's `vi.hoisted` destructure was written as `{ decodeWebpFrameMock }` against a factory returning `{ decodeWebpFrame }` — first run failed all 7 legs with `Cannot read properties of undefined (reading 'mockReset')`. Fixed by aliasing in the destructure (`{ decodeWebpFrame: decodeWebpFrameMock }`); suite green on re-run. In-task fix, verified by the full suite, not a plan deviation.
- `gsd_run` is not on PATH — used the project-local `.claude/gsd-core/bin/gsd_run` for the pre-commit protected-branch assertion (as the plan noted).

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. VID-04's unchecked REQUIREMENTS box is intentional: it stays `- [ ]` Pending until the user's native UAT rows pass (do not mark complete at verify time).

## Next Phase Readiness

- **Status: automated-ready.** All 10 unit legs pass; the plan's success criterion requires the user's 4 native UAT rows before anything is claimed done:
  1. H.264 export with HyperEspaceSUPP.mov — output contains video frames, zero "Loading..." boxes
  2. Export-dialog preview shows video content
  3. Start/middle/end frames match the timeline (not stale)
  4. Renamed/missing .mov → export stops naming the clip, no placeholder baked
- After UAT pass: the Release phase RE-RUNS from Apple sign/notarize (1.0.1 bump stays; no second bump).

## Self-Check: PASSED

- FOUND: app/src/lib/previewRenderer.videoReadiness.test.ts (created, committed)
- FOUND: all 7 modified files in commit diff (8 files changed across 2 commits)
- FOUND: d185193b is ancestor of HEAD
- FOUND: b2722a75 is ancestor of HEAD
- FOUND: .planning/REQUIREMENTS.md contains VID-04 x3 (checklist, traceability, footer)

---
*Phase: quick-261012-kxg*
*Completed: 2026-10-12*
