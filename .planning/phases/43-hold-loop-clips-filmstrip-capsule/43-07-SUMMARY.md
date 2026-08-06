---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 07
subsystem: timeline-ui
tags: [timeline, canvas-2d, loop-clips, filmstrip-capsule, pure-geometry, frameMap-projection, vitest]

requires:
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 02
    provides: derivePhysicPaintRotoLoopRanges compact interval records + typed resolution contract
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 03
    provides: store loop accessors (getRotoPhysicalLoopClips, capacity) + flagged main-editor parent-end seam
provides:
  - loopCapsuleGeometry.ts — pure capsule geometry: badgeTextForLoop (D-19), zoomBandForFrameWidth (D-16), visible-window ghost-cell grid (D-32), truncationDiagonalFrame (D-21), anchorFlagGeometry (D-22), firstCycleCellFrames, loopCapsuleFrameToX
  - TimelineLoopCapsule compact interval model + FxTrackLayout.loopCapsules (dead playScriptMarkers untouched)
  - frameMap loopCapsules feed — 43-02 derivation read through the store with the main-editor parent-end seam (D-25, closes the 43-03 flag) for both capsule extents and the loop-aware display end frame
  - TimelineRenderer.drawLoopCapsules — thumbnails, ghost cells, hatched band, badge pill, truncation diagonal, anchor flag, and the locked state-paint precedence, canvas-only (D-32)
  - DrawState selected/hovered/focusedLoopClipId inputs (producers land in 43-08)
affects: [43-08, 43-09, 43-10, filmstrip-capsule, hold-loop-clips]

actuals:
  tokens: 16000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure geometry module beside the renderer (loopCapsuleGeometry.ts) in the getPhysicPaintRotoKeyMarkerGeometry style — every capsule metric unit-testable without a canvas; the renderer holds zero boundary math (D-24)"
    - "Main-editor parent-end seam: frameMap derives loop ranges with the FX sequence's AUTHORED span as parentEndExclusive (D-25), while the store derivation stays capacity-bounded for the Studio/preview authority"
    - "First-cycle real-key-backed classification computed once in the frameMap projection (presentation frame ↔ source key identity), so renderer (43-07) and interaction (43-08) never re-derive placement/source semantics"
    - "Draw-spy canvas harness: fake 2D context recording (method, args, paint-state snapshot) per call — behavioral capsule assertions in a node vitest environment"

key-files:
  created:
    - app/src/components/timeline/loopCapsuleGeometry.ts
    - app/src/components/timeline/loopCapsuleGeometry.test.ts
  modified:
    - app/src/types/timeline.ts
    - app/src/lib/frameMap.ts
    - app/src/components/timeline/TimelineRenderer.ts
    - app/src/components/timeline/TimelineRenderer.test.ts

key-decisions:
  - "Main-editor parent end = the FX sequence's authored span (outFrame - inFrame, fallback 100), never the roto-extended outFrame — using the extended value would make an infinity loop's effective end circularly depend on itself (D-25, 43-03 flag)"
  - "The loop-aware display end frame (timeline length + overlay outFrame) uses the same parent-end-aware derivation as the capsule feed — otherwise an infinity loop would extend the FX bar to the 600 capacity while its capsule stops at the sequence end"
  - "First-cycle cell realKeyBacked iff THIS source key is the real key at the presentation frame (keyIdAtFrame equality) — stricter than 'any real key' and exactly the placement/source identity (D-15)"
  - "State paint draws in precedence order idle/hover → diagonal → selected → focus → error so higher states paint over lower ones and the diagonal stays visible under focus/selection (D-23); disabled/stale 55% opacity has no producer yet and lands with 43-08 interaction state"
  - "Zero-effective anchor flag draws the greyed 0f pill INSTEAD of badge/diagonal (the flag carries the marker, D-22); the truncation diagonal is null for zero-effective intervals"

patterns-established:
  - "truncationDiagonalFrame: partial-cycle landing = midpoint of the placement-aligned cell containing the last presented frame (effectiveEnd - 1); complete cycles land exactly on effectiveEnd; low zoom always lands on the band end (D-21)"
  - "visibleGhostCells(interval, windowStart, windowEnd) — O(visible) repetition grid with firstIndex = floor((windowStart - regionStart) / cycleLength) so a cell whose end crosses the window start is included"

requirements-completed: [HOLD-06]

coverage:
  - id: D1
    description: "Badge text locked forms: `Cycle 5f × 5 = 25f`, `Cycle 5f × 1 = 5f`, `Cycle 5f × ∞` — never a numeric or spelled-out infinity suffix (D-19)"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "app/src/components/timeline/loopCapsuleGeometry.test.ts#badgeTextForLoop (3 tests) + TimelineRenderer.test.ts#badge pill + infinity badge draw-spy tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zoom-adaptive repetition rendering: ghost cells ≥16px (LOOP_GHOST_FILL + dashed LOOP_GHOST_BORDER), perforated band 8-15px (LOOP_BAND_BASE + LOOP_BAND_HATCH 45°/4px/1px), band+badge <8px (D-16)"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "loopCapsuleGeometry.test.ts#zoomBandForFrameWidth boundaries at exactly 16px/8px; TimelineRenderer.test.ts#ghost cells/band/low-zoom draw-spy tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "First-cycle thumbnails via ThumbnailCache + drawImage; real-key-backed cells keep the solid border (diamonds via the existing roto-key pass), duplicated-loop first-cycle cells draw shared source thumbnails with the dashed linked border and no diamond (D-15, placement/source correction)"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "TimelineRenderer.test.ts#first-cycle thumbnails + duplicated-loop linked-border draw-spy tests; loopCapsuleGeometry.test.ts#frameMap feed realKeyBacked classification"
        status: pass
    human_judgment: false
  - id: D4
    description: "Truncation diagonal #FFB020 1.5px landing mid-ghost-cell for partial cycles, exactly on the cycle boundary for complete cycles, on the band end at low zoom (D-21)"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "loopCapsuleGeometry.test.ts#truncationDiagonalFrame (5 tests); TimelineRenderer.test.ts#diagonal landing x asserted through loopCapsuleFrameToX at both zooms"
        status: pass
    human_judgment: false
  - id: D5
    description: "Zero-effective loop renders the greyed anchor flag (24px × ~6px, #666666 pill, 0f marker) pinned at placementStart — never invisible (D-22)"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "loopCapsuleGeometry.test.ts#anchorFlagGeometry + zero-effective ghost/diagonal suppression; TimelineRenderer.test.ts#anchor flag draw-spy test"
        status: pass
    human_judgment: false
  - id: D6
    description: "frameMap exposes ONE compact interval model per loop (requested/effective ends, boundary, truncation, unresolved missing-ref list, mode) derived from the 43-02 records through the store; infinity loops bound at the main-editor parent end (D-25/D-32, 43-03 flag); unresolved loops keep the verbatim missing list (D-31)"
    requirement: HOLD-06
    verification:
      - kind: integration
        ref: "loopCapsuleGeometry.test.ts#frameMap loopCapsules feed (7 real-store tests: compact model, duplicated placement, boundary truncation, parent-end seam, unresolved D-31, zero-effective, empty)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Capsule state paint precedence error red > focus ring > selected accent > truncation diagonal > hover raise > idle; states change paint only (D-23); empty timeline renders no capsule and no placeholder (S1 empty)"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "TimelineRenderer.test.ts#error-over-selected ordering, hover/selected/focus paint, and no-loop empty-state draw-spy tests"
        status: pass
    human_judgment: false
  - id: D8
    description: "Visual fidelity of the capsule on the live timeline (thumbnail downscale quality, hatch density, diagonal corner cut, badge legibility at all zoom bands)"
    requirement: HOLD-06
    verification: []
    human_judgment: true
    rationale: "Canvas visual polish is the user's native UAT oracle; queued for 43-10 native UAT per the plan's done criterion"

duration: ~15min
completed: 2026-08-06
status: complete
---

# Phase 43 Plan 07: Filmstrip Capsule Geometry + Renderer Summary

**The main-editor timeline now renders the complete Loop Clip filmstrip capsule — source-cycle thumbnails, zoom-adaptive ghost cells/hatched band, compact math badge, truncation diagonal, and zero-effective anchor flag — as a pure canvas view of the 43-02 resolver derivation, with the main-editor parent-end seam (D-25) closed for both capsule extents and the loop-aware display end frame**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-06T22:15:36Z
- **Completed:** 2026-08-06T22:30:19Z
- **Tasks:** 2
- **Files modified:** 6 (2 new: geometry module + spec)

## Accomplishments

- **`loopCapsuleGeometry.ts` — pure capsule geometry module** (no store/signal imports, `getPhysicPaintRotoKeyMarkerGeometry` style): `badgeTextForLoop` with the three locked D-19 forms (infinity never renders `Infinityf`), `zoomBandForFrameWidth` at the exact 16px/8px D-16 thresholds, `visibleGhostCells` tiling the repetition region (which starts at placementStart + cycleLength, never placementStart) in O(visible cells) — proven duration-independent by a 600-effective-frame window test, `truncationDiagonalFrame` (mid-cell for partial cycles, exact boundary for complete cycles, band end at low zoom, null for zero-effective), `anchorFlagGeometry` (24px × 6px, pinned at placementStart), `firstCycleCellFrames`, and `loopCapsuleFrameToX` mirroring the FX coordinate math.
- **`TimelineLoopCapsule` + frameMap feed (Task 1):** `FxTrackLayout.loopCapsules` carries ONE compact interval model per loop — placementStart, cycleLength, repeat, requested/effective ends, boundary kind/frame, truncated/partialCycle, mode, verbatim unresolved missing-ref list, and per-first-cycle-cell `{ sourceKeyId, sourceAppFrame, dataUrl, realKeyBacked }`. The dead `playScriptMarkers` field is untouched (grep-verified no producer lines). The feed closes the 43-03 flag: frameMap derives the 43-02 ranges with the FX sequence's **authored span** as parentEndExclusive (D-25 dynamic tracking), and the loop-aware display end frame (`getTimelineOverlaySequenceOutFrame` / `getTimelineRequiredFrameCount`) uses the same parent-end-aware derivation so the FX bar and the capsule never disagree.
- **`TimelineRenderer.drawLoopCapsules` (Task 2):** first-cycle cells draw downscaled real-key payload thumbnails via `ThumbnailCache.get` + `drawImage` (placeholder fallback below `MIN_FRAME_WIDTH_FOR_THUMB`); real-key-backed cells keep the solid `rgba(255,255,255,0.22)` border and their diamonds come from the existing roto-key pass, while duplicated-loop first-cycle cells draw the shared source thumbnails with the dashed `LOOP_GHOST_BORDER` and no diamond. Repetitions are zoom-adaptive: ghost cells (`LOOP_GHOST_FILL` + 4/4 dashed border) at high zoom, `LOOP_BAND_BASE` + 45°/4px/1px `LOOP_BAND_HATCH` at default zoom, solid band + badge at low zoom. Badge pill (16px, 8px padding/radius, 4px inset, `rgba(13,13,13,0.85)` / `rgba(255,255,255,0.85)`, `600 10px system-ui`, truncateText under the 18px label minimum), `#FFB020` 1.5px truncation diagonal across the band, D-22 greyed anchor flag, and the locked state-paint precedence (error #FF4444 2px > focus ring accent 2px+2px offset > selected accent 2px > diagonal > hover 1.5px raise > idle 1px) — paint only, never geometry. Zero DOM nodes; only visible cells are computed (D-32).
- **Draw-spy test harness:** a fake 2D context recording (method, args, paint-state snapshot) per call gives real behavioral assertions (drawImage count/positions, fill/stroke styles, dash segments, badge text, diagonal landing x through `loopCapsuleFrameToX`) in the node vitest environment — 13 new renderer specs plus 26 geometry/feed specs.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN per task):

1. **Task 1 (RED): geometry + feed spec** — `e33ac107` (test; 26 failures on the missing module confirmed)
2. **Task 1 (GREEN): geometry module + TimelineLoopCapsule + frameMap feed** — `f7f88df3` (feat)
3. **Task 2 (RED): capsule draw-spy specs** — `7392c748` (test; 13 failures confirmed)
4. **Task 2 (GREEN): drawLoopCapsules painter** — `24afae1f` (feat)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/components/timeline/loopCapsuleGeometry.ts` — pure geometry: badge forms, zoom bands, ghost-cell grid, diagonal landing, anchor flag, first-cycle frames, frame→x conversion
- `app/src/components/timeline/loopCapsuleGeometry.test.ts` — 26-test spec: geometry behaviors + 7 real-store frameMap feed tests (compact model, duplicated placement, real-key boundary truncation, parent-end seam, unresolved D-31, zero-effective, empty)
- `app/src/types/timeline.ts` — `TimelineLoopCapsuleSourceCell` + `TimelineLoopCapsule` types; `FxTrackLayout.loopCapsules` optional field beside `rotoKeyFrames`
- `app/src/lib/frameMap.ts` — `deriveMainEditorLoopRanges` (parent-end seam), parent-end-aware `getPhysicPaintRotoDisplayEndFrame`, `buildTimelineLoopCapsules` projection with realKeyBacked classification
- `app/src/components/timeline/TimelineRenderer.ts` — locked S1 constants, `drawLoopCapsules` painter, `DrawState.selected/hovered/focusedLoopClipId` inputs (43-08 wires the producers)
- `app/src/components/timeline/TimelineRenderer.test.ts` — 13 capsule draw-spy specs + geometry-consumption source contract

## Decisions Made

- **Main-editor parent end = authored sequence span.** `(seq.outFrame ?? 100) - (seq.inFrame ?? 0)`, deliberately never the roto-extended outFrame — that would make an infinity loop's effective end circularly depend on itself. The store's capacity-bounded derivation remains the Studio/preview authority (43-03 scope); the frameMap seam serves main-editor presentation (D-25).
- **The display end frame shares the seam.** `getPhysicPaintRotoDisplayEndFrame` now takes the layer + sequence and derives with the authored span when loops exist (falling back to the store read otherwise) — without this, an infinity loop would stretch the FX bar to the 600 capacity while its capsule stops at the sequence end (Rule 1 coherence fix for the shipped feature).
- **`realKeyBacked` = keyId equality at the presentation frame**, stricter than "any real key" — exactly the placement/source identity; a duplicated loop placed over unrelated real keys still renders linked first-cycle cells (D-15).
- **Precedence implemented by paint order** (idle/hover → diagonal → selected → focus → error): higher states paint over lower ones and the diagonal stays visible under focus/selection, matching "a lower state never hides a higher one" (D-23). The disabled/stale 55% opacity state has no producer in the current model — it lands with 43-08 interaction state (noted in the plan's behavior list; the precedence chain itself is fully implemented).
- **Anchor flag replaces badge+diagonal for zero-effective loops** — the flag alone carries the D-22 marker; `truncationDiagonalFrame` returns null for zero-effective intervals so no amber slice floats on an empty capsule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED feed fixtures used invalid base64 dataUrls**
- **Found during:** Task 1 GREEN (first run — 8 feed tests failing on `malformed real-key record`)
- **Issue:** fixture dataUrl `data:image/png;base64,AAAA${appFrame}` produces a 5-char payload; the model's `isRenderedPngDataUrl` guard requires valid base64 (length % 4)
- **Fix:** per-frame payload via `String(appFrame).padStart(4, 'A')` — valid base64, still distinct per frame
- **Files modified:** `app/src/components/timeline/loopCapsuleGeometry.test.ts`
- **Commit:** `f7f88df3` (part of the GREEN commit)

**2. [Rule 1 - Bug] Ghost-cell visible-window start index off by one**
- **Found during:** Task 1 GREEN (`visibleGhostCells(interval, 12, 22)` dropped the intersecting cell [10,15))
- **Issue:** `Math.ceil` for the first cell index skips the cell whose END crosses the window start
- **Fix:** `firstIndex = Math.max(0, Math.floor((visibleStartFrame - regionStart) / cycleLength))` — boundary-exact (a window starting exactly on a cell boundary still excludes the cell ending there)
- **Files modified:** `app/src/components/timeline/loopCapsuleGeometry.ts`
- **Commit:** `f7f88df3`

**3. [Rule 3 - Blocking] Node harness needed an `Image` stub for ThumbnailCache**
- **Found during:** Task 2 GREEN preparation — unseeded thumbnails make `ThumbnailCache.get` construct `new Image()`, which does not exist in the node vitest environment
- **Fix:** `vi.stubGlobal('Image', …)` in the draw-spy harness (never completes → unseeded cells take the placeholder path, seeded cells draw via the cache map)
- **Files modified:** `app/src/components/timeline/TimelineRenderer.test.ts`
- **Commit:** `24afae1f` (part of the GREEN commit)

**4. [Plan-directed] Test-method placement protected an existing source-slice assertion**
- **Found during:** Task 2 GREEN
- **Issue:** the pre-existing C-04 spec slices the source between `private drawRotoKeyMarkers` and `private drawFxTrack` and asserts `not.toContain('strokeStyle')` — inserting the capsule painter there would break it
- **Fix:** `drawLoopCapsules` placed after `drawFxTrack`; additive toContain slices unaffected
- **Commit:** `24afae1f`

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking, 1 plan-directed)
**Impact on plan:** All auto-fixes necessary for correctness of the specced behavior; no scope creep.

## Issues Encountered

- Harness cwd resets between Bash calls dropped the `app/` working directory; `pnpm --dir app` prefixes used throughout (no functional impact).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **43-08 (interaction/tooltips):** `DrawState.selectedLoopClipId / hoveredLoopClipId / focusedLoopClipId` are the paint inputs to drive; the capsule model already carries `mode`, `boundaryKind`/`boundaryFrame`, `requestedEnd`, and `unresolved.missingSourceKeyIds` for the locked tooltip forms (`Repeat {n} · Source frame {i} of {N}`, `Loop shortened by next clip`, error lists); `firstCycleCells[].realKeyBacked` selects real-key click vs linked-occurrence click behavior.
- **43-09 (preview/export):** the frameMap seam proves the parent-end pattern if preview/export need sequence-end-driven loop ends (the store render path remains capacity-bounded — flagged there since 43-03).
- **43-10 (native UAT):** capsule visual fidelity (thumbnails, hatch, diagonal, badge, anchor flag, states) is queued for the user's native UAT — automated specs prove geometry and paint calls, not pixel polish.

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-07-SUMMARY.md`
- FOUND: `app/src/components/timeline/loopCapsuleGeometry.ts`, `app/src/components/timeline/loopCapsuleGeometry.test.ts`
- FOUND commits: `e33ac107`, `f7f88df3`, `7392c748`, `24afae1f`
- Verify: `pnpm --dir app exec vitest run loopCapsuleGeometry frameMap TimelineRenderer` — 51+ passed; full suite 1378 passed, 0 failed (107 files, 3 skipped); `pnpm --dir app run typecheck` — exit 0
- Acceptance greps: `loopCapsules` present in `types/timeline.ts` and `frameMap.ts`; no `playScriptMarkers` producer in `frameMap.ts`; `clip bloquant` count 0 in TimelineRenderer.ts; `Loop shortened by next clip` absent (tooltip copy owned by 43-08, criterion allows); constants LOOP_BAND_BASE/LOOP_BAND_HATCH/LOOP_GHOST_FILL/LOOP_GHOST_BORDER + `#FFB020` present; no `document.createElement` in the capsule path

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-06*
