---
phase: 41-efx-paint-audio-preview-monitoring-toggle
plan: 02
subsystem: audio
tags: [audio, tracer, bridge, web-audio, efxasset, tauri]

requires:
  - phase: 41-efx-paint-audio-preview-monitoring-toggle (plan 41-01)
    provides: locked frame-to-audio truth table, RED suite efxPaintAudioPreview.test.ts, four locked decisions (a4-protocol-url, a6-matched-fps, rev-counter, d04-proof-packaged-build)
  - phase: 39-efx-paint-scripts-auto-hydration
    provides: revisioned exact-payload launch/session bridge idiom (physicsPaintLaunchContext)
  - phase: 38.1-studio-render-path-performance
    provides: per-tick signal playback architecture; peek()-only reads in playback loops
provides:
  - Revisioned audioPreview section flowing main editor → Rust pass-through → child window on launch (D-01), embedded via conditional spread only when audio tracks exist
  - buildPhysicPaintAudioPreviewSection + monotonic rev-counter publisher in physicPaintBridge.ts — the single builder 41-03 push events reuse for total revision ordering
  - Child-side efxPaintAudioPreviewContext.ts (fail-null parse funnel, strict newer-than revision guard, resolveTrackPlayback truth-table math) and session efxPaintAudioPreviewStore.ts
  - efxPaintAudioMonitor.ts — fetch/decode/play-at-cursor state machine over the shared audioEngine singleton, wired to EFX Paint Play/Stop via useRotoCachedPlayback
  - 41-01 RED suite fully green (31 tests): schema, revision guard, mapping worked examples, path-leak guard, monitor dispatch/warn-skip/stop/seek-restart
affects: [41-03, 41-04, 41-05, audio, efx-paint]

actuals:
  tokens: 11939
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Revisioned optional launch-payload section (audioPreview) following the rotoPhysical closed-key + conditional-spread idiom end to end (types guard → bridge builder → Rust Option<Value> pass-through → child canonical rebuild)
    - Single main-side builder feeding both launch embed and future push events so the rev-counter gives a total order across channels
    - Child monitor as a module-singleton state machine (idle | positioned | playing) over the shared audioEngine singleton — no AudioContext construction in child code
    - Engine-compatible payload entries: EfxPaintAudioPreviewTrack carries the exact timing/gain field names audioEngine.play/playDelayed consume, so trackLike passes through unchanged

key-files:
  created:
    - app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts
    - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
  modified:
    - app/src/types/physicPaint.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src-tauri/src/lib.rs
    - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts

key-decisions:
  - "audioPreview embedded in the launch context only when audioStore.tracks is non-empty — absent section = no audio; keeps audio-less launches byte-stable"
  - "resolveTrackPlayback typed against a Pick of timing/mute fields only — the pure mapping never reads gain/fade fields, keeping the truth-table math minimally coupled"
  - "Launch-integration hydration applies audioPreview through applyRevisionedEfxPaintAudioPreview (strict newer-than), the same funnel 41-03 push events will use"
  - "Monitor start wired inside useRotoCachedPlayback.start() with playbackRangeEnd = last cached appFrame + 1 (D-11 loop window cap), reads via peek() per 38.1-D-01"

patterns-established:
  - "Payload-section plumbing checklist: closed-key guard in types → conditional-spread embed in createPhysicPaintLaunchContext → Option<Value> serde pass-through in Rust → LAUNCH_KEYS + section key sets + canonical rebuild in the child parse funnel"
  - "Monitor tests mock the audioEngine module boundary and global fetch; dispatch assertions use truth-table worked-example numbers verbatim"

requirements-completed: [AUDIO-01, AUDIO-02, AUDIO-06]

coverage:
  - id: D1
    description: "Launch context carries a validated revisioned audioPreview section main→Rust→child; closed-key + type-guard + structured-clone discipline enforced at every layer"
    requirement: AUDIO-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts#parseEfxPaintAudioPreviewSection"
        status: pass
      - kind: automated
        ref: "pnpm --dir app typecheck; cargo check --manifest-path app/src-tauri/Cargo.toml"
        status: pass
    human_judgment: false
  - id: D2
    description: "EFX Paint holds no mutable audio authority — audio modules import nothing from audioStore/timelineStore/playbackEngine; all track data arrives via validated payload"
    requirement: AUDIO-01
    verification:
      - kind: automated
        ref: "grep source assertion over app/src/components/physic-paint/audio/** — no forbidden imports (only doc-comment mentions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Play in EFX Paint fetches/decodes each track via its efxasset:// URL and starts sample-scheduled playback at the mapped cursor (playbackEngine.ts:192-224 math via resolveTrackPlayback)"
    requirement: AUDIO-02
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#efxPaintAudioMonitor (worked-example dispatch numbers for play/playDelayed, range-end cap)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Missing/failed asset fetch warns and skips only that track; remaining tracks still play; playback never throws"
    requirement: AUDIO-06
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#a rejecting fetch for one track warns and skips only that track"
        status: pass
    human_judgment: false
  - id: D5
    description: "Audible sync quality of the monitoring path in the running app (sample alignment at Play, no drift perception)"
    verification: []
    human_judgment: true
    rationale: "Audio sync quality is inherently a native-UAT judgment (phase convention); deferred to the 41-05 packaged-app UAT checkpoint per the plan's verification section"

duration: 15min
completed: 2026-08-04
status: complete
---

# Phase 41 Plan 02: Audio Preview Tracer — Launch Payload + Child Monitor Summary

**One complete monitoring path proven end-to-end in code and tests: the main editor builds a revisioned audioPreview section into the launch payload, Rust passes it through, the child validates/stores it, fetches and decodes track bytes through the efxasset protocol, and plays them at the Paint cursor on Play — with the 41-01 RED suite fully green and the AUDIO-01/D-04 boundaries held by source assertions**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-04T20:56:46Z
- **Completed:** 2026-08-04T21:12:09Z
- **Tasks:** 2
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments
- Payload plumbing through every layer: `EfxPaintAudioPreviewTrack`/`EfxPaintAudioPreviewContext` types + closed-key guards in `types/physicPaint.ts`; `buildPhysicPaintAudioPreviewSection()` with the monotonic rev-counter in `physicPaintBridge.ts`; `PhysicsPaintLaunchContext.audio_preview` (`Option<Value>`, serde rename `audioPreview`) in Rust; `audioPreview` in `LAUNCH_KEYS` with `AUDIO_PREVIEW_KEYS`/`AUDIO_PREVIEW_TRACK_KEYS` closed sets and canonical rebuild in the child parse funnel
- Child audio module trio: `efxPaintAudioPreviewContext.ts` (fail-null parse funnel, strict newer-than revision guard with idempotent same-revision no-op, pure `resolveTrackPlayback` implementing truth-table section 3 verbatim), `efxPaintAudioPreviewStore.ts` (session signal store, soloStore-shaped), `efxPaintAudioMonitor.ts` (idle | positioned | playing state machine over the shared `audioEngine` singleton — no `AudioContext` construction, D-08)
- Play/Stop wiring: `useRotoCachedPlayback.start()` runs prepare-then-playAtCursor over the loop window (playbackRangeEnd = last cached appFrame + 1); `finishPlayback` — the single stop funnel — calls `monitor.stop()`; launch integration hydrates the store through the revision funnel
- AUDIO-06 tolerance: per-track try/catch around fetch+decode; a 404/rejecting fetch logs `console.warn` with the track id and skips only that track
- Tracer feedback gate passed in autonomous mode (full Task 1 verify re-run green) before expansion into Task 2
- Gates: `efxPaintAudioPreview.test.ts` 31/31 green; full app suite 1049 passed / 1 skipped; `tsc --noEmit` clean; `cargo check` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "launch carries audio context" — payload plumbing through every layer** (tracer) - `b99ee5c6` (feat)
2. **Task 2 RED: failing monitor tests** - `bcb78467` (test)
3. **Task 2 GREEN: monitor fetch/decode/play-at-cursor wired to EFX Paint Play** - `3a705abc` (feat)

## Files Created/Modified
- `app/src/types/physicPaint.ts` — audio preview types, guards, launch-context optional clause
- `app/src/lib/physicPaintBridge.ts` — `buildPhysicPaintAudioPreviewSection`, rev-counter, conditional-spread embed
- `app/src-tauri/src/lib.rs` — `audio_preview` pass-through field (+ test constructor update)
- `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts` — key sets, section validation, canonical rebuild
- `app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts` — NEW: parse funnel, revision guard, truth-table mapping
- `app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts` — NEW: session store
- `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts` — NEW: monitor state machine
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` — Play/Stop wiring
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` — store hydration from launch section
- `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` — monitor test block (7 new tests)

## Decisions Made
- Absent `audioPreview` section means no audio — embed is conditional on `audioStore.tracks` being non-empty, keeping audio-less launches byte-stable
- `resolveTrackPlayback` parameter typed as a `Pick` of the timing/mute fields it actually reads — the pure mapping stays minimally coupled and the RED suite's factory needed no edits
- Store hydration runs inside `applySettledLaunchContext` through the strict newer-than funnel — one application point for hydration and (41-03) push events

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired launch-context audioPreview into the preview store via usePhysicsPaintLaunchIntegration**
- **Found during:** Task 2 (wiring step)
- **Issue:** The plan's file list had no seam populating `efxPaintAudioPreviewStore` from the launch context — without it the store stays empty and the tracer's "Play starts monitoring" path cannot fire end-to-end
- **Fix:** Added `applyRevisionedEfxPaintAudioPreview(efxPaintAudioPreviewStore, hydration.context.audioPreview)` in `applySettledLaunchContext` (guarded on section presence), reusing the plan-mandated revision funnel — no new channel, no new discipline
- **Files modified:** `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts`
- **Commit:** `3a705abc`

**2. [Rule 1 - Bug] Corrected a wrong maxPlaySec expectation in my own RED seek-restart test**
- **Found during:** Task 2 GREEN run
- **Issue:** Test expected `(288-120)/24 = 7` but the default fixture track's trim caps effectiveEnd at `min(48+216, 288) = 264`, so the truth-table-correct value is `(264-120)/24 = 6` — the implementation was right, the expectation forgot the trim cap
- **Fix:** Updated the expectation with an explicit effectiveEnd comment; suite green without touching implementation
- **Files modified:** `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts`
- **Commit:** `3a705abc`

**3. [Rule 1 - Bug] Narrowed resolveTrackPlayback parameter to a Pick of consumed fields**
- **Found during:** Task 1 typecheck
- **Issue:** The 41-01 RED factory widens `fadeInCurve`/`fadeOutCurve` to `string`, failing `tsc` against the full track type; the pure mapping never reads gain/fade fields
- **Fix:** Parameter typed `Pick<EfxPaintAudioPreviewTrack, 'offsetFrame' | 'inFrame' | 'outFrame' | 'slipOffset' | 'muted'>` — truth-table expectations untouched
- **Files modified:** `app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts`
- **Commit:** `b99ee5c6`

## Authentication Gates

None.

## Known Stubs

None. Every module is fully wired on the tracer path. Deliberately out-of-scope behaviors owned by later plans (not stubs): push-on-change updates (41-03), the On/Off toggle UI (41-04 — monitoring is unconditionally default-On until then, per the plan), loop-wrap re-seek/drift corrector/scrub-anchor wiring (41-03+), and the CSP `connect-src` grant with packaged-build proof (41-05).

## Threat Flags

None — the child→efxasset fetch surface is already covered by the plan's threat register (T-41-03/T-41-04 mitigations implemented: closed-key schema, path-leak test, main-side-only URL construction).

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 41-03 (push-on-change updates): reuse `buildPhysicPaintAudioPreviewSection()` as the single publish builder so the rev-counter ordering stays total; child application point already exists (`applyRevisionedEfxPaintAudioPreview`); mid-playback updates route through the monitor's seek-restart path (playAtCursor while playing = stopAll + re-dispatch, already tested)
- 41-04 (toggle + ownership): the monitor's idempotent stop/playAtCursor funnel and `positionedAt` anchor are the control surface; the workflow-strip toggle gates the existing unconditional call in `useRotoCachedPlayback.start()`
- 41-05 (CSP proof): `fetch(efxasset://...)` in the child currently requires the `connect-src` grant — run the packaged-build failure proof BEFORE the grant lands (locked d04-proof-packaged-build), then extend `releaseContract.test.ts`
- Native audible confirmation of sync quality remains deferred to the 41-05 packaged-app UAT checkpoint

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts
- FOUND: app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts
- FOUND: app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
- FOUND: commit b99ee5c6 (Task 1)
- FOUND: commit bcb78467 (Task 2 RED)
- FOUND: commit 3a705abc (Task 2 GREEN)
- VERIFIED: `rename = "audioPreview"` present in app/src-tauri/src/lib.rs; `buildPhysicPaintAudioPreviewSection` present in app/src/lib/physicPaintBridge.ts

---
*Phase: 41-efx-paint-audio-preview-monitoring-toggle*
*Completed: 2026-08-04*
