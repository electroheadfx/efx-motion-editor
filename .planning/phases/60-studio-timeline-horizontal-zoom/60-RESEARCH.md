# Phase 60: Studio Timeline Horizontal Zoom - Research

**Researched:** 2026-11-09
**Domain:** In-repo view-state refactor — Preact signals + CSS/DOM geometry (Tauri webview)
**Confidence:** HIGH (every file:line below was opened and read in this session; no external libraries)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Milestone-locked (carried in, NOT re-asked)

These were settled before this discussion and must not be reopened by research or planning:

- **ZOOM-01..05 are the requirement set.** Range 0.25×–4×; presets `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`; **100% is the base 18px pitch**.
- **Anchoring law.** Wheel zoom keeps the frame under the cursor fixed. The pill's minus/plus and Fit keep the **playhead frame** fixed, falling back to the **viewport centre** when the playhead is offscreen. Fit clamps into range, so a very long document can still overflow at 0.25×.
- **Horizontal only.** Row height, lane height (18px), cell height (22px), header-column width (185px) and the 6px gutter stay fixed. Only frame density scales.
- **Session-only.** Zoom resets when the Studio closes. It changes no document, `.mce` field, schema, persistence, revision, cache key, or export output.
- **One metrics authority.** A single session-only module in `view/` that every frame→pixel consumer reads. **No Preact context provider** (module-level components consume pitch and cannot take props); **no CSS `transform: scale`** (it double-scales every client-rect-derived mapping — the canvas-zoom prohibition); CSS custom properties only for values CSS itself renders.
- **Plain-wheel behaviour is unchanged.** A vertical wheel over the timeline still scrolls horizontally; Shift+wheel and horizontally-dominant deltas stay fully native.
- **The literal-`18` audit reaches zero before the zoom matrix test is written** (ROADMAP prerequisite). The existing source-string pins that assert `ROTO_CELL_WIDTH_PX = 18` must move to the shared authority rather than be deleted.
- **VIS-02 is out of scope.** The `30` vs `31` row-height drift is not part of zoom; keep row and lane heights fixed and do not "fix" the drift here.

#### Zoom pill

- **D-01:** The pill lives in the **Studio workflow header row** (`.physics-paint-workflow-header`, 46px) as a new `.physics-paint-pill`, alongside the existing navigation, playback and Tools controls. It is **always visible** — never scoped to a selection or to rail scope. — **Reversibility:** reversible — moving it later is a local markup change in the static chrome.
- **D-02:** The **percent readout is display-only** — a plain `<span>`, no click target. Minus and plus step the preset ladder one step per press, and each disables at its end of the range. This mirrors the shipped canvas pill (`PhysicsPaintCanvasZoomBar.tsx`), whose percent is also a non-interactive span.
- **D-03:** The readout shows **rounded integer percent** of the live scale, exact at 100% (the 18px pitch).
- **D-04:** **Fit is a one-shot computed scale.** It computes the scale that fits the whole frame range, clamps it into 0.25–4, applies it once, and the readout then shows that computed value (e.g. `27%`). It is **not a live mode**: a later Studio-window or strip resize does not re-fit. Fit is not re-pressed automatically, and no "fitting" state exists alongside the percent.

#### Wheel zoom

- **D-05:** **Cmd/Ctrl+wheel is continuous exponential** — roughly ×1.1 per 100px of wheel delta, normalized for line-mode wheels (Firefox), clamped to 0.25–4. It never snaps to presets, so the readout can show any integer (e.g. `137%`). The modifier gesture is the fine-control path; the pill buttons stay the discrete ladder.
- **D-06:** **Buttons step from the current value, not from a preset.** After a continuous wheel lands at 137%, plus goes to 150% and minus to 100% (first preset strictly beyond the current scale, clamped). The current value is never rounded into a preset first.
- **D-07:** **Trackpad pinch needs no separate handler.** macOS delivers pinch as `wheel` with `ctrlKey`, so it flows through the same Cmd/Ctrl branch; the plain-wheel branch must keep returning early for it.
- **D-08:** A wheel tick that lands inside the epsilon of the current scale (or at a clamped end) is a **no-op** — compare-then-write, no re-render.

#### Ruler

- **D-09:** The ruler tick step is the **smallest multiple of the 3-frame step that leaves ≥40px per tick** at the current pitch, and **every tick carries its label**. At 1× (54px), 2× (108px) and 4× (216px) the step stays 3 frames, so **today's ruler is byte-identical at 1×**. Zoomed out it becomes 6, 12, 24… frames per tick.
- **D-10:** The rule **only ever coarsens**. The ruler never subdivides below the 3-frame step, even at 4× where a tick spans 216px and only ~5 labels fit a typical viewport.
- **D-11:** Labels keep following the Frame/Seconds switch; the adaptive step applies to both unit modes.

#### Cells and markers

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

### Deferred Ideas (OUT OF SCOPE)

- **Preset dropdown from the percent label** — faster jumps across the ladder; D-02 keeps the readout display-only for now.
- **Editable percent input** — typing an exact value (e.g. 137%); needs clamping, commit semantics, and an EU-comma tolerant parser.
- **Live Fit mode** — re-fitting on container resize; D-04 keeps Fit a one-shot so the readout stays one number.
- **Ruler sub-ticks at high zoom** — per-frame labels when a tick exceeds ~150px; D-10 keeps the coarsen-only rule.
- **Timeline zoom keyboard shortcuts** (e.g. Cmd+= / Cmd+-) — not in ZOOM-01..05.
- **VIS-02 `30` vs `31` row-height drift** — explicitly excluded from this phase; must be fixed only as its own pinned change.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — "Frame fade — compositing/export cumulative-frame crossfade (separate from opacity)". Surfaced by the todo matcher on the words frame/export, but it is a paint/compositing display effect with its own staleness contract, not timeline zoom. Reviewed and deliberately left pending; the todo itself says "revisit only if a compositing/export frame-fade look is explicitly requested".
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ZOOM-01 | Cmd/Ctrl+wheel zooms timeline frame density, keeping the frame under the cursor fixed | Wheel listener located and characterized (strip `useLayoutEffect` at `PhysicsPaintWorkflowStrip.tsx:5417-5429`); currently has NO modifier guard. Anchoring formula derived from the scroller's 6px padding; rAF-coalescer precedent at `PhysicsPaintCanvasZoomViewport.tsx:44-102`. |
| ZOOM-02 | Zoom pill offers minus / percent / plus / Fit; presets; 100% = 18px; pill/Fit keep playhead fixed, fallback viewport centre | Pill grammar verified in `PhysicsPaintCanvasZoomBar.tsx` and `.physics-paint-pill` CSS (`physicsPaintStudio.css:3979-4005`); header host verified at `PhysicsPaintWorkflowStrip.tsx:1839`; preset/clamp/step helpers already exist in `physicsPaintCanvasZoom.ts:103-128` and can be mirrored. |
| ZOOM-03 | Row, lane, and cell heights stay fixed — only horizontal density scales | Fixed vertical values verified: `.physics-paint-lane` 31px + 6px padding (`css:5898-5909`), roto-cell height 22px (`css:7892`), motion lane 18 (`timelineRailDesign.ts:110`), header column 185px (`css:5934`), ruler band 36px (`css:5137`). |
| ZOOM-04 | Session-only; resets on Studio close; no document/schema/persistence/export change | Reset precedent `physicsPaintCanvasZoom.ts:376-381` called from `PhysicsPaintCanvasZoomViewport.tsx:34-37`; zoom module state is module-level signals only — no `.mce` field exists and none may be added. |
| ZOOM-05 | Every frame→pixel consumer reads one pitch authority — no local `× 18` | Full live inventory below: 56 `ROTO_CELL_WIDTH_PX` refs in the strip, 9 `ROW_CELL_WIDTH_PX` refs in `PhysicsPaintTrackRow.tsx`, 4 Phase-59 motion-lane sites, 2 key-drag sites, 1 hard-coded `18` (`PhysicsPaintTrackRow.tsx:785`), 3 CSS literals, plus already-parametric helpers. |
</phase_requirements>

## Summary

This phase is a **single-authority refactor**, not new feature research. Phase 59 landed 25 plans and moved every line number the milestone research recorded — e.g. `ROW_CELL_WIDTH_PX` moved from `:64` to `:90`, the hard-coded loop-geometry `18` from `:398` to `:785`, and the static chrome host from `~:1753`/`~:6053` to `:1753`/`:6047`. The inventory below was rebuilt from the live tree and every cited line was read this session. The pitch authority has **six independent definitions** today: the strip constant, the track-row constant, the track-row literal `18`, `.physics-paint-roto-cell { width: 16px }`, `.physics-paint-ruler-tick { flex: 0 0 54px }`, and `TIMELINE_GEOMETRY` design tokens (`cellPitch: 18`, `cellWidth: 16`, `cellGap: 2`). The phase succeeds only when exactly one of those remains authoritative and the rest derive.

Two behaviours deserve emphasis because they are not in the milestone pitfalls. First, the plain-wheel listener (`PhysicsPaintWorkflowStrip.tsx:5417-5429`) has **no `ctrlKey`/`metaKey` guard**, so Cmd/Ctrl+wheel currently scrolls the timeline; the zoom branch must be inserted *ahead* of the existing shift/horizontal guards and must `return` so the plain branch never sees a modifier wheel. Second, the rail-width rule's **gap must scale too**: `projectTimelineRailLineWidth(frameCount, pitch, endVisible, gap)` defaults `gap` to 2, so a call that passes the scaled pitch but omits the scaled gap is 1.5px wrong at 0.25× and 6px wrong at 4× — a partial conversion that a naive five-level test on pitch alone would not catch.

**Primary recommendation:** create `view/physicsPaintTimelineZoom.ts` as a near-copy of `physicsPaintCanvasZoom.ts`'s shape (module signals + pure helpers + `resetForStudioOpen` + compare-then-write), delete every competing pitch definition, thread the scaled pitch through props to the row/motion components, and coalesce wheel input to one rAF flush that writes scale + anchored `scrollLeft` together.

## Architectural Responsibility Map

Single-tier application: every capability below lives in the **Browser/Client** tier (the Tauri webview renderer). No Rust, main-process, persistence, or export code participates.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Zoom scale state (0.25–4, session-only) | Browser/Client — module-level `@preact/signals` | — | Mirrors `physicsPaintCanvasZoom.ts`; never crosses into the document store |
| Wheel input (Cmd/Ctrl exponential) | Browser/Client — the scroller's `wheel` listener | — | Input is DOM-only; anchor math needs `scrollLeft` + client rects |
| Pill UI (minus / percent / plus / Fit) | Browser/Client — `.physics-paint-workflow-header` | — | D-01 fixes the host; the pill is a prop-less narrow subscriber |
| Pitch → DOM geometry (grid, rails, playhead, stains) | Browser/Client — render body + CSS custom properties | — | No `transform: scale`; CSS vars only for CSS-rendered values |
| Frame↔pixel conversion (drag, scrub, hit-test, viewport) | Browser/Client — pure helpers read at event time | — | Event handlers read `.peek()`; no render-path subscription |
| Reset on Studio open | Browser/Client — Studio view mount effect | — | `resetForStudioOpen` precedent |
| Document / persistence / export | — (untouched) | — | ZOOM-04: no `.mce` field, no revision, no cache key |

## Standard Stack

No new runtime dependencies. REL-01 holds. Everything needed is already installed and imported by the precedent files.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `preact` | `11.2.0` `[VERIFIED: app/package.json:35]` | Component runtime | Project-wide (CLAUDE.md: Preact, not React) |
| `@preact/signals` | `2.11.3` `[VERIFIED: app/package.json:22]` | Session-only zoom signals + narrow leaf subscriptions | The canvas zoom precedent and the project reactivity law |
| `lucide-preact` | `^1.57.0` `[VERIFIED: app/package.json:32]` | `Minus` / `Plus` pill icons | Already used by `PhysicsPaintCanvasZoomBar.tsx:2` |

### Supporting (dev)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^2.1.9` `[VERIFIED: app/package.json:52]` | Unit + source-contract tests | `pnpm --filter efx-motion-editor exec vitest run` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module-level signals (precedent) | Preact context provider | Rejected by D-locked "One metrics authority": module-level sound-stain components have no props/hook context |
| Real layout geometry | CSS `transform: scale` | Forbidden: double-scales every client-rect mapping (canvas-zoom prohibition, `physicsPaintCanvasZoom.ts:9-13`) |
| Inline px styles everywhere | CSS custom properties for CSS-rendered values | Allowed only for values CSS itself renders (cell width, gap); JS-derived px stay in the module |

**Installation:** none. `npm install` / `pnpm add` must not be run for this phase.

**Version verification:** no package is added or upgraded; versions above are read from `app/package.json`. Nothing to consult on the registry.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** No `npm`/`pnpm add`, no registry lookup, no postinstall surface. The Package Legitimacy Gate is skipped by construction (REL-01: no new runtime dependencies).

## Architecture Patterns

### System Architecture Diagram

```
  INPUTS                        AUTHORITY                       CONSUMERS
  ──────                        ─────────                       ─────────
  Cmd/Ctrl + wheel ──┐
  trackpad pinch ────┤   (one rAF coalescer)          ┌─► strip body: rotoLaneWidthPx
  (wheel + ctrlKey)  ├──► timelineZoom.setZoomAtCursor ─┤   (lane / ruler / rows-region
  pill minus / plus ─┤      scale signal 0.25..4        │    width + minWidth)
  pill Fit ──────────┘            │                     │
                                  │                     ├─► ruler band: adaptive step
                                  ▼                     │   (step × pitch per tick)
                         timelineMetrics()              │
                         { scale, cellWidth,           ├─► roto-cells grid: repeat(n, pitch)
                           cellGap, pitch }             │   + --timeline-cell-width var
                                  │                     │
                                  ├────────────────────►├─► playhead leaf: 6 + f·pitch + pitch/2 − 1
                                  │                     │
                                  ├────────────────────►├─► sound stains/edges/ghost:
                                  │                     │   soundStainLeftPx/WidthPx(startFrame, pitch)
                                  │                     ├─► rails (Key, Loop Clip, motion):
                                  │                     │   framePitch + scaled gap
                                  │                     ├─► TrackRow (all rows): framePitch prop
                                  │                     └─► motion lanes + key drag:
                                  │                         framePitch / cellPitch option
                                  ▼
                    event-time reads (NO subscription)
                     drag ÷ pitch · scrub ÷ pitch · push ÷ pitch
                     ghost × pitch · scroll-to-frame × pitch
                     viewport getter ÷ pitch (audio "Fit to view")
```

### Recommended Project Structure

```
app/src/components/physic-paint/
├── view/
│   ├── physicsPaintTimelineZoom.ts        # NEW — the single authority
│   ├── physicsPaintTimelineZoom.test.ts   # NEW — pure math, presets, ruler step, fit, anchor
│   ├── PhysicsPaintTimelineZoomBar.tsx    # NEW — pill leaf (header)
│   ├── PhysicsPaintWorkflowStrip.tsx      # MODIFIED — 56 pitch sites, wheel branch, ruler step, pill host
│   ├── PhysicsPaintTrackRow.tsx           # MODIFIED — framePitch prop, delete ROW_CELL_WIDTH_PX, fix :785
│   ├── TimelineMotionChannels.tsx         # MODIFIED — pitch prop into lane/cell/key/curve/outline
│   ├── TimelineMotionKeyDrag.tsx          # MODIFIED — pitch prop for divide + ghost
│   ├── timelineRailDesign.ts              # MODIFIED — outline rect accepts pitch + gap
│   ├── PhysicsPaintKeyRail.tsx            # UNCHANGED — already prop-driven
│   ├── PhysicsPaintLoopClipRail.tsx       # UNCHANGED — already prop-driven
│   ├── soundBandGeometry.ts               # UNCHANGED — already pitch-parameterized
│   └── physicsPaintStudio.css             # MODIFIED — cell width var, delete 54px fallback
└── hooks/
    ├── usePhysicsPaintRulerScrub.ts       # UNCHANGED — call site passes live pitch
    └── usePhysicsPaintCrossTrackDrag.ts   # UNCHANGED — leave zoom at 1, pass pitch
```

### Pattern 1: Session-only metrics module (mirror the canvas precedent)

**What:** one module owns the scale signal, the derived metrics, the presets, clamping, stepping, anchoring and the reset.
**When to use:** always — this is the phase's core.
**Example:** see Code Examples §1. Shape verified against `physicsPaintCanvasZoom.ts:21-25, 103-128, 192-237, 296-382`:
`export const PHYSICS_PAINT_ZOOM_PRESETS: readonly number[] = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];` and `export const PHYSICS_PAINT_ZOOM_EPSILON = 0.001;` `[VERIFIED: view/physicsPaintCanvasZoom.ts:21-25]`.

### Pattern 2: One-rAF wheel coalescer

**What:** accumulate a pending target scale from the previously *queued* target, apply one store write (scale + anchored scrollLeft) per animation frame.
**When to use:** the Cmd/Ctrl wheel gesture; prevents collapsing a burst into one lost step and bounds per-frame re-renders.
**Example:** `physicsPaintCanvasZoomViewport.tsx:44-102` — `queueZoom` uses `pending?.kind === 'zoom' ? pending.scale : effectiveScale.peek()` as base and `Math.exp(-event.deltaY * 0.0025)` as factor. `[VERIFIED: view/PhysicsPaintCanvasZoomViewport.tsx:51-102]`

### Pattern 3: Narrow leaf subscriptions inside a giant strip

**What:** the strip is 6,817 lines and deliberately insulated from high-frequency updates — the playhead (`PhysicsPaintPlayheadBar`, strip `:1167`) and every sound-stain child (`:2468`, `:2546`, `:2590`) read signals in their own bodies so only they re-render.
**When to use:** the pill MUST be a prop-less leaf (so the memoized static chrome never re-renders); the playhead/stain leaves should read the scale signal themselves.
**Consequence:** the strip body *will* re-render per flush because `rotoLaneWidthPx` feeds five inline widths (`:5626-5628`, `:6195`, `:6275`) and the ruler step changes markup. Coalescing bounds this to ≤1 per frame.

### Pattern 4: Compare-then-write + epsilon no-op

**What:** `setSignal` checks `Object.is` before writing; `nextScalePreset` and `applyAnchoredZoom` both short-circuit inside 0.001.
**When to use:** every zoom write (D-08).
**Example:** `physicsPaintCanvasZoom.ts:232-237` (`function setSignal<T>(target: Signal<T>, value: T): boolean { if (Object.is(target.peek(), value)) return false; ... }`) and `:261` (`if (Math.abs(scale - effectiveScale.peek()) <= PHYSICS_PAINT_ZOOM_EPSILON) return;`). `[VERIFIED: view/physicsPaintCanvasZoom.ts:232-237, 256-280]`

### Anti-Patterns to Avoid

- **A second pitch authority:** any surviving local `× 18`, a module-private `ROW_CELL_WIDTH_PX`, or a CSS `54px`/`16px` that does not derive from the module. This is the exact failure mode the ROADMAP prerequisite guards.
- **`transform: scale` on the timeline:** every drag/scrub/hit-test uses client rects; a transform would double-scale them.
- **Reading zoom inside a per-pointer-event handler:** handlers must read `.peek()`; only render bodies subscribe.
- **Writing `scrollLeft` from a render body:** the wheel coalescer must be an effect/handler, never render.
- **Re-running scroll-to-frame on zoom:** the open/reveal effects must keep their current deps (no scale dep) so a zoom never re-reveals.

## Frame→Pixel Consumer Inventory (live, verified this session)

Classification: **CONVERT** = must read the authority · **PARAM** = already takes a pitch/gap, wire the scaled value · **FIXED** = vertical/header, must not change · **INVARIANT** = DOM-derived, pitch-independent · **CONST** = the duplicated definition to remove/derive.

### 1. The duplicated definitions (must collapse to one)

| Definition | File:line | Verbatim | Class |
|---|---|---|---|
| Strip pitch | `view/PhysicsPaintWorkflowStrip.tsx:647` | `const ROTO_CELL_WIDTH_PX = 18;` | CONST |
| Strip tick width | `view/PhysicsPaintWorkflowStrip.tsx:649` | `const RULER_TICK_WIDTH_PX = RULER_STEP * ROTO_CELL_WIDTH_PX;` | CONST (becomes step × pitch) |
| Track-row pitch | `view/PhysicsPaintTrackRow.tsx:90` | `const ROW_CELL_WIDTH_PX = 18;` | CONST (delete) |
| Track-row literal | `view/PhysicsPaintTrackRow.tsx:785` | `projectPhysicsPaintLoopClipGeometry(continuousRange, { startFrame: 0, endFrameExclusive: capacity }, 18);` | CONST → `props.framePitch` |
| Cell width CSS | `physicsPaintStudio.css:7889` | `width: 16px;` (inside `.physics-paint-roto-cell`) | CONST → var (16 × scale) |
| Ruler tick CSS fallback | `physicsPaintStudio.css:5152` | `flex: 0 0 54px;` | CONST → remove or derive |
| Design tokens | `view/timelineRailDesign.ts:97-113` | `cellWidth: 16, cellHeight: 22, cellRadius: 3, cellPitch: 18, cellGap: 2, ...` | KEEP as base constants; authority multiplies |

### 2. Strip — widths, grid, ruler

| Consumer | Line(s) | Today | Class |
|---|---|---|---|
| Lane extent derivation | `:3042` | `const rotoLaneWidthPx = frameCells.length * ROTO_CELL_WIDTH_PX;` | CONVERT |
| Lane width/minWidth/single grid track | `:5626-5628` | `width: ${rotoLaneWidthPx}px, minWidth: ..., gridTemplateColumns: ${rotoLaneWidthPx}px` | CONVERT |
| Cells grid | `:5697` | ``gridTemplateColumns: `repeat(${frameCells.length}, ${ROTO_CELL_WIDTH_PX}px)` `` | CONVERT |
| Ruler band extent | `:6195` | `style={{ width: `${rotoLaneWidthPx}px`, minWidth: `${rotoLaneWidthPx}px` }}` | CONVERT |
| Rows-region extent | `:6275` | same | CONVERT |
| Ruler tick builder | `:823` | `return frameCells.filter((frame) => frame % RULER_STEP === 0);` | CONVERT (step param) |
| Ruler tick useMemo | `:3073` | `useMemo(() => buildRulerTicks(frameCells), [frameCells])` | CONVERT (step dep) |
| Ruler tick basis (inline) | `:6236` | ``<span ... style={{ flex: `0 0 ${RULER_TICK_WIDTH_PX}px` }}>`` | CONVERT (step × pitch) |
| RULER_STEP | `:643` | `const RULER_STEP = 3;` | KEEP (D-10 minimum step) |

### 3. Strip — playhead

| Consumer | Line(s) | Today | Class |
|---|---|---|---|
| Playhead bar left | `:1179` | `const left = 6 + clampedFrame * ROTO_CELL_WIDTH_PX + 8;` | CONVERT → `6 + f·pitch + pitch/2 − 1` |
| Playhead bar CSS | `css:5181+` area / `.physics-paint-playhead-bar` | 2px bar, 36px band (pinned by `rulerSeek.test.ts:86-97`) | FIXED (bar width stays 2px) |

### 4. Strip — drag / scrub / ghost / paste

| Consumer | Line(s) | Today | Class |
|---|---|---|---|
| Push projection | `:3619` | `return Math.round((clientX - originClientX) / ROTO_CELL_WIDTH_PX);` | CONVERT |
| Rail-set drag projection | `:3766` | same expression | CONVERT |
| Cross-track drag port | `:3922` | `framePitch: ROTO_CELL_WIDTH_PX,` | CONVERT (pass scaled pitch, leave `zoom` at 1) |
| Bg clip drag origin/current | `:4003-4004` | `Math.round((originClientX - contentLeft + scrollLeft) / ROTO_CELL_WIDTH_PX)` | CONVERT |
| Bg drag ghost | `:4020-4021` | `left: destination * ROTO_CELL_WIDTH_PX, width: Math.max(ROTO_CELL_WIDTH_PX, durationFrames * ROTO_CELL_WIDTH_PX)` | CONVERT |
| Bg resize frame | `:4084` | `Math.round((clientX - contentLeft + scrollLeft) / ROTO_CELL_WIDTH_PX)` | CONVERT |
| Bg resize ghosts | `:4093-4094`, `:4101-4102` | `left/width` from `frame * ROTO_CELL_WIDTH_PX` | CONVERT |
| Ruler scrub option | `:4149` | `cellWidthPx: ROTO_CELL_WIDTH_PX,` | CONVERT (hook already accepts it, `usePhysicsPaintRulerScrub.ts:50`) |
| Sound drag delta | `:4268` | `const delta = Math.round(dx / ROTO_CELL_WIDTH_PX);` | CONVERT |
| Push click frame | `:4569` | `const frame = Math.floor(relativeX / ROTO_CELL_WIDTH_PX);` | CONVERT |
| Group ghost | `:5537-5538` | `(rail.intervalStart + preview.delta - frameCells[0]) * ROTO_CELL_WIDTH_PX` | CONVERT |
| Current-frame outline | `:5924` | `left: ${(props.currentFrame - frameCells[0]!) * ROTO_CELL_WIDTH_PX}px` | CONVERT |
| Push armed anchor ghost | `:5938-5939` | left/width × pitch | CONVERT |
| Push drag ghost | `:5954-5955`, `:5970-5973` | left/width × pitch | CONVERT |
| Rail-set drag ghost | `:5993-5994` | left/width × pitch | CONVERT |
| Second push armed ghost | `:6017-6018` | left/width × pitch | CONVERT |
| DOM drag-target classifier | `:5020-5069` | `document.elementFromPoint` + `[data-roto-app-frame]` + cell rect midpoint | INVARIANT |

### 5. Strip — scroll-to-frame, reveal, viewport (audio)

| Consumer | Line(s) | Today | Class |
|---|---|---|---|
| Viewport getter | `:2716-2717` | `visStart: el.scrollLeft / ROTO_CELL_WIDTH_PX, visEnd: (el.scrollLeft + el.clientWidth) / ROTO_CELL_WIDTH_PX` | CONVERT |
| Getter doc comment | `:2655` | `(scrollLeft / ROTO_CELL_WIDTH_PX)` | CONVERT (comment) |
| Open-frame positioning | `:4988-4989` | `if (scroller.scrollWidth < (frame + 1) * ROTO_CELL_WIDTH_PX) return;` then `const target = frame * ROTO_CELL_WIDTH_PX + ROTO_CELL_WIDTH_PX / 2 - scroller.clientWidth / 2;` | CONVERT |
| Reveal positioning | `:5012-5013` | same pair | CONVERT |
| Audio "Fit to view" consumer | `PhysicsPaintStudio.tsx:10854` | `getTimelineViewport: () => getTimelineViewportFrames(),` → `physicsPaintAudioController.ts:252-255` uses `Math.round(visEnd) - Math.round(visStart)` | CONVERT via the getter (no change in the controller) |

### 6. Strip — sound stains and preview

| Consumer | Line(s) | Today | Class |
|---|---|---|---|
| Stain left/width/source/in | `:2470-2480` | `soundStainLeftPx(clip.startFrame, ROTO_CELL_WIDTH_PX)` etc.; `sourceFrames * ROTO_CELL_WIDTH_PX` | CONVERT |
| Edge handles | `:2548-2549` | left/width from pitch; CSS offsets `leftPx - 3`, `leftPx + max(0, widthPx - 5)` (`:2560`, `:2567`) | CONVERT (handles keep fixed px per D-13 spirit) |
| Duplicate ghost | `:2592-2600` | left/width/sourceWidth/in from pitch | CONVERT |
| Live sound preview | `:4191-4193` | `soundStainLeftPx(next.startFrame, ROTO_CELL_WIDTH_PX)`, `soundStainWidthPx(...)`, `next.inFrame * ROTO_CELL_WIDTH_PX` | CONVERT |
| Geometry helpers | `soundBandGeometry.ts:91-98` | `startFrame * cellWidthPx`, `soundSpanFrames(inFrame, outFrame) * cellWidthPx` | PARAM (no change) |

### 7. Rails and motion lanes (Phase 59 surface)

| Consumer | Line(s) | Today | Class |
|---|---|---|---|
| Key Rail pitch prop | strip `:5635` | `framePitch={ROTO_CELL_WIDTH_PX}` | CONVERT |
| Loop Clip pitch prop | strip `:5667` | `framePitch={ROTO_CELL_WIDTH_PX}` | CONVERT |
| Key Rail internals | `PhysicsPaintKeyRail.tsx:56,59,200,215,221` | `(clippedStart - start) * framePitch`, `projectTimelineRailLineWidth(n, framePitch, ...)` | PARAM |
| Loop Clip internals | `PhysicsPaintLoopClipRail.tsx:233,431,475` | `framePitch` flows to geometry | PARAM |
| Loop clip geometry | `physicsPaintLoopClipPresentation.ts:404` | `projectTimelineRailLineWidth(clippedEnd - clippedStart, framePitch, endVisible)` — **omits gap** | PARAM (add scaled gap) |
| Rail line width | `timelineRailDesign.ts:346-353` | `Math.max(pitch - gap, frameCount * pitch - (endVisible ? gap : 0))` | PARAM (pass scaled gap) |
| Motion lane width/cells/keys | `TimelineMotionChannels.tsx:323,338-339,361` | `frameCount * TIMELINE_GEOMETRY.cellPitch`; `frame * cellPitch + (cellWidth - keySize)/2` | CONVERT (pitch prop) |
| Motion curve path | `TimelineMotionChannels.tsx:400-403` | `buildRailMotionCurvePath(lane.channels[0], frameCount, laneHeight, { railId, snapFrames })` — **omits `cellPitch`, defaults to 18** | CONVERT (pass `cellPitch: framePitch`) |
| Curve pitch seam | `roto/railMotionEvaluator.ts:320-321,438` | `readonly cellPitch?: number;` … `const cellPitch = options.cellPitch ?? TIMELINE_GEOMETRY.cellPitch;` | PARAM (ready) |
| Motion outline call | `TimelineMotionChannels.tsx:799-806` | `resolveMotionBlockOutlineRect({ rowTop, rowHeight, laneCount, railStartFrame, railFrameCount })` | CONVERT (pass pitch + gap) |
| Outline rect | `timelineRailDesign.ts:180-208` | `startFrame * TIMELINE_GEOMETRY.cellPitch + half`; `frameCount * cellPitch - cellGap - outlineWidth` | CONVERT (pitch + gap params) |
| Motion key drag | `TimelineMotionKeyDrag.tsx:68,81-82` | `Math.round((clientX - originClientX) / TIMELINE_GEOMETRY.cellPitch)`; ghost `frame * cellPitch + (cellWidth - keySize)/2` | CONVERT (pitch prop) |
| Motion block lane offset | `PhysicsPaintTrackRow.tsx:649` | `marginLeft: railStartFrame * TIMELINE_GEOMETRY.cellPitch` | CONVERT (pitch prop) |
| Motion header cluster | `TimelineMotionChannels.tsx:542-543` | `TIMELINE_MOTION.cellWidth` in the header (185px column) | FIXED |

### 8. TrackRow (non-active rows and the Bg row)

| Consumer | Line(s) | Today | Class |
|---|---|---|---|
| Name cell count | `:882` | `Math.max(1, Math.round(props.width / ROW_CELL_WIDTH_PX))` | CONVERT (width scales, pitch scales → ratio constant; keep for correctness) |
| Cells grid + minWidth | `:1129,1134` | `repeat(${frameCells.length}, ${ROW_CELL_WIDTH_PX}px)`, `frameCells.length * ROW_CELL_WIDTH_PX` | CONVERT |
| Key rail left/width | `:1229,1234` | `firstKeyFrame * ROW_CELL_WIDTH_PX`; `projectTimelineRailLineWidth(n, ROW_CELL_WIDTH_PX, true, ...)` | CONVERT |
| Loop geometry + cell count | `:1303,1306` | `projectPhysicsPaintLoopClipGeometry(..., ROW_CELL_WIDTH_PX)`; `Math.round(geometry.width / ROW_CELL_WIDTH_PX)` | CONVERT |
| Insertion preview | `:1354` | `left: crossInsertionFrame * ROW_CELL_WIDTH_PX` | CONVERT |
| Motion block | `:649`, `:785` | see §7 / §1 | CONVERT |
| Props interface | `:129-226` | **no `framePitch` prop today** | ADD prop |

### 9. Hooks (already parameterized)

| Hook | Line(s) | Verbatim | Class |
|---|---|---|---|
| Ruler scrub | `usePhysicsPaintRulerScrub.ts:49-50,77,96,109` | `readonly cellWidthPx?: number;` / `const DEFAULT_CELL_WIDTH_PX = 18;` / `const cellWidthPx = options.cellWidthPx ?? DEFAULT_CELL_WIDTH_PX;` / `Math.floor((clientX - rectLeft) / cellWidthPx)` | PARAM |
| Cross-track drag | `usePhysicsPaintCrossTrackDrag.ts:96-98,196-205` | `readonly framePitch: number;` / `readonly zoom?: number;` / `const pitch = framePitch * zoom;` | PARAM + WATCH (double-apply risk) |

### 10. Fixed vertical geometry (must NOT change)

| Value | File:line | Verbatim |
|---|---|---|
| Lane row height | `physicsPaintStudio.css:5906` | `height: 31px;` |
| Lane top padding | `physicsPaintStudio.css:5907` | `padding-top: 6px;` |
| Roto cell height | `physicsPaintStudio.css:7892` | `height: 22px;` |
| Ruler band | `physicsPaintStudio.css:5137-5138` | `flex: 0 0 36px;` `height: 36px;` |
| Header column | `physicsPaintStudio.css:5934` | `flex: 0 0 185px;` |
| Scroll gutter | `physicsPaintStudio.css:5095,5104` | `padding-left: 6px;` `scroll-padding-left: 6px;` |
| Motion lane height | `timelineRailDesign.ts:110` | `motionLaneHeight: 18,` |
| Motion cell height | `timelineRailDesign.ts:121-124` | `cellWidth: 16,` `cellHeight: 18,` |
| Motion key size | `timelineRailDesign.ts:125` | `keySize: 6,` |
| Header row height | `physicsPaintWorkflowStrip.tsx:662` | `const STRIP_ROW_HEIGHT_PX = 31;` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preset ladder stepping | A new "nearest preset" walker | Mirror `nextScalePreset` (`physicsPaintCanvasZoom.ts:115-128`) — first preset strictly beyond current with epsilon | D-06 exactness; already tested by 59/60 precedent |
| Clamp + finite guards | Ad-hoc `Math.min/Math.max` per call site | `clampZoomScale` shape (`physicsPaintCanvasZoom.ts:103-108`, finite fallback) | Non-finite deltas from synthetic/test events must not poison the scale |
| Wheel coalescing | A debounce or setTimeout throttle | The rAF coalescer pattern from `PhysicsPaintCanvasZoomViewport.tsx:44-102` | Debounce drops final position; rAF keeps all steps and one write |
| Anchored scroll math | Per-handler pixel arithmetic | One `resolveAnchoredScrollLeft` in the module, used by wheel and pill | Two paths drifting is the classic zoom bug |
| Rail width rule | A local `frames * pitch - 2` | `projectTimelineRailLineWidth(frameCount, pitch, endVisible, gap)` (`timelineRailDesign.ts:346-353`) | The floor and clipped-end branches live there |
| Sound stain math | Local `frame * 18` | `soundStainLeftPx` / `soundStainWidthPx` (`soundBandGeometry.ts:91-98`) | Shared with the band/preview/ghost |
| Ruler seek | A second pointer session | `usePhysicsPaintRulerScrub` (`cellWidthPx` option exists) | rAF-coalesced, capture-safe, thresholded |
| Waveform resampling | A new peak selector | `selectSoundPeaks(peaks, barWidthPx)` (`soundBandGeometry.ts:106`) | Tier rule is byte-for-byte the audio renderer's |
| Row/motion geometry | New constants | `TIMELINE_GEOMETRY` / `TIMELINE_MOTION` base tokens multiplied by the scale | VIS-02 forbids touching the vertical terms |

**Key insight:** the repo already contains a working, tested zoom store for the canvas. The phase's risk is not "how to zoom" — it is "convert all 66 consumers without leaving a second authority".

## Runtime State Inventory

> Required for refactor phases. Phase 60 converts 66 literals, but is session-only.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — zoom is session-only; no `.mce` field, no document store key, no cache key. Verified: no persistence surface in `physicsPaintCanvasZoom.ts`; ZOOM-04 and CONTEXT forbid a persisted field. | none |
| Live service config | **None** — no external service, backend, or UI-held configuration references timeline pitch. | none |
| OS-registered state | **None** — no scheduler/pm2/launchd/registry entry involves view metrics. | none |
| Secrets/env vars | **None** — no secret or env var names reference pitch or zoom. | none |
| Build artifacts | **None** — no package rename, no compiled artifacts carrying the constant; `ROTO_CELL_WIDTH_PX` is a module-private const (`PhysicsPaintWorkflowStrip.tsx:647`, not exported). | none |

**Canonical question — after every file is updated, what runtime systems still hold the old pitch?** Only the live module-level singleton and the DOM/scroll positions of an open Studio. Both are reset by `resetForStudioOpen()` on Studio open (and the Studio window is a fresh document per open, `PhysicsPaintCanvasZoomViewport.tsx:31-37`). No data migration exists or is needed.

## Common Pitfalls

### Pitfall 1: The plain-wheel listener silently swallows Cmd/Ctrl+wheel
**What goes wrong:** Cmd/Ctrl+wheel scrolls the timeline instead of zooming, or worse: the zoom branch is added *after* the guards and the horizontal-dominant guard eats trackpad pinch on some machines.
**Why it happens:** the current handler has no modifier check. Verbatim (`PhysicsPaintWorkflowStrip.tsx:5417-5429`):
`if (!mountedRef.current) return;` / `if (event.shiftKey) return;` / `if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;` / `event.preventDefault();` / `el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1);` `[VERIFIED: view/PhysicsPaintWorkflowStrip.tsx:5417-5429]`
**How to avoid:** insert the modifier branch as the FIRST guard after `mountedRef`: `if (event.metaKey || event.ctrlKey) { event.preventDefault(); queueTimelineZoom(event); return; }`. Keep the remaining three statements byte-identical. Pin the unchanged plain-wheel block with a source-string test.
**Warning signs:** plain-wheel behaviour changes; pinch does not zoom; a wheel over the ruler zooms but over the lanes does not.

### Pitfall 2: Partial conversion — the rail gap does not scale
**What goes wrong:** rails are `frameCount × pitch − 2` instead of `− 2 × scale`. Correct at 1×; 1.5px long at 0.25×, 6px long at 4×.
**Why it happens:** `projectTimelineRailLineWidth`'s fourth parameter defaults to `TIMELINE_GEOMETRY.cellGap` (2). Every call that passes a scaled pitch but not the scaled gap is wrong. Sites: `PhysicsPaintKeyRail.tsx:59,219`, `physicsPaintLoopClipPresentation.ts:404`, `PhysicsPaintTrackRow.tsx:1234`, plus the motion outline (`timelineRailDesign.ts:194-201` uses `cellGap` internally).
**How to avoid:** make gap a required argument in the converted call sites, or pass `metrics.cellGap` explicitly; extend `resolveMotionBlockOutlineRect` with `pitch` **and** `gap`.
**Warning signs:** the zoom-matrix test on "rail extent" passes at 1× and fails at 0.25/4; a 1px white sliver at the rail end at 4×.

### Pitfall 3: The playhead `+8` stays literal
**What goes wrong:** the playhead drifts off-centre at every scale except 1×.
**Why it happens:** `const left = 6 + clampedFrame * ROTO_CELL_WIDTH_PX + 8;` (`PhysicsPaintWorkflowStrip.tsx:1179`) `[VERIFIED: :1176-1179]`.
**How to avoid:** `6 + clampedFrame * pitch + (pitch / 2 - 1)` — reproduces 18/2−1=8 exactly at 1×. Assert at all five presets.
**Warning signs:** playhead increasingly off-centre as you leave 100%.

### Pitfall 4: TrackRow and the header column drift from the active lane
**What goes wrong:** the active lane scales but non-active rows and the Bg row keep 18px cells (or vice versa), producing misaligned columns.
**Why it happens:** `PhysicsPaintTrackRow.tsx` owns `ROW_CELL_WIDTH_PX = 18` (`:90`) and a second literal `18` (`:785`), and its props interface (`:129-226`) has no pitch prop. The header column has no horizontal pitch (grep confirms), so only the rows and the motion block matter.
**How to avoid:** add `framePitch: number` to `PhysicsPaintTrackRowProps`, pass the live pitch from the strip's two render sites (`:6346`, `:6378`), delete the constant, fix `:785`.
**Warning signs:** the row grid looks narrower/wider than the active lane while zoomed.

### Pitfall 5: Phase-59 motion lanes are a second, unnoticed pitch family
**What goes wrong:** motion keys and curves stay at 18px inside a scaled cell; the motion block outline is the wrong length.
**Why it happens:** `TimelineMotionChannels.tsx` derives lane width, cell left, and key left from `TIMELINE_GEOMETRY.cellPitch` (`:323`, `:338-339`, `:361`) and calls `buildRailMotionCurvePath` **without** `cellPitch` (`:400-403`), so the curve stays at 18px even if the cells scale. `TimelineMotionKeyDrag.tsx:68` divides by the same token. `resolveMotionBlockOutlineRect` has no pitch parameter (`timelineRailDesign.ts:180-208`).
**How to avoid:** add `framePitch` to `TimelineMotionChannelLaneProps`, to `TimelineMotionKeyDragLaneProps`, and to the outline input; pass `cellPitch: framePitch` to `buildRailMotionCurvePath` (the option already exists, `railMotionEvaluator.ts:320-321,438`). Keep the header cluster (`:542-543`) and lane height fixed.
**Warning signs:** motion keys visibly off their frame cells at any non-1× scale; curve and keys disagree at 2×.

### Pitfall 6: `usePhysicsPaintCrossTrackDrag`'s latent `zoom` seam double-scales
**What goes wrong:** pitch becomes `framePitch × zoom` with `framePitch` already scaled → pitch² behaviour.
**Why it happens:** `readonly framePitch: number; readonly zoom?: number;` and `const pitch = framePitch * zoom;` (`usePhysicsPaintCrossTrackDrag.ts:96-98,196-205`) `[VERIFIED]`.
**How to avoid:** pass the **scaled** pitch as `framePitch` and leave `zoom` undefined (defaults to 1); do not also pass the scale. Add a unit test that pins `computeInsertionFrame(x, 0, 1, 18)` unchanged and a second at `framePitch = 36`.
**Warning signs:** cross-track insertion line at half/double the expected frame while zoomed.

### Pitfall 7: Ruler example vs. rule (0.25× is 9 frames, not 6)
**What goes wrong:** implementing the illustrative sequence "6, 12, 24" from CONTEXT D-09 instead of the stated rule.
**Why it happens:** the rule is "smallest multiple of 3 with ≥40px per tick". At 0.25× pitch is 4.5px: 3→13.5, 6→27, 9→40.5, so the correct step is **9** frames (40.5px). At 0.5×: 6×9=54 (step 6). At 0.75×: 3×13.5=40.5 (step 3). At 1×/2×/4×: step 3 (54/108/216px).
**How to avoid:** implement `resolveRulerStep(pitch) = smallest {3k : 3k × pitch ≥ 40}`; test the exact table above. Never subdivide below 3 (D-10).
**Warning signs:** a 27px tick at 0.25× (labels touching), or a step that changes at 2×.

### Pitfall 8: Source-string pins fail the moment pitch is derived
**What goes wrong:** the suite goes red before any behaviour is wrong.
**Why it happens:** the repo pins literals. Exact pins to repoint (not delete):
- `view/PhysicsPaintWorkflowStrip.test.ts:942` — `expect(code).toContain('ROTO_CELL_WIDTH_PX = 18');`
- `:946` — `expect(code).toContain('const rotoLaneWidthPx = frameCells.length * ROTO_CELL_WIDTH_PX;')`
- `:955` — grid template inline string with `ROTO_CELL_WIDTH_PX`
- `:963` — `repeat(${frameCells.length}, ${ROTO_CELL_WIDTH_PX}px)`
- `:973` and `:1432` — `.physics-paint-ruler-tick {` block contains `54px`
- `:2016` and `:2024` — push `projectDestination` block contains `ROTO_CELL_WIDTH_PX`
- `view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts:65-67` — playhead block contains `6 +`, `ROTO_CELL_WIDTH_PX`, `+ 8`
- adjacent but should keep passing at default scale: `:488-492` (cell height 22, no `repeat(120, 18px)`), `timelineRailDesign.test.ts:351` (default 18 pitch), `TimelineMotionChannels.test.ts:502` (18px pitch), `usePhysicsPaintCrossTrackDrag.test.ts:205`
**How to avoid:** repoint each to the authority (e.g. assert the strip contains `timelineMetrics().pitch` / `metrics.cellWidth` and the module contains `cellPitch: 18`), and add the zoom-matrix test after the audit reaches zero (ROADMAP prerequisite ordering).
**Warning signs:** red suite in plan 1 before any runtime change.

### Pitfall 9: Scroll-snap fights the anchored scrollLeft
**What goes wrong:** after a zoom write, the browser re-snaps the mandatory snap container to the nearest cell start, moving the anchored frame by up to half a pitch.
**Why it happens:** `.physics-paint-timeline-scroll` sets `scroll-snap-type: x mandatory;` and every cell is `scroll-snap-align: start` (`css:5103`, `css:7907`).
**How to avoid:** assert the anchor in a live UAT row at 0.25× and 4×; if it drifts, temporarily relax `scroll-snap-type` to `proximity` for the gesture or re-apply `scrollLeft` after the layout commits. Treat this as a verification item, not a pre-emptive rewrite (the shipped scroll-to-frame already writes arbitrary `scrollLeft` in this container).
**Warning signs:** cursor-anchored frame off by up to half a cell after one wheel tick.

### Pitfall 10: Sound-stain sampling density and fixed edge offsets
**What goes wrong:** waveform looks blocky at 0.25×; at 4× the peak array selection changes tier and cost grows 4×; edge handles (`leftPx − 3`, `widthPx − 5`) can sit outside a tiny clip.
**Why it happens:** `sourceWidthPx = sourceFrames * pitch` feeds `selectSoundPeaks(peaks, sourceWidthPx)` (`strip:2479-2481`), whose tier rule uses `pixelsPerPeak` (`soundBandGeometry.ts:106-111`); edge offsets are fixed px (`strip:2560,2567`).
**How to avoid:** keep the pitch multiplication (correct), verify tier selection stays sane at both ends; leave the handle offsets fixed (D-13 spirit) but confirm a 1-frame clip at 0.25× still shows both handles.
**Warning signs:** missing waveform at extreme zoom; handles outside the stain.

### Pitfall 11: `physics-paint-roto-cell { width: 16px }` vs the inline 18px grid
**What goes wrong:** the grid column scales but the cell inside stays 16px (or the reverse), so the gap looks wrong at every non-1× scale.
**Why it happens:** two independent declarations — CSS width (`css:7889`) and the inline `repeat(n, 18px)` (`strip:5697`).
**How to avoid:** one inline custom property on the cells grid (e.g. `style={{ '--timeline-cell-width': `${metrics.cellWidth}px` }}`) plus `width: var(--timeline-cell-width, 16px)` in CSS; the gap is the track width minus cell width, so both derive from the module. This is the sanctioned CSS-variable use.
**Warning signs:** cells touching at 4× or a widening gap at 0.25×.

### Pitfall 12: Remembering the 6px gutter only sometimes
**What goes wrong:** cursor-anchored zoom drifts by 6px per gesture; hit-testing is off by one frame near frame 0.
**Why it happens:** the scroller has `padding-left: 6px`; content x is `clientX − rect.left + scrollLeft − 6`.
**How to avoid:** put the gutter inside the module (`LANE_ORIGIN_PX = 6`) and use `frameToPx`/`pxToFrame` everywhere; never recompute locally.
**Warning signs:** consistent one-direction drift proportional to zoom delta.

### Pitfall 13: Re-firing scroll-to-frame/reveal on zoom
**What goes wrong:** zooming snaps the viewport back to the open frame or the last reveal request.
**Why it happens:** the effects at `:4986-4996` and `:5004-5016` use positioned guards/nonces; adding `scale` to their deps would re-run them.
**How to avoid:** read the live pitch inside the effects but do not add scale to the dependency arrays (their current deps are `props.timelineOpenFrame, props.rotoPhysicalCells.length, updateScrollbar` and the nonce).
**Warning signs:** the viewport jumps after a zoom while a reveal request is recent.

### Pitfall 14: Per-event strip re-render during wheel
**What goes wrong:** jank on a 6,817-line component with ~n cells × rows.
**Why it happens:** every wheel event writes a subscribed signal; the strip body reads it for `rotoLaneWidthPx`.
**How to avoid:** rAF-coalesce (Pattern 2); one write per frame. Optionally keep the pill, playhead and stains as narrow leaves (they already are). Do not "optimize" by moving pitch into CSS vars for JS-derived values — that creates the second authority.
**Warning signs:** dropped frames while wheel-zooming with several tracks expanded.

## Code Examples

### 1. Metrics module skeleton (mirrors the canvas precedent)

```ts
// Source: pattern verified in view/physicsPaintCanvasZoom.ts:21-25, 103-128, 232-237, 296-382
import { computed, signal } from '@preact/signals';
import { TIMELINE_GEOMETRY } from './timelineRailDesign';

export const TIMELINE_ZOOM_PRESETS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
export const TIMELINE_ZOOM_MIN = 0.25;
export const TIMELINE_ZOOM_MAX = 4;
export const TIMELINE_ZOOM_EPSILON = 0.001;
export const TIMELINE_LANE_ORIGIN_PX = 6;      // css:5095 padding-left
export const TIMELINE_RULER_MIN_TICK_PX = 40;  // D-09

export interface TimelineMetrics {
  readonly scale: number;
  readonly cellWidth: number; // TIMELINE_GEOMETRY.cellWidth * scale
  readonly cellGap: number;   // TIMELINE_GEOMETRY.cellGap * scale
  readonly pitch: number;     // TIMELINE_GEOMETRY.cellPitch * scale
}

export function resolveTimelineMetrics(scale: number): TimelineMetrics {
  const s = clampTimelineZoomScale(scale);
  return {
    scale: s,
    cellWidth: TIMELINE_GEOMETRY.cellWidth * s,
    cellGap: TIMELINE_GEOMETRY.cellGap * s,
    pitch: TIMELINE_GEOMETRY.cellPitch * s,
  };
}

// D-09/D-10: smallest multiple of RULER_STEP leaving >= 40px per tick; never subdivides.
export function resolveRulerStep(pitch: number): number {
  let step = 3;
  while (step * pitch < TIMELINE_RULER_MIN_TICK_PX) step += 3;
  return step;
}

// Wheel anchor (derived from ARCHITECTURE §3.5 + the 6px gutter).
export function resolveAnchoredScrollLeft(input: {
  scrollLeft: number; clientX: number; scrollerLeft: number;
  oldPitch: number; newPitch: number;
}): number {
  const localX = input.clientX - input.scrollerLeft - TIMELINE_LANE_ORIGIN_PX;
  const frameFloat = (input.scrollLeft + localX) / input.oldPitch;
  return frameFloat * input.newPitch - localX;
}
```

### 2. Wheel handler insertion (before the three unchanged guards)

```ts
// Source: the existing handler at view/PhysicsPaintWorkflowStrip.tsx:5417-5429
const handleTimelineWheel = (event: WheelEvent) => {
  if (!mountedRef.current) return;
  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    const normalized = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    queueTimelineZoom({
      // ~x1.1 per 100px; canvas precedent uses exp(-dy * 0.0025) at :91
      scale: timelineZoom.scale.peek() * Math.exp(-normalized * 0.001),
      clientX: event.clientX,
    });
    return;                       // D-07: pinch never falls through
  }
  if (event.shiftKey) return;     // unchanged
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return; // unchanged
  event.preventDefault();
  el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1); // unchanged
};
```

### 3. Pill leaf (grammar copied from the shipped canvas pill)

```tsx
// Source: view/PhysicsPaintCanvasZoomBar.tsx:109-167 (role=group, Minus, percent span, Plus, Fit)
import { Minus, Plus } from 'lucide-preact';

export function PhysicsPaintTimelineZoomBar() {
  const percent = timelineZoom.percent.value;   // rounded integer (D-03)
  const isAtMin = timelineZoom.isAtMin.value;
  const isAtMax = timelineZoom.isAtMax.value;
  return (
    <div class="physics-paint-pill physics-paint-pill--navigation" role="group" aria-label="Timeline zoom">
      <button type="button" class="physics-paint-nav-button" aria-label="Zoom out" disabled={isAtMin}
        onClick={() => timelineZoom.zoomOut()}><Minus size={14} aria-hidden="true" /></button>
      <span class="physics-paint-canvas-zoom-percent" aria-label="Zoom level">{percent}%</span>
      <button type="button" class="physics-paint-nav-button" aria-label="Zoom in" disabled={isAtMax}
        onClick={() => timelineZoom.zoomIn()}><Plus size={14} aria-hidden="true" /></button>
      <button type="button" class="physics-paint-nav-button" onClick={() => timelineZoom.fit()}>Fit</button>
    </div>
  );
}
```

### 4. Ruler step table (the acceptance numbers)

```ts
// pitch = 18 * scale; step = smallest 3k with 3k*pitch >= 40
// scale 0.25 -> pitch 4.5  -> step 9  -> tick 40.5px
// scale 0.5  -> pitch 9    -> step 6  -> tick 54px
// scale 0.75 -> pitch 13.5 -> step 3  -> tick 40.5px
// scale 1    -> pitch 18   -> step 3  -> tick 54px   (byte-identical today)
// scale 2    -> pitch 36   -> step 3  -> tick 108px
// scale 4    -> pitch 72   -> step 3  -> tick 216px
```

### 5. Playhead formula at the five presets

```ts
// left = 6 + frame * pitch + pitch / 2 - 1
// scale 1, frame 10 -> 6 + 180 + 8    = 194  (today's literal expression)
// scale 0.25, frame 10 -> 6 + 45 + 1.25 = 52.25
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Duplicated pitch literals | Single module + derived metrics | This phase | Required by ZOOM-05; no external libraries involved |
| `transform: scale` for view zoom | Real layout geometry (CSS width/flex/left) | Canvas zoom, shipped v2.0.1 | Transform double-scales client-rect math; timeline follows the same law |
| Debounced wheel | rAF-coalesced writes | Canvas zoom precedent | Keeps every accumulated step; one store write per frame |

**Deprecated/outdated:**
- `RULER_TICK_WIDTH_PX` and `ROW_CELL_WIDTH_PX` as module constants — both become derived values.
- The `.physics-paint-ruler-tick { flex: 0 0 54px }` CSS fallback — it must not survive as an independent authority (the inline basis already overrides it today, per its own comment at `css:5148-5151`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Math.exp(-normalizedDelta * 0.001)` gives the intended "~×1.1 per 100px" feel (≈×1.105 per 100px; ≈×1.0105 per 10px wheel notch) | Code Examples §2 | Gesture feels too fast/slow; a constant tweak only, no architecture change |
| A2 | Scroll-snap re-application does not defeat a programmatic anchored `scrollLeft` (the shipped scroll-to-frame already writes arbitrary offsets) | Pitfall 9 | Cursor anchor drifts up to half a cell; mitigation described |
| A3 | Re-rendering the strip once per rAF flush is acceptable with the current cell/row counts | Pitfall 14 | Wheel jank; mitigate by extracting the ruler band into a leaf |
| A4 | Line-mode wheels normalize at 16px per line, matching the existing plain-wheel branch | Code Examples §2 | Firefox zoom speed differs by ~5×; one-constant fix |
| A5 | The pill can sit between the playback pill and the status capsule without breaking the header order pins (`navigation < playback < capsule < Close`) | Architecture Patterns | Pin repoint/placement adjustment only |
| A6 | Fit should divide by the scroller client width minus the 6px gutter, using the whole frame range (`frameCells.length`) | Architecture Patterns | Fit lands 1–5% off; UAT-visible only |

## Open Questions (RESOLVED)

1. **Where exactly in the header row does the pill go?** (Claude's discretion, D-01.) — RESOLVED: 60-01 task 3 inserts it immediately after the playback pill and before `<PhysicsPaintWorkflowLiveStatus>`; the pinned header order still holds.
   - What we know: the header order is pinned as navigation → playback → capsule → Close (`PhysicsPaintWorkflowStrip.test.ts:1103-1116`); the capsule is `flex: 1 1 auto` (`css:3923`).
   - Recommendation: insert immediately after the playback pill (`.physics-paint-pill--playback`) and before `<PhysicsPaintWorkflowLiveStatus>`; the pinned inequalities still hold.

2. **Module API shape: signals + `timelineMetrics()` vs a pure metrics function only?** — RESOLVED: 60-01 task 1 exports the store object plus pure helpers.
   - What we know: CONTEXT leaves the shape open; the canvas precedent exports a store object plus pure helpers; consumers include module-level stain components.
   - Recommendation: export the store object (`scale`, `percent`, `isAtMin`, `isAtMax`, `metrics` computed) plus pure helpers (`resolveTimelineMetrics`, `resolveRulerStep`, `resolveAnchoredScrollLeft`, `resolveCursorAnchorLocalX`, `resolvePlayheadAnchorLocalX`, `frameToPx`, `pxToFrame`, `resolveTimelineViewportFrames`); keep pure functions pure for the matrix test.

3. **Does the header column need any change?** — RESOLVED: no change; 60-04 keeps every vertical token and edits no header-column file.
   - What we know: grep finds no horizontal pitch in `physicsPaintTrackHeaderColumn.tsx`; rows are vertical only.
   - Recommendation: no pitch change; only confirm the row-height lockstep note (VIS-02 untouched).

4. **Should `TimelineMotionChannels` read the module or take a prop?** — RESOLVED: 60-04 task 1 makes `framePitch` and `frameGap` required props with no defaults.
   - What we know: it is rendered from `PhysicsPaintTrackRow` (`:1364`) and its lane/key geometry is fully pitch-derived; unit tests render it directly.
   - Recommendation: prop (`framePitch`) with no default, so tests stay explicit and module state never leaks into pure component tests.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest, pnpm scripts | ✓ | v24.15.0 | — |
| pnpm | workspace test command | ✓ | 10.27.0 | `npx vitest run` inside `app/` |
| vitest | all phase tests | ✓ | ^2.1.9 (`app/package.json:52`) | — |
| Tauri/webview runtime | live UAT rows (wheel/pinch) | ✓ (dev build exists) | — | Automated math tests cover the matrix; wheel/pinch anchoring is human UAT |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. No network-only tooling is needed; all research was codebase-internal.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^2.1.9` (`app/package.json:52`) |
| Config file | `app/vitest.config.ts` (project default; do not add a one-off config) |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

**Critical repo rule:** vitest collects only `.test.ts` files — a `.test.tsx` verify target exits 0 while running nothing (memory: `project_vitest_collects_test_ts_only`). Keep new tests `.test.ts` and render components through the existing node-environment harness used by `TimelineMotionChannels.test.ts`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ZOOM-01 | `resolveAnchoredScrollLeft` keeps `pxToFrame(scrollLeft + localX)` invariant across a scale change (incl. the 6px gutter) | unit | `vitest run .../physicsPaintTimelineZoom.test.ts -t "anchored"` | ❌ Wave 0 |
| ZOOM-01 | Wheel factor: `exp(-delta*0.001)` normalized for `deltaMode===1`; clamped 0.25–4 | unit | `... -t "wheel factor"` | ❌ Wave 0 |
| ZOOM-02 | Presets `[0.25,0.5,0.75,1,1.5,2,3,4]`; `nextTimelineZoomPreset(1.37,+1)=1.5`, `(1.37,-1)=1`; ends disabled | unit | `... -t "preset"` | ❌ Wave 0 |
| ZOOM-02 | Fit = `clamp(viewportFrames / frameCount)`, one-shot, clamped into range | unit | `... -t "fit"` | ❌ Wave 0 |
| ZOOM-02 | Pill host + display-only percent + Fit aria-pressed (source contract) | source-string | `vitest run .../physicsPaintTimelineZoomWiring.test.ts` | ❌ Wave 0 |
| ZOOM-03 | At every preset: pitch changes, row/lane/cell heights do not (matrix asserts height constants absent from the scaled outputs) | unit | `... -t "vertical fixed"` | ❌ Wave 0 |
| ZOOM-04 | `resetForStudioOpen()` returns scale to 1; wiring test pins the call at the Studio mount seam | unit + source-string | `... -t "reset"` + wiring test | ❌ Wave 0 |
| ZOOM-05 | Zoom matrix at 0.25/0.5/1/2/4: playhead centre, hit-test frame, ruler extent, sound stain left/width, Loop Clip extent, audio visible range | unit (pure helpers) | `vitest run .../PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` | ❌ Wave 0 (write only after literal-`18` audit = 0) |
| ZOOM-05 | No local `× 18`: source audit finds zero pitch literals outside the module and the base tokens | source-string | `... -t "single authority"` | ❌ Wave 0 |
| ZOOM-05 | Repointed pins: strip no longer contains `ROTO_CELL_WIDTH_PX = 18`; ruler/playhead/grid assertions target the authority | source-string | repointed `PhysicsPaintWorkflowStrip.test.ts` / `.rulerSeek.test.ts` | ✅ repoint |

**Matrix predicates (write these as the acceptance surface):** with `P = 18·s`, `CW = 16·s`, `G = 2·s`,
- playhead centre: `6 + f·P + P/2 − 1` (equals `6 + f·18 + 8` at s = 1)
- hit-test: `floor((x − 6 + scrollLeft)/P)` vs `frameToPx` round-trip
- ruler: `step = min{3k : 3k·P ≥ 40}`, tick extent `step·P` (54 at 1×)
- sound stain: left `start·P`, width `(out−in)·P` (helpers already)
- Loop Clip: left `(clippedStart − windowStart)·P`, width `n·P − G` (or full extent when clipped)
- audio range: `visStart = scrollLeft/P`, `visEnd = (scrollLeft + clientWidth)/P`

### Sampling Rate
- **Per task commit:** `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts`
- **Per wave merge:** full suite command above
- **Phase gate:** full suite green before `/gsd-verify-work`; live UAT rows for wheel anchoring and pinch

### Wave 0 Gaps
- [ ] `app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts` — module math, presets, ruler step, fit, anchor, viewport frames (covers ZOOM-01/02/04)
- [ ] `app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts` — reset seam, pill host, display-only percent, wheel-branch source contract (mirrors `physicsPaintCanvasZoomWiring.test.ts` shape)
- [ ] `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` — the five-level matrix (write LAST, after the literal audit reaches zero)
- [ ] Repoint the 9 existing pin assertions listed in Pitfall 8
- [ ] No framework install needed — vitest is present

## Security Domain

> `workflow.security_enforcement` is absent from `.planning/config.json` → treat security as enabled. This phase adds no network, auth, persistence, or crypto surface; the relevant ASVS controls are input validation on the gesture path.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no (session-only view state, no identity) | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Finite-number guards + clamp in the zoom module; `Math.exp` on a normalized delta; no `innerHTML`/HTML string construction from event data |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-finite / hostile wheel delta poisoning the scale | Tampering | `Number.isFinite` + clamp to [0.25, 4] before any write (canvas precedent `clampZoomScale`) |
| Extreme scale causing layout DoS (huge `scrollWidth`) | Denial of Service | Max 4× bounded; `frameCells.length` already bounded by engine frame limits (`buildRotoTimelineStructuralIndex` throws above the max) |
| CSS injection via style strings | Tampering | Only numeric px strings produced by the module; no user-controlled text in styles |
| Stale cross-document zoom leakage | Information disclosure (minor) | `resetForStudioOpen()` on Studio mount; module is per-window |

## Sources

### Primary (HIGH confidence — opened and read this session)
- `app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts:21-25,103-128,232-237,256-280,296-382` — presets, clamp, epsilon, next-preset, compare-then-write, reset
- `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx:28-37,44-102` — reset seam, rAF coalescer, exponential wheel factor
- `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx:109-167` — pill markup grammar (Minus/percent span/Plus/Fit)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:643-662,823,1167-1179,2655-2721,3042,3073,3619-4569,4986-5016,5020-5069,5417-5429,5537-6018,5626-5697,6195,6236,6275,6346,6378` — every pitch consumer
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:90,129-226,649,785,882,1129-1134,1229-1234,1303-1306,1354`
- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx:323,338-339,361,400-403,542-543,799-806`
- `app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx:68,81-82`
- `app/src/components/physic-paint/view/timelineRailDesign.ts:97-151,180-208,346-353`
- `app/src/components/physic-paint/roto/railMotionEvaluator.ts:320-321,438`
- `app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts:49-50,77,96,109`
- `app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.ts:96-98,196-205`
- `app/src/components/physic-paint/view/soundBandGeometry.ts:86-111`
- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts:387-410`
- `app/src/components/physic-paint/physicsPaintStudio.css:1027-1096,3897-4013,5079-5105,5132-5189,5898-5941,7882-7908`
- `app/package.json:22,32,35,52` — dependency versions
- Pin tests: `PhysicsPaintWorkflowStrip.test.ts:942-975,1116,1420-1432,2010-2029`; `PhysicsPaintWorkflowStrip.rulerSeek.test.ts:60-68`; `physicsPaintCanvasZoomWiring.test.ts:46-47,98`

### Secondary (MEDIUM confidence — project research docs, line numbers now stale)
- `.planning/research/ARCHITECTURE.md` §3 — metrics module recommendation, anchoring formulas, what-scales table
- `.planning/research/PITFALLS.md` — Pitfall 8 (66 literals), 9 (half-cell), 10 (materialization), 15 (zoom into document)
- `.planning/research/SUMMARY.md` — "targeted decision, not full research"

### Tertiary (LOW confidence)
- None. No web search or external documentation was needed; every claim is in-repo and read this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; versions read from `app/package.json`
- Architecture: HIGH — the authority module mirrors a shipped, working precedent; every consumer enumerated live
- Pitfalls: HIGH for the codebase-specific ones (all cited to read lines); MEDIUM for scroll-snap interaction (A2) and wheel feel (A1/A4), which are live-UAT judged
- Code examples: HIGH for the copied patterns; the exponential constant is a starting point (A1)

**Research date:** 2026-11-09
**Valid until:** 2026-12-09 (30 days — in-repo code; re-verify line numbers if Phase 60 planning slips past a Phase 59 follow-up)

---

*Phase: 60-studio-timeline-horizontal-zoom*
*Research completed: 2026-11-09*
*Ready for planning: yes*
