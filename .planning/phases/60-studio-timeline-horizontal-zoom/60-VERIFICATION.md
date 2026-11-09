---
phase: 60-studio-timeline-horizontal-zoom
verified: 2026-11-09T13:56:10Z
status: human_needed
score: 16/18 must-haves verified
covered_files:
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-01-PLAN.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-01-SUMMARY.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-02-PLAN.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-02-SUMMARY.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-03-PLAN.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-03-SUMMARY.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-04-PLAN.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-04-SUMMARY.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-05-PLAN.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-05-SUMMARY.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-06-PLAN.md"
  - ".planning/phases/60-studio-timeline-horizontal-zoom/60-06-SUMMARY.md"
  - "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts"
  - "app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.test.ts"
  - "app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts"
  - "app/src/components/physic-paint/physicsPaintStudio.css"
  - "app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts"
  - "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts"
  - "app/src/components/physic-paint/view/TimelineMotionChannels.tsx"
  - "app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx"
  - "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts"
  - "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts"
  - "app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts"
  - "app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts"
  - "app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts"
  - "app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts"
  - "app/src/components/physic-paint/view/timelineRailDesign.ts"
  - "app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts"
covered_digest: "v4:sha256:09790778d6ff6b46cdf048f21dd50c4f0f56baa7018ecd51320c01535d33aacb"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "Wheel/pinch zoom keeps the frame under the cursor fixed in the real browser layout"
    test: "Cmd/Ctrl+wheel over the timeline at several cursor positions (left, middle, right edge), then trackpad pinch; finish with a plain wheel tick"
    expected: "The frame under the cursor keeps its on-screen x through every zoom step; pinch takes the same path; plain wheel still scrolls horizontally"
    why_human: "Continuous exponential feel, macOS trackpad pinch delivery, and the browser's clamp against the live scrollWidth are not observable in the node/jsdom matrix. The anchored law, the 6px gutter and the CR-02 one-frame deferral are unit-tested, but the live layout is not"
  - truth: "Mandatory CSS scroll-snap does not quantize the anchored fractional scrollLeft"
    test: "Zoom in and out repeatedly over a rail, including near the right edge; watch the playhead/cursor frame after the write settles"
    expected: "No jump to a cell boundary or to the neighbouring frame; the anchored offset survives the snap container (WR-01 / RESEARCH Assumption A2)"
    why_human: "scroll-snap-type: x mandatory is enforced by the real layout engine; the node matrix cannot model a programmatic scrollLeft being re-snapped or the container re-snapping after the pitch-dependent reflow"
human_verification:
  - test: "Cmd/Ctrl+wheel and trackpad pinch zoom over the Studio timeline at several cursor positions; then a plain vertical wheel tick"
    expected: "The frame under the cursor stays fixed through each zoom step, pinch takes the same anchored path, and the plain wheel still scrolls the timeline horizontally"
    why_human: "Live gesture feel and macOS pinch delivery cannot be asserted from jsdom/node; this is the 60-VALIDATION manual-only row for ZOOM-01"
  - test: "Repeated pill and Fit zooms over a rail near the right edge, then let the scroll settle"
    expected: "The playhead/cursor frame does not jump after the write settles; mandatory scroll-snap does not quantize the anchored offset"
    why_human: "The scroll-snap interaction after an anchored zoom is the 60-VALIDATION manual-only row (RESEARCH A2, WR-01); no automated test resolves it"
  - test: "Visual check of the Studio timeline at 25%, 100% and 400% (pill zoom plus Fit)"
    expected: "Non-active row and Bg cells align with the active lane at every level, ruler labels and tick marks sit on the live cell centre, the current-frame marker covers the live cell width, rail/ghost spans cover the same frames, and the pill reads as one control group"
    why_human: "CSS inheritance and visual composition are not visible to the node matrix; the post-plan source fixes (c59b775bf, 65a932045, e37f7e49d) are code-verified but their rendered result is a UAT row"
---

# Phase 60: Studio Timeline Horizontal Zoom Verification Report

**Phase Goal:** Users can change the Studio timeline's frame density from 0.25× to 4× without moving a single vertical dimension, and every frame→pixel consumer reads the same pitch authority.
**Verified:** 2026-11-09T13:56:10Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cmd/Ctrl+wheel zooms frame density; plain vertical wheel still scrolls horizontally; Shift+wheel and horizontally dominant deltas stay native (SC1) | VERIFIED | `PhysicsPaintWorkflowStrip.tsx` modifier branch precedes `if (event.shiftKey) return;`; plain branch is the unchanged `el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1)`; wiring test pins branch order and the single write path; targeted suites green |
| 2 | The frame under the cursor keeps its on-screen x: `(scrollLeft + localX) / pitch` invariant including the 6px gutter, and the anchored write lands after the new pitch commits (CR-02) | VERIFIED | `resolveCursorAnchorLocalX` subtracts `TIMELINE_LANE_ORIGIN_PX`; `resolveAnchoredScrollLeft` tested at the gutter; `commitAnchoredScroll` defers through rAF; named test "defers the anchored write so it is never clamped against the pre-zoom width (CR-02)" passes |
| 3 | The live wheel/pinch gesture keeps the cursor frame fixed in the real browser layout | PRESENT_BEHAVIOR_UNVERIFIED | Law, wiring and CR-02 ordering are automated; live pinch delivery, exponential feel and scrollWidth clamping are not exercisable in node — see Human Verification item 1 |
| 4 | Mandatory scroll-snap does not quantize the anchored fractional offset (WR-01 / RESEARCH A2) | PRESENT_BEHAVIOR_UNVERIFIED | `scroll-snap-type: x mandatory` (`physicsPaintStudio.css:5111`) is unmodelled by the stub port; no test resolves the re-snap — see Human Verification item 2 |
| 5 | The header pill offers minus / integer percent / plus / Fit; percent is a non-interactive span; minus/plus disable at 0.25 and 4 (SC2) | VERIFIED | `PhysicsPaintTimelineZoomBar.tsx` prop-less leaf; percent span has no onClick and no button role; `isAtMin`/`isAtMax` with epsilon; wiring test pins host and display-only percent |
| 6 | Presets are `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`; 100% equals the base 18px pitch; stepping from 1.37 goes to 1.5 up / 1 down; the wheel never snaps to a preset; Fit is one-shot and clamps into range (SC2) | VERIFIED | Ladder constant exactly as locked; `nextTimelineZoomPreset` never rounds current first; `nextTimelineZoomWheelScale` clamps without snapping; Fit button has no `aria-pressed` and store `fit()` is one-shot; unit tests pin all rows |
| 7 | Pill and Fit anchor on the playhead centre, fall back to viewport centre when offscreen, and clamp the write at 0 (SC2) | VERIFIED | `resolvePlayheadAnchorLocalX` with `centre >= 0 && centre <= width` fallback to `width / 2`; `applyScale`/`anchoredTarget` clamp at `Math.max(0, …)`; unit tests cover zoomIn, zoomOut, offscreen fallback and Fit clamp |
| 8 | The five-level matrix holds at 0.25 / 0.5 / 1 / 2 / 4 across playhead, ruler ticks, hit-testing, drag, scrub, selection, paste, sound stains, scroll-to-frame and rail geometry (SC3) | VERIFIED | `PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` — 73 tests green, incl. playhead 52.25/99.5/194/383/761, 72px drag -> 16/8/4/2/1 frames, scrub parity, loop-clip 13/26/52/104/208, audio range and the 13 owned edge probes; hit-test round-trip via `frameToPx`/`pxToFrame`; no self-oracle |
| 9 | Row, lane and cell heights stay fixed at every level; `TimelineMetrics` carries exactly `scale`, `cellWidth`, `cellGap`, `pitch`; base height tokens are unchanged (SC4) | VERIFIED | `TimelineMetrics` has four horizontal fields only; unit test asserts no key matches height/row/lane/header/band; CSS vertical tokens untouched (row 30, cell 22, motion lane/cell 18); the only removed CSS value was the horizontal `flex: 0 0 54px` tick basis |
| 10 | No frame→pixel consumer multiplies a local `18`; the audit is non-vacuous; the ruler-scrub cell width is required; the allowlist is exactly the two owners (SC4/SC5, 60-05) | VERIFIED | `timelineZoomAuthorityAudit.test.ts` — 13 tests green with seeded positive samples, minimum scan count and named-consumer existence; allowlist exactly `physicsPaintTimelineZoom.ts` + `timelineRailDesign.ts`; `usePhysicsPaintRulerScrub.ts:54` requires `cellWidthPx`; repo grep finds one comment mention of `18`, no code |
| 11 | Zoom is session-only: reset on Studio open, no document / `.mce` / schema / revision / cache / export surface, and no Preact context provider (SC5) | VERIFIED | Authority imports only `@preact/signals` and `timelineRailDesign`; mount effect calls `timelineZoom.resetForStudioOpen()` before registering the port; no `createContext` in the authority, strip or pill; wiring test pins the reset seam |
| 12 | Every pointer-driven projection divides by the live pitch; handlers read with `.peek()`; the cross-track port receives the scaled pitch once with no zoom multiplier | VERIFIED | Event-time sites use `timelineZoom.metrics.peek().pitch`; render-time consumers read `timelineMetrics`; cross-track receives `framePitch` and no zoom; prior pitch² defect does not reproduce; cross-track suite green |
| 13 | Every drag ghost and preview sizes from the live pitch | VERIFIED | Background ghost, group ghost, push ghosts, rail-set ghost and current-frame outline read `timelineMetrics.pitch`/`cellWidth`; matrix rows pin ghost spans at all five levels |
| 14 | Sound stains, edge handles, duplicate ghost and live preview place/size from the live pitch | VERIFIED | Sound leaf bodies read the live pitch (strip 2486/2565/2610 region); sound-stain matrix rows green |
| 15 | The registered viewport getter and the audio Fit-to-view range divide by the live pitch | VERIFIED | Port getter divides by `timelineZoom.metrics.peek().pitch`; visible range tested at 100/pitch .. 300/pitch; audio visible-range matrix rows green |
| 16 | Open-frame and reveal positioning read the live pitch without re-running on scale change; rail widths subtract the scaled gap (52 / 13 / 208 at 1× / 0.25× / 4×) | VERIFIED | Positioning effects `peek` the pitch with unchanged dependency arrays; `frameGap` threaded through both rails into `projectPhysicsPaintLoopClipGeometry`; loop-clip presentation tests and matrix rows pin 52/208/13 |
| 17 | Track rows and motion lanes consume required pitch/gap props; 2×/4× geometry holds; non-active rows and Bg cells take the live cell width; motion key drag divides by the lane pitch (60-04 + UI-REVIEW blocker fix) | VERIFIED | Required (non-optional) props in `PhysicsPaintTrackRow.tsx`, `TimelineMotionChannels.tsx`, `TimelineMotionKeyDrag.tsx`; cells grid `repeat(n, pitch)`; post-plan `c59b775bf` sets `--timeline-cell-width` on the row cells grid (line 1163) and `65a932045`/scroller publication at strip line 6324; motion-surface contract + matrix green |
| 18 | At scale 1 the timeline is byte-identical (3-frame ruler step, 54px tick, playhead left `6 + frame×18 + 8`); metrics at all eight presets are pitch 4.5/9/13.5/18/27/36/54/72 with `cellWidth + cellGap = pitch`; an epsilon-sized wheel tick writes nothing | VERIFIED | Unit tests pin the eight-preset table and the 1× pin; strip comment and matrix pin the 194px frame-10 playhead; `setScaleSignal`/`applyScale` compare-then-write inside `TIMELINE_ZOOM_EPSILON`; wiring/matrix store rows green |

**Score:** 16/18 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts` | The single session-only pitch authority | VERIFIED | Substantive (393 lines), exports the ladder, clamp, metrics, ruler step, anchoring, fit, viewport frames, percent, store and reset; imported by the strip, pill, rows, lanes, rails and tests |
| `app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx` | Prop-less pill leaf | VERIFIED | Renders minus/percent/plus/Fit; reads signal `.value` in render; wired in the strip header |
| `app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts` | Unit proof of module math and store | VERIFIED | 28 tests green, incl. the named CR-02 deferral row |
| `app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts` | Source contract for reset, wheel branch, pill, percent | VERIFIED | 21 tests green |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | Wheel path, port, converted consumers | VERIFIED | Modifier branch first, rAF coalescer with cancel-on-cleanup, register/unregister on mount/unmount, one render-body metrics read, all consumers converted |
| `app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts` | Pins single pitch application | VERIFIED | Green in targeted run |
| `app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts` | Required `cellWidthPx`, no default | VERIFIED | Line 54 requires the option; no `DEFAULT_CELL_WIDTH_PX` |
| `app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts` | Zero-literal audit + consumer proof, non-vacuous | VERIFIED | 13 tests green; seeded positive samples; allowlist exactly two owners |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | `frameGap` threaded to rail width | VERIFIED | Optional gap parameter defaults to the base token for external callers; strip supplies the scaled gap |
| `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` | `frameGap` into both width call sites | VERIFIED | Optional prop forwarded; required by callers in the strip |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | `frameGap` into loop geometry | VERIFIED | Optional prop forwarded |
| `app/src/components/physic-paint/view/timelineRailDesign.ts` | Base tokens + pitch-aware outline rect | VERIFIED | Tokens unchanged; `resolveMotionBlockOutlineRect` accepts pitch/gap with token defaults |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` | Required lane pitch/gap drive width, cells, keys, curve, outline | VERIFIED | Required props; geometry converted; tests green |
| `app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx` | Drag projection reads the lane pitch | VERIFIED | Reads `latestRef.current.laneProps.framePitch`; no new subscription |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | Required pitch/gap; row consumers converted | VERIFIED | Required props; grid repeat(n, pitch); post-plan `--timeline-cell-width` at line 1163; no `ROW_CELL_WIDTH_PX` |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` | Five-level acceptance matrix | VERIFIED | 73 tests green; five levels, gesture rows, store rows, edge probes |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Horizontal-only scaling; live half-cell ruler offsets; marker width inline | VERIFIED | Ruler label/tick `calc(var(--timeline-cell-width, 16px) / 2)` at 5182/5190; marker rule has no fixed width; cells `width: var(--timeline-cell-width, 16px)` |

Note: `PhysicsPaintTrackRow.test.tsx` is modified by the phase but is not collected by this project's vitest configuration (which collects `.test.ts` only, as documented in `60-VALIDATION.md`). Track-row coverage rests on `timelineMotionSurface.contract.test.ts` and the zoom matrix.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Strip wheel listener | `timelineZoom.setScaleAtCursor` | modifier branch -> rAF coalescer -> one store call | WIRED | Modifier branch precedes the shift guard; `preventDefault` applied; queue cancels on unmount |
| `setScaleAtCursor` | Scroller `scrollLeft` | `resolveCursorAnchorLocalX` -> `resolveAnchoredScrollLeft` -> deferred `commitAnchoredScroll` -> port | WIRED | CR-02 fix defers the write one frame; named test passes |
| `timelineZoom.metrics` | Strip render body | `timelineZoom.metrics.value` -> lane extent, cells grid, `--timeline-cell-width`, ruler tick basis, playhead | WIRED | One render-body read at strip 3095; all consumers derive from it |
| `PhysicsPaintTimelineZoomBar` | Same single write path | `zoomIn` / `zoomOut` / `fit` | WIRED | Store actions use the same `applyScale` path |
| Pointer `clientX` | Frame delta | `timelineZoom.metrics.peek().pitch` -> projection -> clamp | WIRED | Event-time sites use `.peek()`; cross-track receives the scaled pitch and no zoom |
| `timelineMetrics.pitch/cellGap` | Row and motion-lane geometry | `PhysicsPaintTrackRow` / `TimelineMotionChannels` required props | WIRED | Strip passes the live values to both non-active rows, the active motion block and both rails |
| `frameGap` | Rail width | `projectPhysicsPaintLoopClipGeometry` -> `projectTimelineRailLineWidth` | WIRED | Scaled gap reaches every rail-width call |
| Viewport getter | Audio Fit-to-view range | registered port -> `resolveTimelineViewportFrames` division by live pitch | WIRED | Getter divides by `timelineZoom.metrics.peek().pitch` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `physicsPaintTimelineZoom.ts` | `scaleSignal` | user wheel/pill/Fit input through the store actions | Yes — real signal, computed metrics | FLOWING |
| `PhysicsPaintWorkflowStrip.tsx` | `timelineMetrics` | `timelineZoom.metrics.value` (computed from `scaleSignal`) | Yes — feeds lane width, grid columns, ruler, playhead, ghosts, rows | FLOWING |
| `PhysicsPaintTimelineZoomBar.tsx` | `timelineZoom.percent.value`, `isAtMin/isAtMax` | live computed signals | Yes — real zoom level, not a literal | FLOWING |
| Scroll port write | deferred `scrollLeft` | anchored law on live scroll position and pitch | Yes — writes the real scroller, coalesced per frame | FLOWING |
| `PhysicsPaintTrackRow.tsx` | `--timeline-cell-width` | `framePitch - frameGap` from the strip | Yes — live cell width, not a fallback literal | FLOWING |

No static-return, hardcoded-empty or mock source was found in the production path; helper-signature defaults (`TIMELINE_GEOMETRY.cellPitch`, optional `frameGap`) serve external render callers and test harnesses, while the strip always supplies the live values.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase authority, wiring, audit, five-level matrix and all converted consumer suites | `./node_modules/.bin/vitest run <4 core + 7 consumer .test.ts files>` | 11 files passed, 492 tests passed, 1.67s | PASS |
| CR-02: the anchored write is never clamped against the pre-zoom width | named test inside `physicsPaintTimelineZoom.test.ts` | passes (write absent in the same task, 194 after flush) | PASS |
| Zero local pitch literals audit is non-vacuous | `timelineZoomAuthorityAudit.test.ts` | 13 tests pass, seeded positive samples prove the rules bite | PASS |
| Full suite and typecheck at HEAD | reported by the orchestrator | 8402 tests / 407 files green; typecheck clean — not re-run here to keep verification fast | PASS (supplied evidence) |

### Probe Execution

SKIPPED — Phase 60 declares no probes and the repository has no `scripts/*/tests/probe-*.sh` for this phase; it is not a migration or CLI/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ZOOM-01 | 60-01, 60-02, 60-03, 60-06 | Cmd/Ctrl+wheel zooms frame density keeping the frame under the cursor fixed | SATISFIED | Wheel path, anchored law with the 6px gutter, CR-02 deferral, unit + matrix tests; live feel and snap settle are UAT rows |
| ZOOM-02 | 60-01, 60-06 | Pill minus/percent/plus/Fit; locked presets; 100% = 18px; playhead anchoring with viewport-centre fallback; Fit clamps | SATISFIED | Pill leaf, ladder, anchor tests, one-shot Fit, disabled ends |
| ZOOM-03 | 60-01, 60-04, 60-06 | Row, lane and cell heights fixed; only horizontal density scales | SATISFIED | Four-field metrics, unchanged height tokens, CSS diff horizontal-only |
| ZOOM-04 | 60-01 | Session-only; resets on Studio close/open; no document, schema, persistence or export change | SATISFIED | Reset seam on mount, module isolation, no persistence references |
| ZOOM-05 | 60-01..60-06 | Every frame→pixel consumer reads one pitch authority; no local `× 18` | SATISFIED | All consumers converted and audited; audit allowlist exactly two; one comment mention remains, no code literal |

No orphaned requirements: all five IDs are claimed across the six plans and appear as Complete in `REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`, `FIXME` or `XXX` markers in phase-modified files; no skipped tests; no self-oracle assertions; no empty render stubs | — | None |
| `PhysicsPaintWorkflowStrip.tsx` | ~3982, ~4066, ~4154 | Three pointer projections omit the 6px content gutter (WR-02) | Warning (open, pre-existing origin) | Projects a frame biased by `6 / pitch`; the phase made the sites pitch-aware but did not change their origin. Not a pitch-authority violation; recorded open in `60-REVIEW-DISPOSITION.md`. Candidate follow-up: route through `pxToFrame` |
| `physicsPaintStudio.css` | 5111 | `scroll-snap-type: x mandatory` may quantize anchored writes (WR-01) | Warning (open, live behavior) | Routed to human verification item 2 |
| `PhysicsPaintWorkflowStrip.tsx` | ~1187 | Playhead centres on `pitch / 2 - 1` while the ruler centres on half the live cell (IN-01) | Info (open) | Up to ~3px divergence at 4×; calibration only, recorded in the review disposition |
| `PhysicsPaintWorkflowStrip.tsx` | ~831 | Ruler tick row overhangs when `frameCount % step !== 0` (IN-02) | Info (open, pre-existing) | Scales with zoom; recorded open |
| `physicsPaintAudioController.ts` | 64 | Stale `ROTO_CELL_WIDTH_PX` in a port doc comment (IN-03) | Info (open) | Documentation only |
| `physicsPaintTimelineZoom.ts` | 142-164 | `frameToPx`, `pxToFrame`, `resolveTimelineViewportFrames` have no production consumer (IN-04) | Info (open) | `pxToFrame` is the correct helper for WR-02 |

Post-plan changes verified against the goal (not treated as gaps):

- `c59b775bf` — `PhysicsPaintTrackRow.tsx:1163` now sets `--timeline-cell-width` on the row cells grid; the UI-REVIEW blocker (non-active cells staying 16px) is closed in source.
- `65a932045` — ruler label and tick use `calc(var(--timeline-cell-width, 16px) / 2)` (`physicsPaintStudio.css:5182,5190`); the scroller publishes the live value at strip line 6324.
- `e37f7e49d` — CR-01: current-frame marker width is inline `timelineMetrics.cellWidth` (strip 6054) and the CSS fixed width is gone; CR-02: `commitAnchoredScroll` defers the write one frame, with a named regression test.
- `cf4f37ff7`, `172133ebb`, `c9f73b2f1`, `c877eece9` — validation, UI review, code review and disposition records; consistent with the code inspected.

### Human Verification Required

#### 1. Wheel / pinch zoom feel and cursor anchoring

**Test:** Cmd/Ctrl+wheel over the timeline at several cursor positions (left, middle, right edge), then trackpad pinch; finish with a plain wheel tick.
**Expected:** The frame under the cursor keeps its on-screen x through each zoom step; pinch takes the same anchored path; plain wheel still scrolls horizontally.
**Why human:** Continuous exponential feel, macOS pinch delivery and the live `scrollWidth` clamp cannot be asserted from jsdom/node; this is the `60-VALIDATION.md` manual-only row for ZOOM-01.

#### 2. Scroll-snap settle after an anchored zoom

**Test:** Zoom in and out repeatedly over a rail, including near the right edge, and let the scroll settle.
**Expected:** The playhead/cursor frame does not jump to a cell boundary or neighbouring frame (WR-01 / RESEARCH Assumption A2).
**Why human:** `scroll-snap-type: x mandatory` lives in the real layout engine; the node matrix cannot model re-snapping of a programmatic `scrollLeft` or the post-reflow snap.

#### 3. Visual check at 25%, 100% and 400%

**Test:** Use pill zoom and Fit at the three levels on tracks with keys, a Background clip, sound stains and a loop clip.
**Expected:** Non-active row and Bg cells align with the active lane, ruler labels and ticks sit on the live cell centre, the current-frame marker covers the live cell width, rail/ghost spans cover the same frames, and the pill reads as one control group.
**Why human:** CSS inheritance and visual composition are invisible to the node matrix; the three source fixes above are code-verified but their rendered result is a UAT row.

### Gaps Summary

No must-have truth FAILED, no required artifact is missing or a stub, and no key link is broken. The phase goal is achieved in the codebase: one session-only pitch authority (`physicsPaintTimelineZoom.ts`) drives the lane extent, cells grid, adaptive ruler, playhead, both rail families, motion lanes, track rows, Background clips, sound leaves, scrub, cross-track drag, scroll-to-frame, Fit and the audio visible range; the vertical tokens and heights are untouched. ZOOM-01..05 all have implementation evidence and a green targeted suite (492 tests across 11 files).

The remaining items are not code gaps. Two truths are behavior-dependent on the live layout (wheel/pinch anchoring and scroll-snap settle) and are routed to human verification, alongside the visual UAT row; this is why the status is `human_needed`, not `passed`. The open review findings (WR-01, WR-02, IN-01..04) are recorded in `60-REVIEW-DISPOSITION.md`; WR-02 is a pre-existing content-origin bias in three projections, not a violation of the pitch-authority contract, and WR-01 is the snap behavior already routed to UAT.

### Decision Coverage

The phase decision set was checked: 14/14 decisions honored, `blocking: false` (exit 0). No deferred items were identified against Phase 61/62, whose goals (vector painting, painted-stroke curve editing) do not address the open zoom warnings.

---

_Verified: 2026-11-09T13:56:10Z_
_Verifier: Claude (gsd-verifier)_
