# Phase 60: Studio Timeline Horizontal Zoom - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the **Studio Paint timeline** a horizontal frame-density zoom from 0.25× to 4×, driven from **one pitch authority** so that every frame→pixel consumer agrees at every level, with every vertical dimension fixed. Two inputs — Cmd/Ctrl+wheel and a header zoom pill (minus / percent / plus / Fit) — write one session-only scale. Nothing about the document changes.

This phase delivers the zoom metrics module, the pill, the wheel path, and the conversion of all 66 pitch consumers onto the single authority (ruler, playhead, hit-testing, drag, scrub, selection, paste, sound stains, scroll-to-frame, rail geometry, motion lanes).

It does **not** add vector painting (Phase 61), painted-stroke curve editing (Phase 62), motion channels (Phase 59, shipped), Studio canvas zoom (shipped in v2.0.1), or the VIS-02 `30` vs `31` row-height drift.

</domain>

<decisions>
## Implementation Decisions

### Milestone-locked (carried in, NOT re-asked)

These were settled before this discussion and must not be reopened by research or planning:

- **ZOOM-01..05 are the requirement set.** Range 0.25×–4×; presets `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`; **100% is the base 18px pitch**.
- **Anchoring law.** Wheel zoom keeps the frame under the cursor fixed. The pill's minus/plus and Fit keep the **playhead frame** fixed, falling back to the **viewport centre** when the playhead is offscreen. Fit clamps into range, so a very long document can still overflow at 0.25×.
- **Horizontal only.** Row height, lane height (18px), cell height (22px), header-column width (185px) and the 6px gutter stay fixed. Only frame density scales.
- **Session-only.** Zoom resets when the Studio closes. It changes no document, `.mce` field, schema, persistence, revision, cache key, or export output.
- **One metrics authority.** A single session-only module in `view/` that every frame→pixel consumer reads. **No Preact context provider** (module-level components consume pitch and cannot take props); **no CSS `transform: scale`** (it double-scales every client-rect-derived mapping — the canvas-zoom prohibition); CSS custom properties only for values CSS itself renders.
- **Plain-wheel behaviour is unchanged.** A vertical wheel over the timeline still scrolls horizontally; Shift+wheel and horizontally-dominant deltas stay fully native.
- **The literal-`18` audit reaches zero before the zoom matrix test is written** (ROADMAP prerequisite). The existing source-string pins that assert `ROTO_CELL_WIDTH_PX = 18` must move to the shared authority rather than be deleted.
- **VIS-02 is out of scope.** The `30` vs `31` row-height drift is not part of zoom; keep row and lane heights fixed and do not "fix" the drift here.

### Zoom pill

- **D-01:** The pill lives in the **Studio workflow header row** (`.physics-paint-workflow-header`, 46px) as a new `.physics-paint-pill`, alongside the existing navigation, playback and Tools controls. It is **always visible** — never scoped to a selection or to rail scope. — **Reversibility:** reversible — moving it later is a local markup change in the static chrome.
- **D-02:** The **percent readout is display-only** — a plain `<span>`, no click target. Minus and plus step the preset ladder one step per press, and each disables at its end of the range. This mirrors the shipped canvas pill (`PhysicsPaintCanvasZoomBar.tsx`), whose percent is also a non-interactive span.
- **D-03:** The readout shows **rounded integer percent** of the live scale, exact at 100% (the 18px pitch).
- **D-04:** **Fit is a one-shot computed scale.** It computes the scale that fits the whole frame range, clamps it into 0.25–4, applies it once, and the readout then shows that computed value (e.g. `27%`). It is **not a live mode**: a later Studio-window or strip resize does not re-fit. Fit is not re-pressed automatically, and no "fitting" state exists alongside the percent.

### Wheel zoom

- **D-05:** **Cmd/Ctrl+wheel is continuous exponential** — roughly ×1.1 per 100px of wheel delta, normalized for line-mode wheels (Firefox), clamped to 0.25–4. It never snaps to presets, so the readout can show any integer (e.g. `137%`). The modifier gesture is the fine-control path; the pill buttons stay the discrete ladder.
- **D-06:** **Buttons step from the current value, not from a preset.** After a continuous wheel lands at 137%, plus goes to 150% and minus to 100% (first preset strictly beyond the current scale, clamped). The current value is never rounded into a preset first.
- **D-07:** **Trackpad pinch needs no separate handler.** macOS delivers pinch as `wheel` with `ctrlKey`, so it flows through the same Cmd/Ctrl branch; the plain-wheel branch must keep returning early for it.
- **D-08:** A wheel tick that lands inside the epsilon of the current scale (or at a clamped end) is a **no-op** — compare-then-write, no re-render.

### Ruler

- **D-09:** The ruler tick step is the **smallest multiple of the 3-frame step that leaves ≥40px per tick** at the current pitch, and **every tick carries its label**. At 1× (54px), 2× (108px) and 4× (216px) the step stays 3 frames, so **today's ruler is byte-identical at 1×**. Zoomed out it becomes 6, 12, 24… frames per tick.
- **D-10:** The rule **only ever coarsens**. The ruler never subdivides below the 3-frame step, even at 4× where a tick spans 216px and only ~5 labels fit a typical viewport.
- **D-11:** Labels keep following the Frame/Seconds switch; the adaptive step applies to both unit modes.

### Cells and markers

- **D-12:** **Cell width, cell gap and pitch scale** with zoom (16 → `16 × scale`, 2 → `2 × scale`, 18 → `18 × scale`), as do the rail line widths (`frameCount × pitch − gap` — the rule already consumes the pitch) and every frame→pixel mapping. — **Reversibility:** costly — every rail renderer and the zoom matrix test assert these relationships at five levels; changing what scales re-touches the whole surface.
- **D-13:** **Markers keep a fixed pixel footprint.** The 6×6 motion keys and the playhead marker do not scale; they stay centred on their (scaled) frame slot. At 4× a key sits in a 64px-wide cell; at 0.25× a 6px key is wider than its 4.5px slot and keys visually touch.
- **D-14:** **No grid threshold rule.** There is no "hide the per-cell grid below 50%" switch: at 0.25× the `0.5px` gaps simply antialias away and the cells read as one continuous band. One uniform scale, no second mode to test.

### Claude's Discretion

- Which strip regions respond to Cmd/Ctrl+wheel. Recommended: the timeline scroller including the ruler band; the header column keeps its own vertical-scroll behaviour and should not zoom.
- The exact exponential constant above the ~1.1-per-100px starting point, and the line-mode normalization.
- The pill's exact position and order inside the workflow header row, its spacing, and its control sizes — within the existing `.physics-paint-pill` grammar (32px height).
- How the scaled geometry reaches CSS-drawn values (custom properties vs inline styles), subject to the no-`transform: scale` constraint.
- Whether the metrics module exposes `metrics()` + `frameToPx`/`pxToFrame` helpers (the research sketch) or an equivalent shape. The requirement is **one authority**, not a specific API.
- Whether the playhead half-cell offset constant (`+8` today: half-pitch minus half the 2px line) becomes `framePitch / 2 - 1` — the Pitfall-derived formula — or an equivalent that is asserted at every preset.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone authority (read first)

- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §5.6 — the locked zoom scope: horizontal only, controls, anchoring, range, session-only, and why this is a phase rather than a quick. §5.2 records the shipped canvas zoom this phase's pill is modelled on.
- `SPECS/v2.1.0-motion-channels/README.md` — the v7 lane UI contract (§0 expressibility gate, §2 geometry: 18px lanes, 16×18 cells, 6×6 keys, nav cluster, outline formula, 2px row rhythm, §4 integration map). Zoom must keep this geometry's **vertical** terms fixed and scale its horizontal terms.
- `SPECS/v2.0.1-timeline-rails/README.md` — the shipped rail surface (rail line width rule, cell matrix, rail types, selection).
- `SPECS/UI-SPECS/zoom and audio.png` — the saved NLE reference: percent + slider at the timeline's bottom-right. **The slider form is superseded** by the locked pill (see `<specifics>`); the image remains useful for the readout/stepper grouping.

### Research

- `.planning/research/ARCHITECTURE.md` §3 (Question B) — the metrics-module recommendation, the duplicate-pitch table, the what-scales/what-stays-fixed table, the full call-site inventory, the anchoring formulas, the header-column lockstep rule, and the new-vs-modified file list.
- `.planning/research/PITFALLS.md` — **Pitfall 8** (the 18px literal in 66 places, the partial-conversion failure modes, the `usePhysicsPaintCrossTrackDrag` latent `zoom` seam, and the required zoom matrix at 0.25/0.5/1/2/4) plus the playhead `+8` and header-offset notes.
- `.planning/research/SUMMARY.md`, `.planning/research/FEATURES.md`, `.planning/research/STACK.md` — synthesis and the "no new runtime dependencies" verdict (REL-01 holds for this phase).

### Prior phase

- `.planning/phases/59-rail-motion-channels-v7-interface/59-CONTEXT.md` — the motion lanes that share this pitch: D-10..D-15 (lane set, order, add-channel row, last-key removal) and the 18px lane rhythm. Phase 60 rebases on that surface rather than reworking it.

### Requirements and roadmap

- `.planning/REQUIREMENTS.md` — ZOOM-01..05 and the traceability table.
- `.planning/ROADMAP.md` §Phase 60 — goal, the five success criteria, and the literal-`18` prerequisite.
- `.planning/STATE.md` — current milestone position and the delivery laws REL-01..04.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts` (382 lines) — **the exact precedent**: module-level `@preact/signals`, `PHYSICS_PAINT_ZOOM_PRESETS`, `clampZoomScale`, `nextScalePreset`, compare-then-write `setSignal`, and `resetForStudioOpen()`. The timeline module should mirror its shape, not its pan math.
- `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx` (170 lines) — the pill markup and UX grammar: lucide `Minus`/`Plus`, a non-interactive percent `<span>`, disabled ends, a `Fit` text button with `aria-pressed`. D-01..D-03 clone this.
- `app/src/components/physic-paint/view/timelineRailDesign.ts` — `TIMELINE_GEOMETRY` (`cellWidth: 16`, `cellGap: 2`, `cellPitch: 18`, `cellHeight: 22`, `motionLaneHeight: 18`) and `TIMELINE_MOTION`. `projectTimelineRailLineWidth(frameCount, pitch, …)` and `resolveMotionBlockOutlineRect` already accept a pitch — they are the template for making the rest parametric.
- `app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts` — already takes a `cellWidthPx` option; wire it to the metrics instead of `ROTO_CELL_WIDTH_PX`.
- `app/src/components/physic-paint/view/soundBandGeometry.ts` — `soundStainLeftPx` / `soundStainWidthPx` are already pitch-parameterized.
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx`, `PhysicsPaintLoopClipRail.tsx` — already prop-driven on `framePitch`.
- `app/src/components/physic-paint/view/usePhysicsPaintCrossTrackDrag.ts` — already accepts an optional `zoom` (default 1) and computes `pitch = framePitch * zoom` (~`:98`, `:202`). The one existing seam; verify it agrees with the new authority instead of double-applying.

### Established Patterns

- **Session-only view metrics never enter `.mce`.** The canvas zoom module is the model; nothing view-only may reach the document, revision, or cache key.
- **No `transform: scale` for view zoom** — it double-scales client-rect math used by every drag/scrub handler.
- **Compare-then-write signal setters** so a no-op wheel tick causes no re-render.
- **Single derivation, never a local multiply** — derive the metrics once and pass them in; Pitfall 8's partial conversion is the failure mode.
- **Source-string pin tests** (e.g. `PhysicsPaintWorkflowStrip.test.ts` asserting `ROTO_CELL_WIDTH_PX = 18`, the ruler `flex` expression, and the grid `repeat(n, …)`) will fail the moment pitch becomes derived; they must be repointed at the authority, not relaxed.
- **Row-flow lockstep** — the header column and the rows region must read the same row-height constants. Zoom does not change vertical geometry, so lockstep holds as long as neither side re-declares `30`/`31`.

### Integration Points

- `PhysicsPaintWorkflowStaticChrome` (inside `PhysicsPaintWorkflowStrip.tsx`, ~`:1753`, rendered at ~`:6053`) — hosts `.physics-paint-workflow-header`, where the pill is added.
- `PhysicsPaintWorkflowStrip.tsx` — `ROTO_CELL_WIDTH_PX = 18` (~`:647`), `RULER_STEP = 3` (~`:643`), `RULER_TICK_WIDTH_PX` (~`:649`), `buildRulerTicks` (~`:823`) with its `inline flex: 0 0 ${RULER_TICK_WIDTH_PX}px` (~`:6236`), the plain-wheel listener (~`:5418`), the `getTimelineViewportFrames` getter (`scrollLeft / ROTO_CELL_WIDTH_PX`, ~`:2716`), scroll-to-frame/reveal (~`:4991`, `:5015`), and the drag/hit-test/ghost sites listed in ARCHITECTURE §3.4.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — `ROW_CELL_WIDTH_PX = 18` (~`:64`) plus a hard-coded `18` in loop geometry (~`:398`).
- `app/src/components/physic-paint/physicsPaintStudio.css` — `.physics-paint-roto-cell { width: 16px }`, `.physics-paint-ruler-tick { flex: 0 0 54px }`, `.physics-paint-workflow-header` (46px) and `.physics-paint-pill` (32px), and `.physics-paint-canvas-zoom-bar` (the pill's visual grammar: dark translucent, `border-radius: 999px`).
- Studio open/close — the reset seam (`resetForStudioOpen` precedent) so ZOOM-04 holds.

</code_context>

<specifics>
## Specific Ideas

- **The UI reference does not override the locked form.** `SPECS/UI-SPECS/zoom and audio.png` shows an NLE with a percent + slider at the timeline's bottom-right. The requirement's pill (minus / percent / plus / Fit) wins — consistent with quick 260318-l3c, where you removed a timeline zoom slider in favour of icon buttons — and the placement follows quick 260324-ju7, where you moved canvas zoom controls to the top for accessibility.
- **The zoom matrix is the acceptance surface.** Per Pitfall 8, assert at 0.25, 0.5, 1, 2 and 4: playhead centre, hit-test frame at a fixed `clientX`, ruler tick extent, sound-stain left and width, Loop Clip rail extent, and the audio visible-frame range.
- **Today's ruler is the regression baseline.** At 1× nothing may move: same 3-frame step, same 54px tick, same label positions.
- **The playhead's literal `+8`** (half of 18 minus half the 2px line) is the quintessential partial-conversion bug — it must become a pitch-derived half-cell offset and be asserted at every preset.

</specifics>

<deferred>
## Deferred Ideas

- **Preset dropdown from the percent label** — faster jumps across the ladder; D-02 keeps the readout display-only for now.
- **Editable percent input** — typing an exact value (e.g. 137%); needs clamping, commit semantics, and an EU-comma tolerant parser.
- **Live Fit mode** — re-fitting on container resize; D-04 keeps Fit a one-shot so the readout stays one number.
- **Ruler sub-ticks at high zoom** — per-frame labels when a tick exceeds ~150px; D-10 keeps the coarsen-only rule.
- **Timeline zoom keyboard shortcuts** (e.g. Cmd+= / Cmd+-) — not in ZOOM-01..05.
- **VIS-02 `30` vs `31` row-height drift** — explicitly excluded from this phase; must be fixed only as its own pinned change.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — "Frame fade — compositing/export cumulative-frame crossfade (separate from opacity)". Surfaced by the todo matcher on the words frame/export, but it is a paint/compositing display effect with its own staleness contract, not timeline zoom. Reviewed and deliberately left pending; the todo itself says "revisit only if a compositing/export frame-fade look is explicitly requested".

</deferred>

---

*Phase: 60-Studio Timeline Horizontal Zoom*
*Context gathered: 2026-11-09*
