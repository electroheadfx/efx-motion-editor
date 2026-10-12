---
phase: 48-internal-compositor-and-flattened-parent-result
plan: 05
subsystem: ui
tags: [preact, signals, compositor, flattened-composite, canvas-stack, status-capsule, missing-source]

# Dependency graph
requires:
  - phase: 48-03
    provides: getFlattenedFrame flattened delivery seam (EfxPaintFlattenedFrameRecord with cacheKey + missing report, pending-decode null)
  - phase: 48-04
    provides: excludeTrackIds compositor port and the deriveEfxPaintFlattenedCacheKey excl: key term
provides:
  - PhysicsPaintProgramMonitor narrow leaf canvas presenting the flattened composite (editing base active-track-excluded; playback full including)
  - getFlattenedFrameExcluding(layerId, frame, excludeTrackIds) store variant with byte-identical including path
  - Studio playback availability re-sourced from the flattened path (CMP-01)
  - Onion-over-composite z-order pin (monitor < engine < onion) + active-track raw-frame ghost source assertion (D-06)
  - Missing-source status-capsule publication (error status + fixed English copy), compare-then-write in both directions (D-09)
affects: [48-06 UAT, main-editor preview/export parity]

# Actuals (#2632) — pairs with the plan's estimate (70k tokens) to calibrate future estimates.
actuals:
  tokens: 15372
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Narrow leaf canvas (program monitor): concrete-value props, store version clocks read only in the component's own effects, per-tick playback signal passed as a signal reference (38.1-D-01 live surface)"
    - "Compare-then-write publication law for the status capsule — a steady missing state fires exactly once, a cleared state restores exactly once (idempotent setter law, no render-body writes)"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx
    - app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/stores/physicPaintStore.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
    - app/src/efx-paint/compositor/efxPaintCompositor.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts

key-decisions:
  - "The program monitor consumes the SAME shared flattened seam as main preview and export (CMP-01, Pitfall 8) — its only math is 'which frame do I show'; no second composition path exists in the Studio"
  - "Editing base excludes the active track via getFlattenedFrameExcluding (the exclude set threads through the compositor ports, never by rewriting the document); playback draws the full including composite"
  - "The monitor subscribes to BOTH physicPaintVersion and efxPaintVersion — the plan named only physicPaintVersion, but document-only mutations (addTrack, setActiveTrackId, registerDocument) bump only efxPaintVersion; both clocks are required so hide/solo/blend edits AND document changes reflect promptly"
  - "During playback currentFrame is constant (38.1-D-01), so the monitor resolves the playing frame through the per-tick playbackTick signal reference read in its own render body — the literal getFlattenedFrame(layerId, currentFrame) instruction would freeze playback"
  - "The missing-source capsule publish reads the FULL including path (not excluding) so an active-track Hold source missing is still reported; gated on !isPlaying (currentFrame constant during playback → no per-tick publish storms)"
  - "When the program monitor is present, the legacy playback-background and PhysicsPaintRotoPlaybackImage slots are suppressed — the flattened composite already carries the paper and every participating track, so they would double-draw"

patterns-established:
  - "Narrow leaf canvas subscribes to store version clocks in its own effects only; per-tick playback state crosses as a signal reference, never a Studio-root .value read"
  - "Compare-then-write publication: missing capsule publishes `${frame}:${missingCount}:${firstTrackId}`; cleared publishes a sentinel; both compare-then-write against the last published key"

requirements-completed: [CMP-01, CMP-05]

# Coverage metadata (#1602) — D1-D4 are proven by passing tests and auto-pass; D5 rides the 48-06 UAT.
coverage:
  - id: D1
    description: "The Studio canvas shows the flattened composite — the program monitor — in both editing (active track excluded) and playback (full including), exactly what the main editor shows (CMP-01, D-05)"
    requirement: CMP-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(a) playback mode draws the full flattened frame for the current frame"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(b) editing mode draws the active-track-excluded composite"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(e) a hidden active track is excluded from the editing base"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#getFlattenedFrameExcluding omits excluded track pixels and uses its own excl: key term"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts#keeps CanvasStack identity semantic and passes the program monitor its real inputs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Studio playback availability derives from the flattened path so the program monitor and playback transport never diverge from the frames the main editor would paint (CMP-01)"
    requirement: CMP-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#Physics Paint Studio loop placeholder contract (D-28, flattened-sourced)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Onion skinning ghosts the ACTIVE track's raw previous/next frames on top of the composite (D-06); z-order pinned as monitor < engine < onion"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(d) onion ghosts stay above the monitor and source the active track raw frames"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#Physics Paint canonical Group authority boundary (43.2-17, D-05/D-38) — getRenderSource active-track assertion"
        status: pass
    human_judgment: false
  - id: D4
    description: "Missing-source report surfaces through the status capsule with error status + fixed English copy, compare-then-write in both directions (D-09, CMP-05)"
    requirement: CMP-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(a) a missing report publishes the error capsule exactly once"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(b) a repeated identical missing report does not re-publish"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts#(c) a cleared report restores the idle capsule exactly once"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live Studio UAT — detaching a Hold source shows the missing-source capsule (red warning triangle) and resolving it clears it; onion ghosts still render over the composite when enabled; no stripe placeholder in the flattened content"
    verification: []
    human_judgment: true
    rationale: "End-to-end visual behavior on the real Studio window cannot be automated in this environment (no server runs, per CLAUDE.md); the plan's embedded human checks ride the 48-06 UAT"

# Metrics
duration: 20min
completed: 2026-08-28
status: complete
---

# Phase 48 Plan 05: Program Monitor Leaf Canvas, Onion Pinning, and Missing-Source Capsule Summary

**The Studio canvas switched to a program-monitor leaf that presents the flattened composite (active track excluded while editing, full during playback) with onion ghosts pinned above and missing sources surfaced through the status capsule**

## Performance

- **Duration:** 20 min (Task 1 committed 13:46 +0200, Task 2 committed 13:54 +0200, plus Task 1's pre-commit execution)
- **Started:** 2026-08-28
- **Completed:** 2026-08-28
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- `PhysicsPaintProgramMonitor` leaf canvas draws the shared flattened composite (CMP-01): editing base via `getFlattenedFrameExcluding` (active track excluded — the engine canvas above supplies its live pixels, so semi-transparent strokes never double-draw, T-48-16), playback via the full `getFlattenedFrame` including the active track. The draw is compare-then-draw idempotent (same cacheKey twice draws once) and a pending decode keeps the last drawn frame (no flicker-to-blank).
- Playback-frame resolution through the 38.1-D-01 per-tick `playbackTick` signal reference — the monitor reads it in its own render body, so `currentFrame`'s constancy during playback never freezes the shown frame.
- The monitor subscribes to BOTH store version clocks in its own effects (never the Studio root render body), so hide/solo/opacity/blend edits (physicPaintVersion) AND document mutations (efxPaintVersion) both re-resolve the composite promptly.
- Studio playback availability re-sourced from the flattened path (`getFlattenedFrame(rotoPlaybackLayerId, appFrame)`) so the monitor and playback transport never diverge from what the main editor would paint (CMP-01; the D-28 placeholder contract test was updated to the flattened source).
- Onion ghosts stay on top (D-06): the `projectRotoOnionPreviewFrames` projection still sources the ACTIVE track's raw frames via `getRotoPhysicalRenderSource(launchContext.layerId, trackIdOfLaunch(launchContext), appFrame)` — never the flattened path — and the canvas stack z-order is pinned monitor (z-0) < engine canvases (z-2/z-4) < onion overlay (z-5).
- Missing-source capsule publication (D-09): a second narrow effect reads the current frame's FULL flattened missing report and publishes `setApplyStatus('error')` + the fixed English copy ('Missing source on N track(s) — first: <track name or id>') through the Studio handler; compare-then-write in both directions (`${frame}:${missingCount}:${firstTrackId}` or the cleared sentinel) so a steady missing state fires exactly once and a cleared state restores exactly once. Pending decode leaves the capsule unchanged (unknown, not cleared).
- Legacy playback-background + `PhysicsPaintRotoPlaybackImage` slots are suppressed while the program monitor is mounted — the flattened composite already carries paper + all participating tracks, so keeping them would double-draw.

## Task Commits

Each task was committed atomically:

1. **Task 1: program monitor leaf canvas + playback availability re-source** — `d0e5af53` (feat) — `PhysicsPaintProgramMonitor`, `getFlattenedFrameExcluding` store variant, `excl:` cache-key term, canvasStack/View/CSS wiring, D-28 + PhysicsPaintCanvasMount contract updates, 5 monitor tests + 2 store tests
2. **Task 2: onion-over-composite pinning + missing-source capsule publication** — `60b56342` (feat) — capsule publication effect (compare-then-write both directions), Studio handler mapping summary → error status + fixed copy, 4 monitor tests (publish once / no re-publish / idle restore once / onion + z-order pin)

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx` — the narrow leaf canvas (draw effect + missing-source publication effect); exported `PhysicsPaintProgramMonitor` and `EfxPaintProgramMonitorMissingSummary`
- `app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts` — 9 tests (5 draw-path + 4 Task 2) over the PreactHookRuntime + flattened recording-canvas harness
- `app/src/stores/physicPaintStore.ts` — `_resolveFlattenedFrame(layerId, frame, excludeTrackIds)` + `EMPTY_EXCLUDED_TRACKS`; `getFlattenedFrame` and new `getFlattenedFrameExcluding` both delegate to it
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — `excludeTrackIds` cache-key input; `excl:` term emitted only when non-empty (including keys stay byte-identical)
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — `excludeTrackIds` port filters the participating set
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — playback availability memo re-sourced to `getFlattenedFrame`; canvasStack memo now carries the program monitor config (+ real-input deps) and the D-09 capsule handler `handleProgramMonitorMissingChange`
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — program monitor mounted below the engine canvas; legacy playback slots suppressed while present
- `app/src/components/physic-paint/physicsPaintStudio.css` — `.physics-paint-program-monitor` z-0 / pointer-events-none rules
- `app/src/stores/physicPaintStore.test.ts` — 2 getFlattenedFrameExcluding tests (exclusion + byte-identical empty-set)
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — D-28 placeholder contract updated to the flattened source
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts` — CanvasStack identity contract updated to the program monitor's real inputs

## Decisions Made

- **Single flattened seam (CMP-01):** the monitor consumes `getFlattenedFrame`/`getFlattenedFrameExcluding` only — same path main preview and export use; no Studio-side composition.
- **Dual version clocks:** the monitor's effects read both `physicPaintVersion.value` and `efxPaintVersion.value` because document-only mutations bump only the latter; the plan named only physicPaintVersion.
- **Playback frame via tick signal:** `currentFrame` is constant during playback, so the leaf resolves the playing frame through the per-tick `playbackTick` signal reference (38.1-D-01).
- **Full-path capsule read:** the missing-source effect uses the including path so active-track Hold sources are reported, gated on `!isPlaying` to prevent per-tick storms.
- **Idempotent publication:** capsule publish is compare-then-write in both directions against the last published key; pending decode leaves the capsule unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The monitor subscribes to BOTH physicPaintVersion and efxPaintVersion**
- **Found during:** Task 1 (reactivity-clock design)
- **Issue:** the plan named only `physicPaintVersion` as the monitor's subscription clock, but document-only mutations (addTrack, setActiveTrackId, registerDocument, row-click active-track switch) bump ONLY `efxPaintVersion` — a monitor subscribed only to physicPaintVersion would not reflect track add/switch, breaking the D-05 "hide/solo/opacity/blend edits immediately reflected" acceptance.
- **Fix:** the draw and capsule effects both list `physicPaintVersion.value` AND `efxPaintVersion.value` in their dep arrays; the canvasStack memo also re-resolves on `efxPaintVersion.value`.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts
- **Verification:** full suite + typecheck green; the PhysicsPaintCanvasMount contract test asserts both clocks.
- **Committed in:** d0e5af53

**2. [Rule 3 - Blocking] Playback frame resolved through the per-tick playbackTick signal, not currentFrame**
- **Found during:** Task 1 (playback-frame design)
- **Issue:** `currentFrame` is constant during playback (38.1-D-01), so the plan's literal "during playback the program monitor presents getFlattenedFrame(layerId, currentFrame)" would freeze the shown frame at the launch frame while the transport advanced.
- **Fix:** the leaf reads `props.playbackTick?.value?.appFrame` in its own render body and draws that resolved frame when `isPlaying`; falls back to `currentFrame` when idle or no tick has fired.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx
- **Verification:** monitor test (a) asserts the full flattened frame for the playing frame; full suite green.
- **Committed in:** d0e5af53

**3. [Rule 2 - Missing Critical] Legacy playback slots suppressed while the program monitor is mounted**
- **Found during:** Task 1 (stack wiring)
- **Issue:** the plan replaced the canvas content with the flattened composite but did not explicitly retire the legacy playback-background and `PhysicsPaintRotoPlaybackImage` slots; left in place they would draw the paper + track rasters AGAIN over the composite (double-draw).
- **Fix:** both slots are gated on `!props.programMonitor` in PhysicsPaintStudioView.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
- **Verification:** full suite green (the View source contract test asserts the suppression).
- **Committed in:** d0e5af53

**4. [Rule 3 - Blocking] Existing contract tests updated for the plan-driven dep re-source**
- **Found during:** Task 1 verify
- **Issue:** the canvasStack memo now depends on `launchContext?.layerId`, `currentFrame`, `isPlaying`, `efxPaintVersion.value` (the program monitor config's real inputs), and the playback availability memo switched from `getRotoPhysicalRenderSource` to `getFlattenedFrame` — the existing PhysicsPaintCanvasMount.test.ts "keeps CanvasStack identity semantic" and PhysicsPaintStudio.test.ts D-28 placeholder-contract tests asserted the OLD deps/source.
- **Fix:** PhysicsPaintCanvasMount.test.ts now asserts the new program-monitor inputs and reduced invalidators `['startFrame', 'rotoNavigationGeneration']`; PhysicsPaintStudio.test.ts D-28 was renamed "flattened-sourced" and asserts `getFlattenedFrame` + the flattened `return [{ appFrame, frame: record.renderedFrame }]` while the legacy resolver names are absent.
- **Files modified:** app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- **Verification:** full suite green.
- **Committed in:** d0e5af53

**5. [Rule 3 - Blocking] Monitor runtime tests require the PreactHookRuntime mock of preact/hooks**
- **Found during:** Task 1 (first monitor test run)
- **Issue:** the component's useRef/useEffect/useMemo resolved to the REAL preact/hooks, which threw `TypeError: Cannot read properties of undefined (reading '__H')` outside a component tree.
- **Fix:** the test file mocks `preact/hooks` routing `useState/useRef/useMemo/useCallback/useEffect` to a hoisted `PreactHookRuntime` (the established PhysicsPaintCanvasMount.runtime.test.ts pattern).
- **Files modified:** app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts
- **Verification:** monitor test file green (9 tests).
- **Committed in:** d0e5af53

---

**Total deviations:** 5 auto-fixed (2 missing critical, 3 blocking)
**Impact on plan:** all auto-fixes were necessary for correctness and plan acceptance; no scope creep. The dual-clock and playback-frame fixes are plan interpretations documented in code comments and tests.

## Known Stubs

None — no placeholder values, mock data, or unimplemented surfaces were introduced.

## Threat Flags

None — the monitor and capsule introduce no new network endpoints, auth paths, file access, or schema changes at trust boundaries. T-48-14 (reactivity feedback loop) is mitigated by the compare-then-draw/compare-then-write laws with tests (b)/(c); T-48-15 (pixel divergence) by the single-seam consumption; T-48-16 (double-draw) by the active-track exclusion (test b); T-48-SC N/A (zero packages installed).

## Issues Encountered

- The capsule sentinel constant was initially written with an embedded NUL byte (from an editor artifact) — replaced with the plain `'__cleared__'` sentinel before commit; no functional impact.
- `existsSync` imported but unused in the monitor test produced a TS6133 typecheck error — removed before the Task 2 commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Studio canvas presents the flattened composite in editing and playback (CMP-01), onion ghosts remain the active track's raw frames on top (D-06), and missing sources surface idempotently through the status capsule (D-09) — all D-05/D-06/D-09 automated gates green.
- The plan's embedded human checks (detach a Hold source → capsule shows the red warning triangle with the missing-source message; resolve → clears; onion ghosts render over the composite) ride the 48-06 UAT (D5).
- 48-06 can proceed: only the final Studio-wide UAT against the real window remains for this phase.

## Self-Check: PASSED

- SUMMARY file exists at `.planning/phases/48-internal-compositor-and-flattened-parent-result/48-05-SUMMARY.md`
- Task commits verified in git log: `d0e5af53` (Task 1), `60b56342` (Task 2)

---
*Phase: 48-internal-compositor-and-flattened-parent-result*
*Completed: 2026-08-28*
