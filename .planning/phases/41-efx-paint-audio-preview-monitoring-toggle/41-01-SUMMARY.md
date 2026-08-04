---
phase: 41-efx-paint-audio-preview-monitoring-toggle
plan: 01
subsystem: audio
tags: [audio, truth-table, tdd-red, web-audio, tauri-bridge, efxasset]

requires:
  - phase: 39-efx-paint-scripts-auto-hydration
    provides: revisioned exact-payload launch/session bridge idiom (physicsPaintLaunchContext)
  - phase: 38.1-studio-render-path-performance
    provides: per-tick signal playback architecture the audio anchor reads via .peek()
provides:
  - Locked frame-to-audio truth table (41-FRAME-AUDIO-TRUTH-TABLE.md) — frame identity, audible window, offset/trim/slip math, revision discipline, drift policy, fps-mismatch policy, asset transport, scrub policy
  - RED test suite efxPaintAudioPreview.test.ts encoding every truth-table rule (schema parse, revision guard, resolveTrackPlayback mapping, path-leak guard)
  - Four locked user decisions gating the D-04 one-way boundary: a4-protocol-url, a6-matched-fps, rev-counter, d04-proof-packaged-build
affects: [41-02, 41-03, 41-04, 41-05, audio, efx-paint, csp]

actuals:
  tokens: 7000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - Locked truth-table entry artifact written and test-encoded RED before implementation (roadmap-mandated gate)
    - Closed-key + structured-clone + strict newer-than revision guard for bridge payload sections
    - Blocking decision checkpoint locking one-way security boundary interpretation before transport code exists

key-files:
  created:
    - .planning/phases/41-efx-paint-audio-preview-monitoring-toggle/41-FRAME-AUDIO-TRUTH-TABLE.md
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
  modified:
    - .planning/phases/41-efx-paint-audio-preview-monitoring-toggle/41-RESEARCH.md

key-decisions:
  - "A4 locked as a4-protocol-url: efxasset:// protocol URL (percent-encoded absolute path inside) is the permitted D-04 carrier; zero Rust transport diff; raw filePath/relativePath fields still never cross the bridge"
  - "A6 locked as a6-matched-fps: sync guaranteed at matched playback/project fps (the default); non-default speeds are best-effort monitoring with a status note; no playbackRate scaling or pitch shift ever"
  - "Revision locked as rev-counter: monotonic integer counter owned by the main-side publisher, bumped once per publish, strict newer-than compare"
  - "D-04 proof mode locked as d04-proof-packaged-build: 41-05 must observe the efxasset connect-src fetch failure inside a packaged build BEFORE the CSP grant lands; the contract test is the permanent guard afterwards, not a substitute"

patterns-established:
  - "Truth-table-first gating: entry artifact + RED suite + decision lock before any implementation plan in the phase"
  - "resolveTrackPlayback pure mapping exported engine-free so truth-table math stays synchronously testable"

requirements-completed: [AUDIO-02, AUDIO-03, AUDIO-04]

coverage:
  - id: D1
    description: "Locked frame-to-audio truth table document with all nine sections, worked numeric examples, and DECISIONS LOCKED"
    requirement: AUDIO-03
    verification:
      - kind: automated
        ref: "grep gates on offsetFrame/slipOffset/40ms/efxasset://localhost in 41-FRAME-AUDIO-TRUTH-TABLE.md (plan Task 1 verify)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RED suite efxPaintAudioPreview.test.ts encodes schema parse, revision guard, resolveTrackPlayback mapping, and path-leak guard; fails RED on missing modules"
    requirement: AUDIO-02
    verification:
      - kind: unit
        ref: "pnpm --dir app exec vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts — RED confirmed (module-not-found)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AUDIO-04 idempotency/concurrency edges encoded: same-revision re-application is a no-op; strict newer-than single application funnel"
    requirement: AUDIO-04
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts revision-guard describe block (RED — awaits 41-02/41-03 implementation)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Four D-04-gating decisions user-confirmed and recorded (A4, A6, revision, D-04 proof mode)"
    verification: []
    human_judgment: true
    rationale: "Blocking decision checkpoint — user selections are the verification; recorded in truth table section 9 and RESEARCH open questions"

duration: 10min (across blocking decision checkpoint)
completed: 2026-08-04
status: complete
---

# Phase 41 Plan 01: Truth Table + RED Suite + Decision Lock Summary

**Locked frame-to-audio truth table with 8 worked offset/trim/slip examples, a RED vitest suite encoding every rule (schema, revision guard, mapping, path-leak), and four user-locked decisions gating the D-04 one-way asset-transport boundary**

## Performance

- **Duration:** ~10 min executor time across the blocking decision checkpoint
- **Started:** 2026-08-04T20:43:05Z
- **Completed:** 2026-08-04T20:52:02Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 annotated)

## Accomplishments
- Truth table entry artifact locked: paint appFrame == main-editor global frame (proven via physicPaintBridge.ts:956-961), half-open audible window capped at the Paint playback-range end (not totalFrames), source-offset math mirroring playbackEngine.ts:192-224 verbatim, monotonic revision discipline, 40ms drift threshold with throttled checks, efxasset-only transport, silent scrub
- RED suite `efxPaintAudioPreview.test.ts` (245 lines) fails on module-not-found as designed; every truth-table rule has at least one failing test with concrete numeric expectations taken from the worked examples
- Decision checkpoint resolved all four open questions: `a4-protocol-url`, `a6-matched-fps`, `rev-counter`, `d04-proof-packaged-build` — recorded in truth table section 9 (DECISIONS LOCKED) and 41-RESEARCH.md open questions 1-3 + D-04 proof-mode note

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the locked frame-to-audio truth table document** - `9dd8a577` (docs)
2. **Task 2: RED — truth-table + schema + revision-guard test suite** - `4d7b8b57` (test)
3. **Task 3: Confirm asset-transport interpretation, fps-mismatch policy, revision discipline, and D-04 proof mode** - `46f9d0ba` (docs; decision checkpoint resolved by user, selections recorded)

## Files Created/Modified
- `.planning/phases/41-efx-paint-audio-preview-monitoring-toggle/41-FRAME-AUDIO-TRUTH-TABLE.md` - Locked entry artifact; sections 1-8 the rules, section 9 DECISIONS LOCKED
- `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` - RED suite targeting `parseEfxPaintAudioPreviewSection`, `applyRevisionedEfxPaintAudioPreview`, `resolveTrackPlayback` (implemented by plans 41-02/41-03)
- `.planning/phases/41-efx-paint-audio-preview-monitoring-toggle/41-RESEARCH.md` - Open questions 1-3 annotated RESOLVED with chosen options; D-04 packaged-build proof mode recorded for 41-05

## Decisions Made
- **a4-protocol-url:** the `efxasset://localhost` URL carrying a percent-encoded absolute path is the permitted D-04 carrier — zero Rust transport diff; payloads still never carry raw `filePath`/`relativePath` fields
- **a6-matched-fps:** sync guaranteed at matched fps (the default); non-default playback speeds are best-effort monitoring with a non-blocking status note; no playbackRate scaling, no pitch shift
- **rev-counter:** monotonic integer revision owned by the main-side publisher; total order; strict newer-than compare; bumped exactly once per publish
- **d04-proof-packaged-build:** literal D-04 reading — plan 41-05 must run a packaged build cycle demonstrating the pre-grant `connect-src` efxasset fetch failure BEFORE the grant lands; the config-level contract test remains as the permanent guard afterwards but does not substitute for the packaged proof

## Deviations from Plan

None - plan executed exactly as written. Task 3 was a blocking decision checkpoint; the user resolved all four decisions and execution resumed per the checkpoint resume-signal.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 41-02..41-05 can implement without interpretation: the truth table is the single source of truth, the RED suite pins the module contract (`efxPaintAudioPreviewContext.ts`, `efxPaintAudioMonitor.ts`), and the D-04 boundary interpretation is locked
- **41-05 note:** the CSP `connect-src` grant requires a packaged build proof cycle first (d04-proof-packaged-build) — schedule the packaged build before the grant commit
- RED suite must go green in 41-02/41-03 without modifying the truth-table-derived expectations; divergence is threat T-41-01

## Self-Check: PASSED

- FOUND: .planning/phases/41-efx-paint-audio-preview-monitoring-toggle/41-FRAME-AUDIO-TRUTH-TABLE.md
- FOUND: app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
- FOUND: commit 9dd8a577 (Task 1)
- FOUND: commit 4d7b8b57 (Task 2)
- FOUND: commit 46f9d0ba (Task 3)

---
*Phase: 41-efx-paint-audio-preview-monitoring-toggle*
*Completed: 2026-08-04*
