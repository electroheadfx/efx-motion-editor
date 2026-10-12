---
phase: 48-internal-compositor-and-flattened-parent-result
plan: 06
subsystem: compositor
tags: [compositor, pixel-matrix, native-uat, blend, missing-source, playback, opacity]
---

# Dependency graph
requires:
  - phase: 48-01
    provides: pure compositor core (hide/solo truth table, opacity-before-blend pass, straight-alpha result, missing report) + derived flattened cache key/memo
  - phase: 48-04
    provides: Background step in the composite pass + per-track raster cache + CMP-04 invalidation matrix
  - phase: 48-05
    provides: Studio program monitor (composite base + playback) + missing-source status capsule
provides:
  - Pixel acceptance matrix contract suite (22 recording-context rows over the shared compositor, CMP-06 unit half)
  - Native UAT confirmation of pixel parity Studio/main-preview/export, straight-alpha, parent 25% contract, missing-source surface, playback smoothness, blend/opacity, and paper fond
  - 48-06 UAT fixes: playback range = composite content extent; track-switch buffer reset; hidden-active engine surface; tracks blend among themselves then over the paper (compositor law + isolated montage); missing-source capsule genuine-dangling only; opacity commits on release via a Preact signal
affects: [Phase 49 (Background rows native UAT deferred), Phase 53 (integrated v1.0.0 acceptance)]

# Actuals — pairs with the plan's estimate (45k tokens) to calibrate future estimates.
actuals:
  tokens: 0
  tasks: 2
  commits: 16

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recording-context matrix suite: one test per spec pixel-acceptance row asserting op order / alpha / composite op / cache keys over the shared compositeFrame (pixel truth is native UAT, node cannot run canvas)"
    - "Tracks blend among THEMSELVES first (lowest track establishes the transparent stage with source-over; every track above blends against the accumulated tracks), then the Background and solid fallback composite BENEATH via destination-over — the track blend modes never see the paper"
    - "Isolated montage: a dedicated fond layer draws the paper beneath an isolation: isolate tracks group (engine shell + program monitor); the monitor reads a fond-less flattened variant (includeFond=false, its own fond:0 cache term) so the active track's CSS blend never meets the paper"
    - "Commit-on-release slider: a local @preact/signals signal draft (held in a useRef — no React state) follows the thumb; the value commits on pointerup/keyup/blur, never the native change event (WebKit fires change on EVERY move for range inputs)"

key-files:
  created:
    - app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts
  modified:
    - app/src/efx-paint/compositor/efxPaintCompositor.ts
    - app/src/efx-paint/compositor/efxPaintCompositor.test.ts
    - app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx
    - app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts

key-decisions:
  - "The matrix suite drives compositeFrame through the same recording-context fixture as 48-01 — op-order/alpha/op assertions stand in for pixel truth in node (48-RESEARCH.md Validation Architecture); native UAT compares Studio vs main preview vs export per row group (summarized evidence accepted)"
  - "48-06 UAT-C law: tracks blend among themselves first, then the result is placed over the background/fond — never blended against it. The lowest participating track establishes the transparent stage with source-over (a non-normal blend over transparency would erase it); the Background and solid fallback composite beneath via destination-over"
  - "The active track's blend is CSS mix-blend-mode on the engine shell over the program monitor; the montage isolates the tracks group (isolation: isolate) from a dedicated fond layer, and the monitor reads a fond-less composite, so the active track's blend never meets the paper"
  - "The fond layer generates the paper at the PROJECT resolution (the compositor size authority, wired from projectStore) and CSS-scales to the display bounds — generating at the display or working size changed the paper motif scale"
  - "The missing-source capsule publishes only GENUINE dangling sources (non-empty missingRefs) — a track that merely has no content at the frame (normal end of rail) is absence, not a missing source, and never raises the capsule"
  - "The opacity slider commits on release via a Preact signal draft; the release commit is on pointerup/keyup/blur, NOT the native change event (WebKit fires change on every move for range inputs in the Tauri runtime)"

requirements-completed: [CMP-03, CMP-06]

# Coverage metadata — D1-D4 proven by passing tests; D5-D10 ride the native UAT.
coverage:
  - id: D1
    description: "Every spec pixel acceptance matrix row has a recording-context contract assertion (op order, alpha values, composite ops, cache keys) over the shared compositor (CMP-06 unit half)"
    requirement: CMP-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts#matrix rows 1-21 (22 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The straight-alpha boundary contract holds structurally — the pipeline contains no manual premultiply step and the result record documents straight alpha (D-02, Pitfall 7)"
    requirement: CMP-03
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#documents the straight-alpha boundary and never manually premultiplies (D-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Parent 50% opacity × internal 50% opacity = 25% effective exactly once — the compositor's internal ops and the renderer's parent op never double-apply (CMP-03)"
    requirement: CMP-03
    verification:
      - kind: unit
        ref: "app/src/lib/previewRenderer.test.ts#parent application row (matrix row 20)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tracks blend among themselves first, then over the background/fond — the lowest track establishes the stage with source-over, upper tracks blend against the accumulated tracks, and the Background/solid fallback composite beneath via destination-over (48-06 UAT-C)"
    requirement: CMP-01
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#48-06 UAT-C: track blend modes apply BETWEEN tracks only"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#48-06 UAT-C: the Background and the solid fallback composite BENEATH the tracks via destination-over"
        status: pass
    human_judgment: false
  - id: D5
    description: "The active track's CSS blend never meets the paper — the montage isolates the tracks group from a dedicated fond layer, and the monitor reads a fond-less composite (includeFond=false, fond:0 cache term)"
    requirement: CMP-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts#isolates the tracks group from a dedicated fond layer so the active-track blend never meets the paper (48-06 UAT-C)"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#RED 8c fond-less variant (48-06 UAT-C)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The missing-source capsule publishes only genuine dangling sources (non-empty missingRefs) — empty-coverage frames are absence, not a missing source (48-06 UAT-E)"
    requirement: CMP-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(a) a genuine dangling source publishes the capsule exactly once"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(b) an empty-coverage frame publishes nothing"
        status: pass
    human_judgment: false
  - id: D7
    description: "Playback range is the composite content extent — the max end across every Paint track, never the launch track's alone (48-06 UAT-D)"
    requirement: CMP-01
    verification:
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoLoopClips.test.ts#composite content extent (48-06 UAT-D)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The track opacity slider commits only on release via a Preact signal draft — the release commit is on pointerup/keyup/blur, never the native change event (WebKit fires change on every move for range inputs)"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#commits the track opacity only when the thumb is released (48-06 UAT)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Native UAT — pixel matrix parity (Studio vs main preview vs PNG export), straight-alpha spot check (50% white, no dark halo), parent 25% contract, missing-source surface, playback smoothness, blend/opacity, paper fond"
    verification: []
    human_judgment: true
    rationale: "End-to-end visual behavior on the real Studio window cannot be automated in this environment (no server runs, per CLAUDE.md); the user confirmed each part live during the 48-06 UAT session"
  - id: D10
    description: "Background rows native UAT — DEFERRED to Phase 49 (no UI or debug helper to author Background clips in a live document; the compositor-side resolution is covered by the green matrix suite rows 12-19)"
    verification: []
    human_judgment: true
    rationale: "Background clip authoring is Phase 49 scope; any live issues found in 49 will be corrected within that phase"

# Metrics
duration: 2d
completed: 2026-08-30
status: complete
---

# Phase 48 Plan 06: Pixel Acceptance Matrix Contract Suite + Blocking Native UAT Summary

**The spec pixel acceptance matrix is locked as a recording-context contract suite over the shared compositor, and the blocking native UAT confirmed pixel parity, straight-alpha, the parent 25% contract, the missing-source surface, playback smoothness, blend/opacity, and the paper fond — closing Phase 48**

## Performance

- **Duration:** 2 days (matrix suite committed 2026-08-28; UAT fixes 2026-08-29/30)
- **Started:** 2026-08-28
- **Completed:** 2026-08-30
- **Tasks:** 2
- **Commits:** 16

## Accomplishments

- **Task 1 — pixel acceptance matrix contract suite** (`59f239ab`): `efxPaintCompositorMatrix.test.ts` drives `compositeFrame` through the recording-context fixture with one test per spec matrix row — two opaque normal tracks; semi-transparent upper; multiply/screen/overlay/add; hidden upper; one/multiple soloed; hidden-and-soloed precedence; empty upper frame over lower content; one/multi-image Background loops; finite/infinite repeats; gap over solid/transparent fallback; next-clip interruption after full/partial cycles; parent application at the previewRenderer seam; straight-alpha structural contract. 22 tests, all green.
- **48-06 UAT-C — tracks blend among themselves, then over the paper** (`9d1f5d6e`, `13faf50f`): the compositor now draws the clear working canvas as the tracks stage (the lowest participating track establishes it with source-over; every track above blends against the accumulated tracks), then the Background and solid fallback composite BENEATH via destination-over — a multiply/screen/add track no longer stains the paper. The Studio montage isolates the tracks group (`isolation: isolate`) from a dedicated fond layer, and the program monitor reads a new fond-less flattened variant (`includeFond=false`, its own `fond:0` cache term), so the ACTIVE track's CSS blend also never meets the paper.
- **48-06 UAT-D — playback range is the composite content extent** (`bdace1f7`): `getRotoPhysicalCompositeEndFrame` returns the max end across every Paint track; the cached playback's `getEndFrame` uses it, so a sibling track's longer rail plays in full.
- **48-06 UAT-A/B — track-switch buffer reset + hidden-active engine surface** (`157dfa19`): the 47-01 track-switch effect resets the track-scoped frame-indexed edit buffers on an in-place active-track switch (fixing the ownership rebuild failure that locked the tools); a hidden active track steps the engine canvases aside (`active-track-hidden`) so the monitor owns the remaining tracks + fond.
- **48-06 UAT-E — missing-source capsule genuine-dangling only** (`eee43a65`): the D-09 publication filters to entries with non-empty `missingRefs` — a track that merely has no content at the frame (normal end of rail) is absence, not a missing source, and never raises the capsule; the rare genuine dangling source (severed Hold / deleted source key) still surfaces.
- **Opacity slider — commit on release via a Preact signal** (`fa41fe21`, `534c0bda`): the track opacity slider keeps a local `@preact/signals` signal draft (held in a `useRef`, no React state) so the thumb follows the mouse, and commits the value only on `pointerup`/`keyup`/`blur` — never the native `change` event, which WebKit fires on EVERY move for range inputs in the Tauri runtime.
- **Paper fond motif restored** (`feca1a0a`): the fond layer generates the paper at the PROJECT resolution (the compositor size authority, wired from projectStore) and CSS-scales to the display bounds — generating at the display or working size changed the paper motif scale.

## Task Commits

1. **Task 1: pixel acceptance matrix contract suite** — `59f239ab` (test) — 22 recording-context row tests over the shared compositor
2. **Task 2: native UAT + fixes** — `83aecda3`, `c843b70e`, `694c3754`, `157dfa19`, `bdace1f7`, `eee43a65`, `9d1f5d6e`, `13faf50f`, `10e687d0`, `d271abdf`, `60663c9e`, `feca1a0a`, `fa41fe21`, `534c0bda` (fix/feat) — the UAT issues A-E, blend/opacity, paper, and the opacity slider

## Files Created/Modified

- `app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts` — the 22-row pixel acceptance matrix contract suite
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — UAT-C two-stage law (tracks stage first, Background/fallback beneath via destination-over)
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — `includeFond` cache-key input; `fond:0` term emitted only when false
- `app/src/stores/physicPaintStore.ts` — `includeFond` param on the flattened reads; `getRotoPhysicalCompositeEndFrame`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — playback range wiring; track-switch buffer reset; fondBackground derivation; missing-source handler
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — fond layer + isolated tracks group montage
- `app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx` — fond-less reads; genuine-dangling capsule filter
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — commit-on-release opacity slider (Preact signal draft)
- `app/src/components/physic-paint/physicsPaintStudio.css` — tracks-group isolation, fond layer, active-track-hidden selectors

## Decisions Made

- **Tracks blend among themselves first (UAT-C):** the lowest participating track establishes the transparent stage with source-over (a non-normal blend over transparency would erase it); every track above blends against the accumulated tracks; the Background and solid fallback composite beneath via destination-over. Single law, no option — negligible cost (same draw-op count, single buffer).
- **Isolated montage:** the active track's CSS blend must never meet the paper, so the montage splits the surface — a dedicated fond layer beneath an `isolation: isolate` tracks group (engine shell + monitor), and the monitor reads a fond-less composite.
- **Fond paper at project resolution:** the compositor size authority is the project resolution (wired from projectStore); the fond layer generates the paper there and CSS-scales to the display.
- **Missing-source capsule genuine-dangling only (UAT-E):** empty-coverage frames are absence, not a missing source; the raw flattened report still carries both kinds (pinned store-side), the publication seam filters.
- **Opacity commit on release:** a Preact signal draft follows the thumb; the commit is on pointerup/keyup/blur, never the native change event (WebKit fires change on every move for range inputs).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The active track's CSS blend still met the paper after the compositor law change**
- **Found during:** Task 2 (UAT-C)
- **Issue:** the compositeFrame law fixed the flattened path, but the ACTIVE track in the Studio is drawn by the live engine shell with CSS mix-blend-mode over the program monitor — and that monitor included the paper fond, so the active track's blend still met the paper.
- **Fix:** the montage splits the surface — a dedicated fond layer beneath an isolated tracks group (`isolation: isolate`), and the monitor reads a new fond-less flattened variant (`includeFond=false`, `fond:0` cache term).
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx, app/src/stores/physicPaintStore.ts, app/src/efx-paint/compositor/efxPaintCompositeCache.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/physicsPaintStudio.css
- **Verification:** full suite + typecheck green; PhysicsPaintCanvasMount + store RED 8c tests pin the montage and the fond-less variant.
- **Committed in:** 13faf50f

**2. [Rule 3 - Blocking] The fond layer generated the paper at the wrong size, enlarging the motif**
- **Found during:** Task 2 (UAT)
- **Issue:** the fond layer generated the paper at the display bounds, then at the working resolution — but the flattened composite always generated it at the PROJECT resolution (the compositor size authority, wired from projectStore). Both wrong sizes changed the paper motif scale.
- **Fix:** generate the fond paper at the project resolution (`cachedRotoPlaybackComposition.width/height`) and let `object-fit: fill` stretch it to the display bounds.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
- **Verification:** full suite + typecheck green.
- **Committed in:** feca1a0a

**3. [Rule 3 - Blocking] The opacity slider's commit-on-release used the native change event, which WebKit fires on every move**
- **Found during:** Task 2 (UAT)
- **Issue:** the first commit-on-release implementation committed on the native `change` event, but WebKit (the Tauri runtime) fires `change` on EVERY move for range inputs — so the canvas still recomposited per pixel while dragging.
- **Fix:** the release commit is on `pointerup`/`keyup`/`blur`; the `change` event never commits. The draft is a Preact signal held in a `useRef` (no React state — the user's explicit rule).
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
- **Verification:** full suite + typecheck green; the right-panel test pins onInput-no-commit + onPointerUp-commit.
- **Committed in:** 534c0bda

**4. [Rule 2 - Missing Critical] The missing-source capsule raised false alerts for empty-coverage frames**
- **Found during:** Task 2 (UAT-E)
- **Issue:** the D-09 publication raised "Missing source on N track(s)" for any frame where a track simply had no content (empty missingRefs — a rail ending, a frame past every key), confusing the user at cursor frame ~13.
- **Fix:** the publication filters to entries with non-empty `missingRefs` (genuine dangling sources); empty-coverage frames never raise the capsule. The raw flattened report still carries both kinds (pinned store-side).
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx
- **Verification:** full suite + typecheck green; monitor tests (a)/(b) pin the genuine-dangling publish and the empty-coverage no-publish.
- **Committed in:** eee43a65

---

**Total deviations:** 4 auto-fixed (1 missing critical, 3 blocking)
**Impact on plan:** all auto-fixes were necessary for correctness and plan acceptance; no scope creep.

## Known Stubs

None — no placeholder values, mock data, or unimplemented surfaces were introduced.

## Threat Flags

None — the matrix suite and UAT fixes introduce no new network endpoints, auth paths, file access, or schema changes at trust boundaries. T-48-17 (pixel drift between surfaces) mitigated by the shared-path construction + UAT part 1; T-48-18 (double-premultiplied alpha halos) by the straight-alpha structural contract + UAT part 2; T-48-19 (composite cost at playback rates) by the D-07/D-08 caches + UAT part 6; T-48-SC N/A (zero packages installed).

## Issues Encountered

- The opacity slider's first commit-on-release attempt used `useState`, which the user explicitly rejected ("no React state in this project please, only preact signal") — replaced with a Preact signal held in a `useRef`.
- The fond layer's paper size required two corrections (display size → working resolution → project resolution) before the motif matched the pre-montage scale.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 48 is complete: the pixel acceptance matrix is locked as a contract suite, and the native UAT confirmed pixel parity, straight-alpha, the parent 25% contract, the missing-source surface, playback smoothness, blend/opacity, and the paper fond.
- **Background rows native UAT deferred to Phase 49** — there is no UI or debug helper to author Background clips in a live document (Phase 49 scope); the compositor-side resolution is covered by the green matrix suite rows 12-19. Any live issues found in 49 will be corrected within that phase.
- Phase 49 (Fixed Background Track and Imported Loop Clips) can proceed.

## Self-Check: PASSED

- SUMMARY file exists at `.planning/phases/48-internal-compositor-and-flattened-parent-result/48-06-SUMMARY.md`
- Task commits verified in git log: `59f239ab` (Task 1), `83aecda3`..`534c0bda` (Task 2)
- Roadmap updated: Phase 48 → 6/6, Complete (2026-08-30)

---
*Phase: 48-internal-compositor-and-flattened-parent-result*
*Completed: 2026-08-30*
