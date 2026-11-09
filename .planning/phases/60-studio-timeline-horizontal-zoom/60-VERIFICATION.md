---
phase: 60-studio-timeline-horizontal-zoom
verified: 2026-11-09T20:19:28Z
status: passed
score: 20/20 must-haves verified
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
  - "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.ts"
  - "app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.test.ts"
  - "app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts"
  - "app/src/components/physic-paint/physicsPaintStudio.css"
  - "app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts"
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
covered_digest: "v4:sha256:e1d8ed02a4e94b48c4dc39dbd3d0154caf3883c38931b9346cdb00526713ca66"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 20/20
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 60: Studio Timeline Horizontal Zoom Verification Report

**Phase Goal:** Users can change the Studio timeline's frame density from 0.25× to 4× without moving a single vertical dimension, and every frame→pixel consumer reads the same pitch authority.
**Verified:** 2026-11-09T20:19:28Z
**Status:** passed
**Re-verification:** Yes — fresh pass over the current tree at HEAD `d2fafa5e5`. The prior report (`2026-11-09T17:02:37Z`, passed, 20/20) had a stale covered-input fingerprint because `app/src/components/physic-paint/physicsPaintStudio.css` changed afterwards in `9f6b0c9e3` ("seat paint cursors on the rail-edit chain"). That commit adds a single 12-line `.physics-paint-picker-visor-seat` rule — the full diff contains no timeline, ruler, cell-width or zoom selector, so none of the phase's must-haves change. Every truth was still re-checked against the current code; the focused phase suites are green on this tree and the typecheck is clean.

Contract note (unchanged): the post-plan, UAT-approved changes are authoritative — the fourth pill control is a one-shot **100% reset** (Fit removed; `REQUIREMENTS.md` ZOOM-02 updated) and zoom is **remembered per paint layer** across Studio reopens (ZOOM-04 updated). ROADMAP success criteria 2 and 5 still carry the pre-change wording ("Fit", "session-only: resets when the Studio closes"); that is stale documentation, recorded as an Info item below, not a code gap.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cmd/Ctrl+wheel (and the trackpad pinch that arrives as a ctrlKey wheel) zooms frame density; plain vertical wheel still scrolls horizontally; Shift+wheel and horizontally dominant deltas stay native (SC1/ZOOM-01) | ✓ VERIFIED | `PhysicsPaintWorkflowStrip.tsx` 5521-5534: the modifier branch is the first guard after the mounted check, with `preventDefault()` + `queueTimelineZoom()` + `return`; the three plain-wheel statements remain byte-identical and in order (`if (event.shiftKey) return;` → diagonal guard → `el.scrollLeft += …`). Wiring test pins both orders; UAT row 1 passed |
| 2 | The frame under the cursor keeps its on-screen x: `(scrollLeft + localX) / pitch` invariant including the 6px gutter, and CR-02's write lands after the new pitch commits | ✓ VERIFIED | `resolveCursorAnchorLocalX(clientX, scrollerLeft)` subtracts `TIMELINE_LANE_ORIGIN_PX`; `resolveAnchoredScrollLeft`; `commitAnchoredScroll` defers through one rAF (`physicsPaintTimelineZoom.ts` 322-350); named test "defers the anchored write so it is never clamped against the pre-zoom width (CR-02)" passes |
| 3 | The live wheel/pinch gesture keeps the cursor frame fixed in the real browser layout | ✓ VERIFIED | Previously `PRESENT_BEHAVIOR_UNVERIFIED`; now directly observed — UAT row 1 (wheel + pinch at several cursor positions, plain wheel still scrolls) passed 2026-11-09. No zoom behavior file changed after the UAT recording except `e88a33204` (test pins, dead-code removal, LRU policy, dash clamp), which the prior report reviewed as behavior-neutral for rows 1-5 |
| 4 | Mandatory scroll-snap does not quantize the anchored fractional offset (WR-01 / RESEARCH A2) | ✓ VERIFIED | Previously `PRESENT_BEHAVIOR_UNVERIFIED`; now directly observed — UAT row 2 (repeated pill/reset zooms near the right edge, no jump after settle) passed 2026-11-09 |
| 5 | The header pill offers minus / integer percent / plus / one-shot 100%-reset (square-dimensions icon); percent is a non-interactive span; minus/plus disable at 0.25× and 4× (SC2/ZOOM-02, updated contract) | ✓ VERIFIED | `PhysicsPaintTimelineZoomBar.tsx` is a prop-less leaf reading exactly `percent`, `isAtMin`, `isAtMax`; percent `<span>` has no onClick; fourth control `title="Show timeline at 100% zoom"` with `<SquareDimensions size={14}/>` and `resetTo100()`, no `aria-pressed`; wiring test pins all of it; UAT row 4 passed |
| 6 | Presets are `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`; 100% equals the base 18px pitch; stepping from 1.37 goes 1.5 up / 1 down; the wheel never snaps; the 100% reset is one-shot, epsilon no-op at 1, and never a live re-fit | ✓ VERIFIED | `TIMELINE_ZOOM_PRESETS` exactly as locked; `nextTimelineZoomPreset` never rounds current first (tests: 1.37 → 1.5 / 1); `nextTimelineZoomWheelScale` is exponential without snapping; `resetTo100()` returns early within `TIMELINE_ZOOM_EPSILON` of 1 |
| 7 | Pill and 100% reset anchor on the playhead centre, fall back to the viewport centre when the playhead is offscreen, and clamp the write at 0 | ✓ VERIFIED | `resolvePlayheadAnchorLocalX` (centre = `frame·pitch + pitch/2 − 1 − scroll`, fallback `width/2`); `anchoredTarget` clamps `Math.max(0, …)`; unit tests cover zoomIn, zoomOut, offscreen fallback, reset anchor and no-port no-op |
| 8 | The five-level matrix holds at 0.25 / 0.5 / 1 / 2 / 4 across playhead, ruler ticks, hit-testing, drag, scrub, selection, paste, sound stains, scroll-to-frame and rail geometry (SC3/ZOOM-05) | ✓ VERIFIED | `PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` — 73 tests green on this tree with a literal table (pitch 4.5/9/18/36/72; playhead frame 10 at 52.25/99.5/194/383/761; loop clip 13/26/52/104/208; scroll-to-frame 302.25/754.5/1659/3468/7086 and its `(frame+1)·pitch` guard); 13 owned edge probes |
| 9 | Row, lane and cell heights stay fixed at every level; `TimelineMetrics` carries exactly `scale`, `cellWidth`, `cellGap`, `pitch`; no vertical token changed (SC4/ZOOM-03) | ✓ VERIFIED | `TimelineMetrics` has four horizontal fields (`physicsPaintTimelineZoom.ts` 44-49); matrix asserts no key matches `height|row|lane|header|band|top|bottom`; tokens still rowHeight 30 / cellHeight 22 / motion cellHeight 18 / laneHeight 18 / headerClusterWidth 160 / postBlockGap 2; the only CSS change since the prior pass is the additive picker-visor seat rule with no timeline selector; UAT row 3 visual at 25/100/400 passed |
| 10 | No frame→pixel consumer multiplies a local `18`; the audit is non-vacuous; the ruler-scrub cell width is required; the allowlist is exactly the two owners (SC4/SC5, 60-05) | ✓ VERIFIED | `timelineZoomAuthorityAudit.test.ts` — allowlist exactly `view/physicsPaintTimelineZoom.ts` + `view/timelineRailDesign.ts` (`PERMITTED_FILES.size === 2`); 12 named consumers; scans ≥25 sources; each rule seeded with a positive sample and a comment-only negative; `usePhysicsPaintRulerScrub.ts` requires `cellWidthPx`; audit green |
| 11 | Zoom never enters the document, `.mce`, schema, revision, cache or exporter output; no Preact context; the mount seam resets/restores before registering the port | ✓ VERIFIED | Repo-wide grep finds no `timelineZoom` / `--timeline-cell-width` / `efx-timeline-zoom` reference outside `components/physic-paint`; no `createContext` in the authority, pill or strip; mount effect calls `resetForStudioOpen(props.layerId ?? null)` before `registerTimelineZoomScrollPort(...)` and unregisters on cleanup (strip 2775-2787); security T-60-04 covers the localStorage key |
| 12 | Zoom is a UI preference only: remembered per paint layer across Studio reopens (the window is destroyed on close), LRU-capped, degrading safely when storage throws (SC5/ZOOM-04, updated contract) | ✓ VERIFIED | `physicsPaintTimelineZoom.ts` — key `efx-timeline-zoom-by-layer`, `MAX_REMEMBERED_LAYERS = 64`, `rememberScale` deletes then re-inserts (recency), read/write both inside try/catch, values finite + clamped; `resetForStudioOpen` restores before adopting the layer id; unit tests cover LRU eviction and storage failure; UAT row 5 passed |
| 13 | Every pointer-driven projection divides by the live pitch; handlers read with `.peek()`; the cross-track port receives the scaled pitch once with no zoom multiplier | ✓ VERIFIED | Event-time sites use `timelineZoom.metrics.peek().pitch` (strip 2740, 3674, 3824, 4066, 4085, 4154, 4161, 4224, 4266, 4346, 4649, 5069, 5095); render consumers read one `timelineZoom.metrics.value` (3092) with narrow leaf reads in the playhead bar and sound leaves; strip passes `framePitch: timelineZoom.metrics.peek().pitch` with `zoom` omitted (3983); cross-track test pins the doubled-pitch insertion frame; no pointer handler subscribes to the zoom signal |
| 14 | Every drag ghost and preview, the current-frame marker and the in-between dash size from the live pitch/cell width (CR-01, IN-07 fixes included) | ✓ VERIFIED | Background/group/push/rail-set ghosts read live `pitch`/`cellWidth`; current-frame marker sets inline `width: ${timelineMetrics.cellWidth}px` with fixed 22px height (CSS rule has no width); interp dash `left: 50%; translateX(-50%); width: min(75% cell, cell − 2px)`; wiring test pins the marker, dash and scroller publication |
| 15 | Sound stains, edge handles, duplicate ghost and live preview place/size from the live pitch; the registered viewport getter and the audio visible range divide by the live pitch | ✓ VERIFIED | Sound leaf bodies read `timelineZoom.metrics.value.pitch` (strip 2486, 2565, 2610); port `getScrollLeft/getScrollerLeft/getClientWidth`; viewport getter divides by `timelineZoom.metrics.peek().pitch` (strip 2736-2745) and is consumed by `getTimelineViewport: () => getTimelineViewportFrames()`; audio range rows at 100/pitch .. 300/pitch in the matrix |
| 16 | Open-frame and reveal positioning read the live pitch without re-running on scale change; rail widths subtract the scaled gap (52 / 13 / 208 at 1× / 0.25× / 4×) | ✓ VERIFIED | Open effect peeks the pitch at 5069 with deps `[props.timelineOpenFrame, props.rotoPhysicalCells.length, updateScrollbar]`; reveal effect peeks at 5095 with deps `[props.revealRequest?.nonce, updateScrollbar]`; `frameGap` threaded through both rails into `projectPhysicsPaintLoopClipGeometry`; loop-presentation and matrix rows pin 52/208/13 and the adjacency gap |
| 17 | Track rows and motion lanes consume required pitch/gap props; 2×/4× geometry holds; non-active rows and Bg cells take the live cell width; motion key drag divides by the lane pitch | ✓ VERIFIED | Required (non-optional) `framePitch`/`frameGap` in `PhysicsPaintTrackRow.tsx` (3 × `readonly framePitch: number;`, 2 × `readonly frameGap: number;`), `TimelineMotionChannels.tsx` lane props; row harness (45 tests via the `.test.tsx.test.ts` launcher) pins railAt(36,4) → left 72 / width 140, railAt(72,8) → 144/280, grid 36px, `--timeline-cell-width` 32px; motion tests pin lane width `frameCount·pitch`, key `frame·pitch + (cellWidth − keySize)/2`, curve `cellPitch: framePitch`; key drag reads `laneProps.framePitch` |
| 18 | At scale 1 the timeline is byte-identical (3-frame ruler step, 54px tick, playhead `6 + frame×18 + 8`); metrics at all eight presets keep `cellWidth + cellGap = pitch`; an epsilon-sized wheel tick writes nothing | ✓ VERIFIED | Unit tests pin the eight-preset table and the 194px frame-10 playhead; `setScaleSignal`/`applyScale` compare-then-write inside `TIMELINE_ZOOM_EPSILON`; wiring test pins the unchanged plain-wheel statements and the one render-body metrics read |
| 19 | The ruler step is adaptive (smallest multiple of 3 whose tick spans ≥40px, never below 3, only coarsens), every drawn tick stays labelled, and the label/tick centre on the live half-cell | ✓ VERIFIED | `resolveRulerStep` unit + matrix rows (step 9/6/3/3/3, extent 40.5/54/54/108/216); `buildRulerTicks` filters `frame % step === 0`; CSS `.physics-paint-ruler-label` and `.physics-paint-ruler-tick::after` use `left: calc(var(--timeline-cell-width, 16px) / 2)`; the fixed `flex: 0 0 54px` basis is gone |
| 20 | The wheel coalescer accumulates from the queued target, writes once per animation frame, and is discarded on reset/unregister and cancelled on unmount | ✓ VERIFIED | `pendingWheelZoomRef.current?.scale ?? timelineZoom.scale.peek()`; `wheelZoomRafRef` single-flight guard; `flushTimelineZoom` calls `setScaleAtCursor`; cleanup cancels the rAF and nulls the pending job (strip 5536-5543); `discardPendingScroll()` on `resetForStudioOpen` and on port unregister; behavioral unit test "discards a queued anchored write when the Studio resets" passes |

**Score:** 20/20 truths verified (0 present, behavior-unverified)

### Prohibitions (must NOT)

| # | Prohibition | Status | Evidence |
|---|-------------|--------|----------|
| 1 | MUST NOT persist the zoom scale into the document, `.mce`, schema, revision, cache key or exporter output | ✓ VERIFIED | No zoom reference under outside `components/physic-paint`; only the localStorage UI-preference key, explicitly allowed by updated ZOOM-04 and security T-60-04 |
| 2 | MUST NOT scale vertical geometry (row/lane/cell height, header width, ruler band, 6px gutter) | ✓ VERIFIED | Tokens unchanged; matrix vertical block; TrackRow/MotionChannels height usage fixed; the only CSS change since the prior pass is the unrelated additive picker-visor seat rule; UAT row 3 |
| 3 | MUST NOT use a CSS transform to scale the timeline | ✓ VERIFIED | No timeline/ruler transform rule; the only `scale()` occurrences are the unrelated resizer hover and the pre-existing rail-edit chain |
| 4 | MUST NOT change plain-wheel scrolling, Shift+wheel or horizontally dominant panning | ✓ VERIFIED | Three statements byte-identical and ordered; wiring test |
| 5 | MUST NOT snap wheel zoom to a preset or round the percent before stepping | ✓ VERIFIED | `nextTimelineZoomWheelScale` never snaps; `nextTimelineZoomPreset` steps from the raw value (1.37 → 1.5 / 1) |
| 6 | MUST NOT turn the fourth pill control into a live re-fit mode, or make the percent interactive | ✓ VERIFIED | `resetTo100()` one-shot, no `aria-pressed`, no resize listener; percent plain span (UAT row 4) |
| 7 | MUST NOT add a Preact context provider for the authority | ✓ VERIFIED | No `createContext` in authority, pill or strip |
| 8 | MUST NOT widen the audit allowlist beyond the two owners, relax the audit, or default the ruler-scrub cell width | ✓ VERIFIED | Allowlist exactly two files (`PERMITTED_FILES.size === 2` asserted); rules assert seeded positives and comment-only negatives; `cellWidthPx` required, `DEFAULT_CELL_WIDTH_PX` deleted |
| 9 | MUST NOT add the zoom scale to the open-frame/reveal effect deps | ✓ VERIFIED | Both dep arrays are zoom-free and explicitly documented as peeks |
| 10 | MUST NOT give `framePitch`/`frameGap` a default in the three pitch components, nor pass both scaled pitch and a zoom to cross-track | ✓ VERIFIED | Required props in the three components; strip passes scaled pitch with `zoom` omitted; audit + cross-track tests |
| 11 | MUST NOT leave a fixed 2px rail gap once the pitch is scaled, nor read `TIMELINE_MOTION.cellWidth` as the drawn motion cell | ✓ VERIFIED | Motion cell width `framePitch − frameGap`; rail gap scaled and tested at 52/208/13 |
| 12 | MUST NOT subscribe to the zoom signal from a pointer handler | ✓ VERIFIED | Event-time reads are `.peek()`; wiring test pins peek usages |
| 13 | Test-hygiene prohibitions: no looser tolerance than a pinned value, no implementation-as-oracle, no warn-only audit, port unregistered after tests | ✓ VERIFIED | Matrix uses literal pinned values and `toBe`/`toBeCloseTo` on documented figures; audit fails closed; tests restore the port |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts` | The single session-only pitch authority | ✓ VERIFIED | 458 lines; ladder, clamp, metrics, ruler step, cursor/playhead anchoring, deferred write, percent, per-layer memory, store, scroll port; imported by the strip, pill, rows and tests |
| `app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx` | Prop-less pill leaf | ✓ VERIFIED | minus / percent / plus / 100%-reset with the square-dimensions icon; reads only the three display signals; hosted once in the strip header |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | Wheel path, port, converted consumers | ✓ VERIFIED | Modifier branch first; rAF coalescer with cancel-on-cleanup; reset → register → unregister seam; one render-body metrics read; 5 `framePitch` + 5 `frameGap` render sites; live-pitch ghost/preview/open/reveal/audio paths |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Horizontal-only scaling; live half-cell ruler offsets; marker width inline | ✓ VERIFIED | Pill modifier rule; adaptive tick basis (fixed flex removed); label/tick half-cell centring; cell `width: var(--timeline-cell-width, 16px)` with `height: 22px`; dash centred + clamped; marker rule has no width; the 9f6b0c9e3 addition is the unrelated `.physics-paint-picker-visor-seat` rule |
| `app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts` | Required `cellWidthPx`, no default | ✓ VERIFIED | `readonly cellWidthPx: number;`; `frameAt = floor((clientX − rectLeft) / cellWidthPx)`; no fallback constant |
| `app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.ts` | Optional `zoom`, required `framePitch`, applied once | ✓ VERIFIED | `computeInsertionFrame(pointerX, scrollLeft, zoom, framePitch)`; strip supplies scaled pitch and no zoom |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | Required pitch/gap; row consumers converted | ✓ VERIFIED | 3× required `framePitch`, 2× `frameGap`; grid `repeat(n, pitch)`; `--timeline-cell-width = framePitch − frameGap`; rail left/width, clip cells, insertion preview, motion-block margin all live |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` | Required lane pitch/gap drive width, cells, keys, curve, outline | ✓ VERIFIED | `laneWidth = frameCount × framePitch`; `cellWidth = framePitch − frameGap`; key/cell left and outline pitch; curve `cellPitch: framePitch` |
| `app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx` | Drag projection reads the lane pitch | ✓ VERIFIED | `latestRef.current.laneProps.framePitch`; drop ghost uses live pitch/gap; no subscription |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | `frameGap` threaded to rail width | ✓ VERIFIED | Optional gap parameter (token default for external callers); strip supplies the scaled gap |
| `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` | `frameGap` into both width call sites | ✓ VERIFIED | Optional prop forwarded at 2 sites; strip passes live gap |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | `frameGap` into loop geometry | ✓ VERIFIED | Optional prop forwarded |
| `app/src/components/physic-paint/view/timelineRailDesign.ts` | Base tokens + pitch-aware outline rect | ✓ VERIFIED | Tokens unchanged; `resolveMotionBlockOutlineRect` accepts pitch/gap with token defaults; width = `frameCount·cellPitch − cellGap − outlineWidth` |
| `app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts` | Unit proof of module math, anchoring, reset, LRU memory | ✓ VERIFIED | Green incl. named CR-02 deferral, discard-on-reset, UAT reset-anchor and LRU recency rows |
| `app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts` | Source contract for reset, wheel branch, coalescer, pill, CSS split | ✓ VERIFIED | Green |
| `app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts` | Zero-literal audit + named consumer proof, non-vacuous | ✓ VERIFIED | Green; allowlist exactly two owners; seeded positive/negative rules; 12 named consumers |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` | Five-level acceptance matrix | ✓ VERIFIED | 73 tests green; literal table; vertical-token block; interaction rows; 13 owned edge probes |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` | Track-row pitch pin (via launcher) | ✓ VERIFIED | Collected through `PhysicsPaintTrackRow.test.tsx.test.ts` (45 tests green) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Strip wheel listener | `timelineZoom.setScaleAtCursor` | modifier branch → rAF coalescer → one store call | WIRED | Modifier branch precedes the shift and diagonal guards; `preventDefault`; cancel on unmount |
| `setScaleAtCursor` / `resetTo100` / `stepPreset` | Scroller `scrollLeft` | `resolveCursorAnchorLocalX` / `resolvePlayheadAnchorLocalX` → `resolveAnchoredScrollLeft` → deferred `commitAnchoredScroll` → port | WIRED | One deferred write path; newest target wins; discarded on reset/unregister |
| `timelineZoom.metrics` | Strip render body | one `timelineZoom.metrics.value` read → lane extent, cells grid, `--timeline-cell-width`, adaptive ruler, playhead | WIRED | Single render read at strip 3092; wiring test pins the count |
| `PhysicsPaintTimelineZoomBar` | Same store | `zoomIn` / `zoomOut` / `resetTo100` | WIRED | Bar only calls store actions; no local scale state |
| Pointer `clientX` | Frame delta | `timelineZoom.metrics.peek().pitch` → projection → clamp | WIRED | Event-time peeks; cross-track gets the scaled pitch once |
| `timelineMetrics.pitch/cellGap` | Row and motion-lane geometry | `PhysicsPaintTrackRow` / `TimelineMotionChannels` required props | WIRED | 5 pitch + 5 gap render sites in the strip |
| `frameGap` | Rail width | `projectPhysicsPaintLoopClipGeometry` → `projectTimelineRailLineWidth` | WIRED | Scaled gap reaches every rail-width call |
| Scroller style | CSS rules | `--timeline-cell-width` published on the scroll port | WIRED | Strip 6320; consumed by cell width, ruler label/tick and dash rules |
| Per-layer store | Local storage | `efx-timeline-zoom-by-layer` | WIRED | Read at module init, written on change, restored by `resetForStudioOpen(layerId)`; no document path |
| Viewport getter | Audio visible range | registered port → division by live pitch | WIRED | Getter uses `metrics.peek().pitch`; audio range matrix rows; consumed by `PhysicsPaintStudio.tsx` `getTimelineViewport` |
| `PhysicsPaintTrackRow.test.tsx` | Vitest collection | `PhysicsPaintTrackRow.test.tsx.test.ts` launcher | WIRED | 45 tests run green |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `physicsPaintTimelineZoom.ts` | `scaleSignal` | user wheel/pill/reset input through store actions | Yes — real signal, computed metrics | ✓ FLOWING |
| `physicsPaintTimelineZoom.ts` | per-layer scale map | localStorage read (clamped/finite) → `resetForStudioOpen` | Yes — restores the layer's real remembered density | ✓ FLOWING |
| `PhysicsPaintWorkflowStrip.tsx` | `timelineMetrics` | `timelineZoom.metrics.value` | Yes — drives lane width, grid columns, ruler, playhead, ghosts, rows | ✓ FLOWING |
| `PhysicsPaintTimelineZoomBar.tsx` | `percent`, `isAtMin`, `isAtMax` | computed signals from the live scale | Yes — real zoom level, not a literal | ✓ FLOWING |
| Scroller `scrollLeft` | deferred anchored target | anchored law on live scroll position and pitch | Yes — writes the real scroller, coalesced per frame | ✓ FLOWING |
| `PhysicsPaintTrackRow.tsx` | `--timeline-cell-width` | `framePitch − frameGap` from the strip | Yes — live cell width; the CSS `16px` is only a non-zoom fallback never reached from the strip | ✓ FLOWING |
| `PhysicsPaintWorkflowStrip.tsx` | sound stain left/width | `soundStainLeftPx/WidthPx(frame, live pitch)` | Yes — live pitch at event/render time | ✓ FLOWING |

No static-return, hardcoded-empty or mock source exists in the production path. The token defaults (`TIMELINE_GEOMETRY.cellPitch`, optional `frameGap`, CSS `16px` fallback) serve non-zoom callers and CSS-before-mount, while the strip always supplies the live values.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase authority, wiring, audit, five-level matrix, rail/presentation, motion lanes, row harness, scrub, cross-track and strip suites | `./node_modules/.bin/vitest run <12 phase .test.ts files>` (in `app/`) | 12 files passed, 542 tests passed, 1.58s | ✓ PASS |
| Typecheck at HEAD | `./node_modules/.bin/tsc --noEmit` (in `app/`) | exit 0, no diagnostics | ✓ PASS |
| Zero local pitch literals audit is non-vacuous | `timelineZoomAuthorityAudit.test.ts` | allowlist exactly 2 owners, 12 named consumers, ≥25 scanned sources, seeded positive samples | ✓ PASS |
| Full suite | full `vitest run` (orchestrator-supplied for this regeneration) | 408 files / 8417 tests green | ✓ PASS (supplied evidence) |
| Live wheel/pinch anchoring + scroll-snap settle | UAT rows 1-2, 2026-11-09 | 5/5 UAT rows passed, 0 issues | ✓ PASS |

### Probe Execution

SKIPPED — Phase 60 declares no probes and the repository has no `scripts/*/tests/probe-*.sh` for this phase; it is not a migration or CLI/tooling phase.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `physicsPaintTimelineZoom.test.ts` | ZOOM-01/02/03/04 | Yes | 0 | No — expectations are literal ladder/anchor figures; the module is not its own oracle | Value / Behavioral | ✓ PASS |
| `physicsPaintTimelineZoomWiring.test.ts` | ZOOM-01/02/05 | Yes | 0 | No — source-contract pins (ordering, strings), not computed output | Behavioral (source) | ✓ PASS |
| `timelineZoomAuthorityAudit.test.ts` | ZOOM-05 | Yes | 0 | No — scans source text; seeded positive/negative controls | Behavioral (audit) | ✓ PASS |
| `PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` | ZOOM-01..05 | Yes | 0 | No — frozen literal level table; helpers produce actuals only | Value (pinned) | ✓ PASS |
| `PhysicsPaintTrackRow.test.tsx` (via launcher) | ZOOM-05 | Yes | 0 | No — geometry literals | Value | ✓ PASS |
| `TimelineMotionChannels.test.ts`, `physicsPaintLoopClipPresentation.test.ts`, `timelineMotionSurface.contract.test.ts`, `PhysicsPaintWorkflowStrip.test.ts`, `PhysicsPaintWorkflowStrip.rulerSeek.test.ts`, `usePhysicsPaintRulerScrub.test.ts`, `usePhysicsPaintCrossTrackDrag.test.ts` | ZOOM-01/05 | Yes | 0 | No | Value / Behavioral | ✓ PASS |

**Disabled tests on requirements:** 0. **Circular patterns detected:** 0. **Insufficient assertions:** 0.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ZOOM-01 | 60-01, 60-02, 60-03, 60-06 | Cmd/Ctrl+wheel zooms frame density keeping the frame under the cursor fixed | ✓ SATISFIED | Modifier wheel path, anchored law with the 6px gutter, CR-02 deferral, unit + matrix tests; UAT row 1 |
| ZOOM-02 | 60-01, 60-06 | Pill minus/percent/plus/100%-reset; locked presets; 100% = 18px; playhead anchoring with viewport-centre fallback | ✓ SATISFIED | Pill leaf, ladder, anchor/reset tests, one-shot reset, disabled ends; UAT row 4; `REQUIREMENTS.md` updated 2026-11-09 |
| ZOOM-03 | 60-01, 60-04, 60-06 | Row, lane and cell heights fixed; only horizontal density scales | ✓ SATISFIED | Four-field metrics, unchanged height tokens, horizontal-only diffs; UAT row 3 |
| ZOOM-04 | 60-01 | UI preference only — remembered per paint layer across Studio reopens; never written to the document, schema, persistence or export | ✓ SATISFIED | localStorage-only key, LRU cap, safe degradation, no document surface; UAT row 5; `REQUIREMENTS.md` updated 2026-11-09 |
| ZOOM-05 | 60-01..60-06 | Every frame→pixel consumer reads one pitch authority; no local `× 18` | ✓ SATISFIED | 12 named consumers audited; allowlist exactly two owners; repo grep clean; 5 pitch render sites |

No orphaned requirements: all five IDs are claimed across the six plans, appear as Complete in `REQUIREMENTS.md`, and every one has implementation evidence plus a green focused suite. All plan-frontmatter `requirements:` IDs (ZOOM-01..05) are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`, `FIXME` or `XXX` markers in any phase-modified file; no skipped tests; no self-oracle assertions; no empty render stubs; no console-only handlers | — | None |
| `PhysicsPaintWorkflowStrip.tsx` | ~4067, ~4154; `usePhysicsPaintCrossTrackDrag.ts` `getContentLeft` | Three pointer→frame projections omit the 6px content gutter (WR-02, open) | ⚠️ Warning (open, pre-existing origin) | Projects a frame biased by `6 / pitch`; the phase made the sites pitch-aware but did not change their origin. Not a pitch-authority violation; recorded open in `60-REVIEW-DISPOSITION.md`. Candidate follow-up: route through `pxToFrame` (IN-04) |
| `PhysicsPaintStudioView.tsx`, `PhysicsPaintReferenceTransform.ts`, `physicsPaintStudio.css` | cursor-seat chain | WR-05: rail-edit cursor seats re-apply a chain the cursor coordinates and ring size already contain; both overlays detach under rail **scale** and the ring renders `s×` too large (open) | ⚠️ Warning (open, post-phase quick `9f6b0c9e3`; unrelated to timeline zoom) | Unrelated to the zoom goal: it concerns the paint cursor overlay under a non-identity rail transform. Recorded open in `60-REVIEW-DISPOSITION.md`; no failing test (IN-10). Does not affect any phase truth |
| `PhysicsPaintStudio.tsx` | settle effect ~5603-5633 | WR-06: the post-await tail re-checks generation/startFrame but not `rotoCachedPlayback.isActive` (open) | ⚠️ Warning (open, post-phase quick `22662b433`; unrelated to timeline zoom) | Roto capture settle only; does not touch the zoom authority. Recorded open in `60-REVIEW-DISPOSITION.md` |
| `physicsPaintStudio.css` | ~5111 | `scroll-snap-type: x mandatory` may quantize anchored writes (WR-01) | ℹ️ Resolved by live evidence | UAT row 2 passed 2026-11-09; kept recorded as an observation only |
| `PhysicsPaintWorkflowStrip.tsx` | playhead law | Playhead centres on `pitch / 2 − 1` while the ruler centres on half the live cell (IN-01) | ℹ️ Info (open) | Up to ~4px divergence at 4×, calibration only; both read the live pitch |
| `PhysicsPaintWorkflowStrip.tsx` | ruler tick row | Ruler tick row overhangs when `frameCount % step !== 0` (IN-02) | ℹ️ Info (open, pre-existing) | Scales with zoom; recorded open |
| `physicsPaintAudioController.ts` | 64 | Stale `ROTO_CELL_WIDTH_PX` / "Fit to view" in a port doc comment (IN-03) | ℹ️ Info (open) | Documentation only; file not modified by the phase |
| `physicsPaintTimelineZoom.ts` | helper exports | `frameToPx`, `pxToFrame`, `resolveTimelineViewportFrames` have no production consumer (IN-04) | ℹ️ Info (open) | Used as the pinned projection math in tests; `pxToFrame` is the correct helper for WR-02 |
| `PhysicsPaintStudio.tsx` | settle effect | IN-08: post-await tail outside the try/catch; IN-09: residual sub-sample band of the 48x48 ink mean; IN-10: the two new pins assert wiring/substrings, so WR-05/WR-06 ship green | ℹ️ Info (open) | All recorded in `60-REVIEW-DISPOSITION.md`; none touches the timeline zoom surface |
| `.planning/ROADMAP.md` | Phase 60 SC2/SC5 | Success criteria still say "Fit" (SC2) and "session-only: resets when the Studio closes" (SC5), superseded by the approved 100%-reset and per-layer-memory changes | ℹ️ Info (documentation drift) | `REQUIREMENTS.md` is authoritative and updated 2026-11-09; code and UAT match the updated contract; refresh the ROADMAP wording at milestone close |

Post-plan changes verified against the goal (not treated as gaps):

- `c59b775bf` — non-active row cells take `--timeline-cell-width` from the live pitch (UI-REVIEW blocker closed).
- `65a932045` — ruler label/tick centre on the live half-cell; the scroller publishes the property once.
- `e37f7e49d` — CR-01 marker width inline from `cellWidth`; CR-02 anchored write deferred one rAF.
- `7c55ea4c4` — square-dimensions icon, centred proportional in-between dash, per-layer zoom memory.
- `abfe299a3` — fourth pill control is a one-shot 100% reset; Fit and `resolveTimelineFitScale` removed; REQUIREMENTS ZOOM-02/ZOOM-04 updated.
- `e88a33204` — LRU eviction with delete-then-set, exact reset-anchor test pins, dead `getFrameCount` port member removed, stale Fit docs corrected, dash width clamped to the cell padding box.
- `9f6b0c9e3` — the change that made the prior fingerprint stale: a 12-line additive `.physics-paint-picker-visor-seat` rule in `physicsPaintStudio.css` (plus the rail-edit cursor-seat code and its pin). It contains no timeline, ruler, cell-width or zoom selector; it does not alter any phase truth.

### Advisory (New Scope, Unevidenced)

None raised by this pass. The two open review warnings (`WR-05`, `WR-06`) were already recorded before this verification in `60-REVIEW-DISPOSITION.md`; both concern post-phase quick-task surfaces unrelated to the timeline zoom goal, have no failing test (IN-10), and are recorded above as warnings only.

### Human Verification Required

None outstanding. The phase's human rows are already closed by live UAT (`60-UAT.md`, 5/5 passed at 2026-11-09T16:34Z): wheel/pinch anchoring, scroll-snap settle, the 25/100/400 visual matrix, the 100% reset control and per-layer persistence. No zoom behavior file changed after the UAT recording except `e88a33204` (behavior-neutral for those rows) and the unrelated `9f6b0c9e3` CSS rule.

### Gaps Summary

No must-have truth FAILED, no required artifact is missing or a stub, no key link is broken, and no blocker anti-pattern exists. The phase goal is achieved in the current codebase: one session-only pitch authority (`physicsPaintTimelineZoom.ts`) drives the lane extent, cells grid, adaptive ruler, playhead, both rail families, motion lanes, track rows, Background clips, sound leaves, scrub, cross-track drag, scroll-to-frame, ghost/preview geometry, the pill and the audio visible range; the vertical tokens and heights are untouched; every `framePitch` consumer receives the live value; and the zoom preference survives Studio reopens per paint layer without touching the document.

The regeneration trigger — the additive `.physics-paint-picker-visor-seat` CSS rule from `9f6b0c9e3` — is unrelated to the timeline zoom geometry, and the current tree reproduces every prior conclusion: 20/20 truths and 13/13 prohibitions verified, focused suites green (12 files / 542 tests), typecheck clean. The remaining open review items are warnings/info on post-phase quick-task surfaces (cursor seat, roto capture settle) plus the pre-existing WR-02 gutter bias and four informational findings; none blocks the phase. The ROADMAP SC2/SC5 wording is stale relative to the approved contract and should be refreshed at milestone close.

### Decision Coverage

The phase decision set was checked on this tree: 14/14 decisions honored, `blocking: false` (exit 0). D-04 (Fit) is honored in its superseded form — the approved 100% reset replaces Fit with the same one-shot, playhead-anchored semantics — and D-14's no-grid-threshold rule holds (matrix asserts no `timelineMetrics.pitch <` density gate). No deferred items were identified against Phase 61/62, whose goals (vector painting, painted-stroke curve editing) do not address the open zoom warnings.

---

_Verified: 2026-11-09T20:19:28Z_
_Verifier: Claude (gsd-verifier)_
