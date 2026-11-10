# Phase 61: Vector Painting Tool - Research

**Researched:** 2026-11-10
**Domain:** Dual-representation paint strokes (path geometry) inside a single watercolour engine; deterministic re-bake; dual-language persistence
**Confidence:** MEDIUM — HIGH on renderer locus, sampling law, persistence chain and UI integration points (all file-read this session); LOW on cost measurement (no measured baseline exists; the spike must produce it) and on any claim about a second *deposit mode*'s visual quality (unbuilt).

## Summary

The ROADMAP is right that the renderer is the risk, and the research sharpens *why*. The live and bake renderers are **the same vendored `WatercolorEngine` script pipeline** — `scriptBegin` / `scriptMove` / `engine.tick(HOST_DT)` — not a stamp loop in `aquarelleBake.ts` and not `deposit.ts`. `aquarelleBake.ts` only orchestrates ticks and captures; it never stamps. Everything that determines what a vector stroke *looks like* therefore lives in `packages/efx-watercolor/src/playground/Engine.ts`: `trace()` lays dabs by arc length, `stamp()` decides ink/wet, and the ink pass is **additive** (`blendFunc(ONE, ONE)`), which is why overlapping dabs do not band today. A clean ribbon that breaks that additive-overlap law will bead; a ribbon that keeps it is seamless by construction.

Per-vertex width is the one thing the existing script API cannot express. `scriptBegin` has a `maxRadius` argument, but it sets a per-stroke `scriptScale` **capped at 1** (`Math.min(1, maxRadius / this.radius(tool, 1, 0))`), and `scriptMove` carries no width at all. So "segment runs" (one `scriptBegin`/`scriptEnd` pair per width segment) is the no-engine-change option, and it is structurally seam-prone: `scriptEnd` destroys the `Stroke`, resetting `s.travelled` (which feeds the brush reservoir `exp(-s.travelled / …)`) and `s.carry` (which carries dab-spacing phase across segments). The payload-extension option — an optional per-sample width that multiplies into `radius()` — keeps one continuous `Stroke` and avoids both resets. That is the spike's central A/B.

Persistence produced the highest-value surprise and one explicit decision-grade contradiction: **vector fields do not currently persist "in both TS and Rust"**. Strokes persist as an explicit AQTL v1 binary (fixed engine block, no generic passthrough) inside a SNAP v5 container, and Rust (`studio_script_snapshot.rs`) stores those bytes opaquely and "never parses the container". `MceEngineStrokePayload` is a declaration-only contract member. REL-02 can still be satisfied — by declaring matching `Mce*` members in both languages for the field-diff pin (exactly the Phase 56 precedent) — but the actual persistence work is an **AQTL version bump in TS**, plus a TS-side round-trip pin. Planning this as "add a field to two files" would fail at the first reopen.

Finally, the wireframe-as-performance-mode mechanism **already exists** and is shipped: Move/Edit **Draft** mode (quick 261101-o2m). Draft is a session-only signal in `scriptStrokeEdition.ts`, read only via `.peek()` in Studio event handlers, that suspends engine re-render and gates every capture/flush/settle/persist path, with a `draftPixelsDirty` correctness invariant and a cross-realm gate so the main realm cannot autosave a stale sidecar. Phase 61 should extend that law rather than invent a second suspension mechanism.

**Primary recommendation:** Run Wave 0 as a `probe/` harness cloned from `packages/efx-watercolor/probe/watercolor-opacity/` that measures segment-runs vs payload-extension on seam continuity, dab-count cost and byte-identity; then build the data model as `AquarelleStrokePayload` fields (opaque `engine: P`) persisted through an AQTL **v2** with `renderMode` defaulting to `watercolor`, and implement the wireframe by generalising the existing Draft gate.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Milestone-locked (carried in, NOT re-asked)

These were settled before this discussion and must not be reopened by research or planning:

- **VEC-01..07 are the requirement set.** `pen-tool` draws with corner and smooth points; `spline-pointer` edits anchors, coupled handles, handle break, insert, delete and multi-select; width varies per vertex; brush type and colour are **per stroke**; a wireframe toggle doubles as the drag-time performance mode; vector strokes persist, reopen and export; undo/redo covers each vector operation.
- **Per-vertex means width only.** There is no per-vertex brush type and no per-vertex colour (ROADMAP success criterion 2).
- **`pen-tool` / `spline-pointer` are lucide icons** and the two named toggle states (milestone §5.3).
- **The renderer is the scope risk, not the pen tool.** The ROADMAP mandates a spike before the data model is locked: per-vertex watercolour feasibility (segment runs vs payload extension), the sampling law, seam quality, stroke-count cost, and the determinism pin.
- **REL-01 holds** — no new runtime dependencies. **REL-02 applies to every new vector field in both TS and Rust.** REL-03 and REL-04 are not involved.
- **Determinism law holds** — 60 Hz integer tick grid, FNV-1a `traceSeed`, no `Math.random()` in the deposit or simulation path.
- **Hide/solo, ordering, opacity and background behaviour are preserved** for vector strokes (ROADMAP success criterion 4).
- **No B-spline.** An approximating basis misses the points you place; the same argument that rejected B-spline on Phase 59 motion channels applies to a drawn path.

#### Curve model

- **D-01:** A vector stroke supports exactly **two anchor kinds**: a **Bézier anchor** carrying its own coupled handles (with handle break), and an **auto-smooth anchor** whose handles are derived from its neighbours. One persisted discriminator, no third state. — **Reversibility:** one-way — the anchor kind is a persisted `.mce` field pinned byte-identically by REL-02 in both the TS interface and the Rust struct; adding or renaming a kind later needs a document migration and a dual-language encoder change.
- **D-02:** While drawing, **every placed point is auto-smooth by default**; holding **Alt** places a hard corner. The path flows through the clicks with no handle work unless the user interrupts it.
- **D-03:** **Grabbing an auto-smooth anchor's derived tangent promotes that anchor to a Bézier anchor, permanently.** Auto-smooth anchors draw no handles. The rule is "the moment you take control, you own it" — there is no auto-with-override state, so the parser only ever sees two kinds.
- **D-04:** Hermite, TCB, and a user-selectable Catmull-Rom were **rejected** as curve families. Auto-smooth already delivers the interpolating auto-tangent case they were there to cover.

#### Vector mode entry

- **D-05:** The vector pen is a **5th entry in `AquarelleToolRow`** (lucide `PenTool`), visually separated from the four watercolor tools. The row already contains a watercolor tool named `pen` bound to `P`, so the vector entry needs a **distinct label and a non-`P` shortcut**. — **Reversibility:** reversible — one more button in a static row.
- **D-06:** **Two distinct controls, never a toggling button.** The tool-row button always means *draw*; the **spline-pointer button in the Stroke Settings dialog header** always means *edit the selected path*. Picking a paint tool or the vector tool leaves edit mode and returns to drawing. This resolves the cold-start problem: the modal only opens on an existing selection, so it cannot be the way in.
- **D-07:** **Paths are always open.** Enter or double-click finishes the path; clicking the first anchor finishes there rather than closing. No `closed` flag, no fill, no join-back segment.

#### Per-vertex width

- **D-08:** Width is authored with a **numeric stepper in the Stroke Settings dialog** for the selected anchors, reusing `SliderStepper`. The canvas shows the resulting width as a **per-vertex width envelope** so the value is visible, not just typed.
- **D-09:** A vertex width is a **multiplier of the stroke's brush size** (e.g. 1.0 / 0.4 / 1.8), matching the engine's existing `toolOverrides` multiplier vocabulary so the brush Size control still rescales the whole stroke coherently.
- **D-10:** Width storage is **sparse** — an anchor carries a factor only once it is edited; untouched anchors interpolate from their nearest set neighbours. **A uniformly-wide vector stroke writes no width data at all**, keeping the payload minimal and the stroke byte-identical in shape to a plain one (the project's conditional-canonical-term pattern). — **Reversibility:** costly — inserting and deleting anchors has to remap or deliberately not remap the sparse factors, and both the TS and Rust encoders must agree on what an absent factor means.

#### Render model

- **D-11:** **ONE ENGINE.** The clean ribbon is a **deposit mode inside `efx-watercolor`**, not a second renderer and not a second engine. Every engine law applies to both modes: the 60 Hz integer tick grid, the FNV-1a `traceSeed`, the fixed bake path, and no `Math.random()` in deposit or simulation.
- **D-12:** `renderMode` (`watercolor` | `simple-ribbon`) is an **explicit per-stroke persisted discriminator**. Any brush can render either way. A **new `simple-ribbon` brush preset** ships in the brush list so the simple path is one click away; picking it selects simple mode by default, and any stroke can be flipped afterwards. — **Reversibility:** one-way — `renderMode` is a persisted `.mce` field in both languages; the engine must also keep rendering `watercolor` documents identically, so the default and the absent-means-watercolor rule are pinned by REL-02.
- **D-13:** Simple-ribbon **exposes Size, per-vertex width, Colour and Opacity**. The seven wet globals — **Water, Load, Flow, Bleed, Dry, Edge, Granulation** — live in a **collapsed advanced section and sit at zero** in simple mode. Raising any of them deliberately blends physics into the plain ribbon (a mixed simple-ribbon/watercolor stroke); the engine needs no separate parameter bag for this, because the bag is the same eight globals.
- **D-14:** The render mode applies to **both vector and hand-painted strokes**. Both produce a spine, so one ribbon sweep serves both. **Note for planning:** this widens the blast radius beyond VEC-04's literal text into the engine, the brush pack and the freehand bake path — budget it explicitly rather than treating it as a free consequence.
- **D-15:** The **wireframe covers every stroke on the sheet**. Vector strokes draw spine + **per-vertex width envelope** + anchors + handles; hand-painted strokes draw spine + width envelope. **Nothing is baked while wireframe is on**, which is what makes it a real performance mode — drag cost stops scaling with the number of painted strokes on the sheet.
- **D-16:** The wireframe toggle is **session-only view state** and never enters `.mce`, the revision, a cache key or export output — the same law as canvas zoom and timeline zoom.

### Claude's Discretion

- The **auto-smooth tangent derivation**. Centripetal Catmull-Rom is recommended over uniform (uniform overshoots and can loop on unevenly spaced anchors); pin whichever is chosen so a reopen re-derives the same curve.
- The **vector tool's keyboard shortcut** — `P` belongs to the watercolor pen.
- How anchors, handles and the width envelope are drawn in the wireframe, within the existing Studio palette and the `physics-paint-segmented-button` grammar.
- **Insert and delete semantics on a sparse width profile** — whether a new anchor inherits an interpolated factor (becoming explicit) or stays absent, and what happens to the neighbouring factors when an anchor is deleted.
- Whether the new `simple-ribbon` preset appears in the brush dropdown, the sidebar tab, or both.
- **Undo granularity**, following the existing law: one undo entry per completed gesture, and every anchor / handle / width operation is exactly one undo/redo step. The Phase 25 precedent (snapshot-before, commit-on-release) is the reference.
- The **reference stroke count** for the responsiveness target — measured during the spike, not guessed.
- Exact placement and visual form of the wireframe toggle within the existing Studio chrome.

### Deferred Ideas (OUT OF SCOPE)

- **Closed paths and filled vector shapes** — always-open was chosen for this phase. Fill is a new capability with its own model (fill rule, fill colour, hit-testing), not a flag.
- **Full curve menu** (Hermite / user-selectable Catmull-Rom / B-Spline / TCB) — rejected. B-Spline specifically rejected by the approximating-basis argument.
- **On-canvas width handles** — rejected in favour of the numeric stepper; revisit only if the stepper proves too slow in live use.
- **Pressure-seeded per-vertex widths at draw time** — rejected in favour of sparse storage; a naturally tapered stroke comes from editing the profile, not from the pen.
- **Painted-stroke curve editing** — Phase 62. Spline-pointer must not enter curve mode on a hand-painted stroke here.
- **Interpolation wiggle on vector strokes** — the milestone's gate 5; not in VEC-01..07 and not discussed. If it is wanted, it arrives with the motion model, not with the pen.

#### Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — "Frame fade — compositing/export cumulative-frame crossfade (separate from opacity)". Surfaced again by the todo matcher (score 0.6) on the words export/opacity/feasibility, but it is a composite-time crossfade effect with its own staleness contract, not vector painting. Reviewed and deliberately left pending, consistent with Phases 59 and 60 where the same todo was also reviewed and not folded.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VEC-01 | `pen-tool` draws a vector stroke with corner and smooth points | §Q12 gives the real mount point (`PhysicsPaintToolRail.tsx` `WATERCOLOR_RAIL_TOOLS`, not `AquarelleToolRow`); §Q11 gives the auto-smooth derivation; §Q2 gives the spine→tick feed law |
| VEC-02 | `spline-pointer` edits anchors, coupled handles, handle break, insert, delete, multi-select | §Q10 maps the shipped `scriptStrokeTransform.ts` + `ScriptStrokeOverlay.tsx` handle law; §Q9 maps one-command-per-gesture undo; multi-select already exists in `aquarelleStrokeSelection.ts` |
| VEC-03 | Stroke width varies per vertex | §Q1/B proves per-vertex width has no existing engine channel; §Q3 names the seam failure mode of the only no-engine-change option; §Q4 quantifies the cost coupling |
| VEC-04 | Brush type and colour per stroke | Already true at the stroke level: `AquarelleStrokePayload.brushId` / `.color`; §Q6 keeps them there (never per vertex) |
| VEC-05 | Wireframe preview toggle doubles as the drag-time performance mode | §Q8 maps D-15 onto the shipped Draft-mode gate (7 named suspension sites + cross-realm gate) |
| VEC-06 | Vector strokes persist in `.mce`, survive reopen, export | §Q7 is the full persistence chain (AQTL v1 → SNAP v5 → opaque Rust) and the AQTL v2 requirement; §Q5 pins determinism |
| VEC-07 | Undo/redo covers each vector operation | §Q9 maps the Studio history port (`AquarelleScriptHistoryRoute`) and the Phase 25 snapshot precedent |
</phase_requirements>

## Technical Approach

### Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Anchor model, spine evaluation, per-vertex width lookup | Engine package (`packages/efx-watercolor`) | — | The bake runs the engine in a webview with no app state; anything the bake must reproduce has to live in the package or the bake diverges from live |
| Spine → tick sample feed | Adapter (`engineAdapter.ts`) | Engine | The adapter owns `advanceClock(1000 * HOST_DT)` + one sample per integer tick; resampling must not happen in the app |
| Dab placement, deposit mode (`simple-ribbon`), ink/wet blending | Engine (`playground/Engine.ts` `trace` / `stamp`) | — | D-11 says ONE ENGINE; the deposit seam is the stamp switch, not the bake orchestrator |
| Stroke payload (`anchors`, sparse width, `renderMode`) | Engine payload (`payload/toStudioStroke.ts`) | — | It rides the opaque `engine: P` slot; host genericity tests forbid widening `StudioStroke` |
| Persistence (binary encode/decode) | App (`performance/scriptTimelineCodec.ts`) | Rust (opaque bytes only) | AQTL is app-owned; Rust stores the SNAP container without parsing it |
| Record/commit seam, revision bump | App (`view/aquarelleRecordState.ts`) | — | The single commit path every stroke kind must use |
| Anchor/handle hit-test + drag | App (`view/scriptStrokeTransform.ts`, `engine/ScriptStrokeOverlay.tsx`) | — | Counter-scaled screen-px handle law already shipped |
| Wireframe suspension of bake/capture | App (`view/scriptStrokeEdition.ts` + Studio event handlers) | — | Session-only view state; engine is driven, never consulted |
| Tool entry, shortcut, dialog controls | App (`view/PhysicsPaintToolRail.tsx`, `view/physicsPaintStudioKeyboard.ts`, `view/PhysicsPaintStrokeSettingsDialog.tsx`) | — | The shipped chrome; `AquarelleToolRow` is unmounted |

### Q1 — Renderer feasibility: where does a stroke actually get rendered?

**The live/bake renderer is the vendored engine's script pipeline.** The adapter feeds one sample per integer tick and then ticks the engine:

`[VERIFIED: packages/efx-watercolor/src/adapter/engineAdapter.ts:261-268]`
```ts
engine.scriptBegin(asTool(active.stroke.engine.tool), p.x, p.y, p.p, 'Stroke', undefined, p.tx, p.ty)
engine.scriptMove(p.x, p.y, p.p, virtualNow, p.tx, p.ty)
engine.tick(HOST_DT)
```

`[VERIFIED: packages/efx-watercolor/src/adapter/engineAdapter.ts:47-48]`
```ts
export const HOST_TICK_HZ = 60
const HOST_DT = 1 / HOST_TICK_HZ
```

**`aquarelleBake.ts` never stamps.** It only advances ticks and captures — the deposit happens inside the engine through the same adapter:

`[VERIFIED: packages/efx-watercolor/src/bake/aquarelleBake.ts:326,344]`
```ts
export function createAquarelleBake(
...
    adapter.stepTick(tick)
```
`[VERIFIED: packages/efx-watercolor/src/bake/aquarelleBake.ts:801,834]`
```ts
        for (let tick = 0; tick < FIX_SETTLE_TICKS; tick += 1) {
...
          return adapter.captureFrame()
```

**`deposit.ts` is a different subsystem.** It is the 56-01 tracer/fluid-sheet path and is *not* on the live or bake critical path; it is nevertheless the only surface with an explicit per-stamp radius, which is why the ROADMAP's "segment runs vs payload extension" question is answerable by comparison:

`[VERIFIED: packages/efx-watercolor/src/engine/deposit.ts]` (read fully this session) — `export function toolEffectiveRadius(tool, baseRadius) { return tool === 'pen' ? baseRadius * PEN_RADIUS_SCALE : baseRadius }` and `depositStrokeOnSheet` builds `bridgeStep = Math.max(0.25, bridgeRadius * toolBridgeFraction(tool))` with `stampTool(sheet, tool, x, y, options, rng)` taking a per-stamp `radius`.

**Can per-vertex width ride an existing engine channel? No.**

- `scriptBegin` takes `maxRadius`, but it sets a per-stroke scale **capped at 1**:

`[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:841-844]`
```ts
  scriptBegin(tool: Tool, x: number, y: number, pressure: number, step: string | false = 'Stroke', maxRadius?: number, tiltX = 0, tiltY = 0): boolean {
...
    this.scriptScale = maxRadius ? Math.min(1, maxRadius / this.radius(tool, 1, 0)) : 1;
```
  Consequence: D-09's `1.8×` multiplier **cannot** ride `maxRadius` (it clamps to 1). It is also per-stroke, not per-vertex.
- `scriptMove` signature has no width/radius argument at all (`Engine.ts:856`).
- `sizeMult()` applies `scriptScale` only while `this.scripting` (`Engine.ts:1561`), so a mid-stroke write to `scriptScale` would apply — but nothing writes it after `scriptBegin`.
- Pressure (`pr`) does change radius, but it *also* changes concentration (`conc` includes `(0.4 + 0.6 * pr)`), the grain threshold, and wetness (`Engine.ts:1713-1719`). Mapping width→pressure therefore changes opacity — rejected as width-only.

**Two viable options, for the spike to A/B:**

| Option | Mechanism | Seam risk | Engine change |
|---|---|---|---|
| **Segment runs** | One `scriptBegin`/`scriptMove`/`scriptEnd` per width segment, each with its own `maxRadius` | **High and structural** — `scriptEnd` drops the `Stroke`, resetting `s.travelled` (feed-dry reservoir) and `s.carry` (spacing phase) | None |
| **Payload extension** | Add an optional per-sample width to the queued sample and multiply it into `radius()` for the in-progress stroke | Low — one continuous `Stroke` | Small, surgical (`QueueItem` + `Stroke` + `radius`) |

Reservoir evidence for the seam claim:

`[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1710-1712]`
```ts
        const reservoir = 0.25 + 0.75 * Math.exp(-s.travelled / ((1.5 + 3 * P.water) * b.capacity));
        const dryness = clamp(b.grain + (1 - b.grain) * clamp((0.5 - reservoir) * 2.5, 0, 1) * 0.6, 0, 1);
        const grainThr = 0.74 - 0.45 * pr - 0.05 * P.water;   // pressing harder reaches into the valleys
```

**Recommendation:** the spike must test both, but weight the decision toward **payload extension**, because the segment-run failure is *structural* (state reset per `scriptEnd`) rather than tunable. Note the D-09 cap problem: whatever channel is chosen, the multiplier must be able to exceed 1.0, so `maxRadius` alone is insufficient for either option.

### Q2 — The sampling law: where is a spine resampled, at what spacing, and where must it live?

**Dab placement is arc-length based, inside `Engine.trace()`.** Not parameter-based, not event-based.

`[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1653-1690]`
```ts
  private trace(s: Stroke, qx: number, qy: number, ex: number, ey: number, pr: number, vx: number, vy: number) {
    const aspect = this.dw / this.dh;
    const x0 = s.x, y0 = s.y, pr0 = s.pr;
    const approx = Math.hypot((qx - x0) * aspect, qy - y0) + Math.hypot((ex - qx) * aspect, ey - qy);
    if (approx < 1e-7) return;
    const fine = this.radius(s.tool, Math.max(pr0, pr), s.speed) * this.spacingFrac(s.tool);
    const n = clamp(Math.ceil(approx / Math.max(fine, 1e-5)), 1, 48);
...
      const spacing = this.radius(s.tool, p, s.speed) * this.spacingFrac(s.tool);
      let pos = 0;
      while (len - pos >= spacing - s.carry) {
        pos += spacing - s.carry;
        s.carry = 0;
        const t = pos / len;
        this.stamp(s, px + (cx - px) * t, py + (cy - py) * t, p, vx, vy, 1);
      }
      s.carry += len - pos;
```

`[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1692-1697]`
```ts
  private spacingFrac(tool: Tool) {
    const b = this.brush;
    // flat tips need tighter spacing: the footprint is thin across one axis
    return tool === 'brush' || tool === 'water' ? b.spacing * Math.sqrt(b.aspect) : 0.5;
  }
```

`[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1564-1583]`
```ts
  private radius(tool: Tool, pr: number, speed: number) {
...
      case 'pen': return (0.0016 + 0.0042 * pr) * clamp(1.12 - speed * 0.3, 0.55, 1.12) * m;
      case 'brush': return this.brushRadius(pr, speed);
...
  private brushRadius(pr: number, speed: number) {
    const b = this.brush;
    const t = Math.pow(clamp(pr, 0, 1), b.pressureSize);
    // preset sizes describe the full footprint; 0.8 keeps a hard-pressed stroke on a desktop screen sane
    return (b.size[0] + (b.size[1] - b.size[0]) * t) * clamp(1 - speed * b.speedThin, 0.4, 1) * this.sizeMult() * 0.8;
  }
```

**Key consequences for a vector spine:**

1. **Event density does not buy density.** `feedDueSample`'s sample rate affects `s.speed` (and therefore `speedThin`), but dab spacing is purely arc-length. Feeding more samples than ticks is wasted; feeding fewer than one per tick starves `trace()`'s quadratic approximation and makes the live pass differ from the bake.
2. **The spine resampler must be pure and live in `efx-watercolor`.** The bake runs inside the package's own adapter/webview; if the resampler lived in `app/`, the bake could not share it and live-vs-bake would drift — the exact A1/A2 law `params.ts` documents ("Live and bake BOTH map through `toEngineParams()` so the two halves cannot drift").
3. **Tick assignment is the host's, not the engine's.** `toStudioStroke` writes `pts[].tick` as the index (`packages/efx-watercolor/src/payload/toStudioStroke.ts`, read fully this session); the adapter then replays one point per `advanceClock(1000 * HOST_DT)` (see §Q1's quote). A vector spine must therefore be sampled to **integer tick stations** at or above the tick rate before it is persisted, or a reopen re-samples differently.
4. **The sub-step cap is 48** (`Engine.ts:1659`). A spine that jumps more than 48× the fine spacing inside one tick is flattened to 48 sub-steps — that is the sampling discontinuity the spike must measure (long segments between widely spaced anchors, low width multiplier).
5. **`s.carry` is phase, and it persists across ticks.** Any resampler that also inserts extra samples must not perturb carry, or identical geometry drawn at different click rates renders differently.

### Q3 — Seam quality: what makes it seamless today, and where a ribbon would visibly seam

**Ink is additive; wetness is MAX; load is normalized per dab.** That combination is the reason a stamped stroke has no visible dab boundaries.

`[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1819-1831]`
```ts
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
...
    gl.blendEquation(gl.MAX);
...
    gl.blendEquation(gl.FUNC_ADD);
```

`[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1713-1716]`
```ts
        const conc = 0.15 * Math.exp(P.load * 2.8) * reservoir * (0.4 + 0.6 * pr) * b.load;
        // spacing / profile integral -> ~conc in the stroke, normalised for sparse tips
        const norm = clamp(Math.sqrt(0.5 / b.tipMean), 0.7, 2.2);
        const amount = conc * Math.min(b.spacing, 1) / 1.8 * norm * dwell;
```

The `Math.min(b.spacing, 1)` term is the overlap-normalisation law: a tighter spacing deposits proportionally less per dab, so total density is spacing-invariant. Any ribbon implementation that deposits per dab **must** reuse this term, or it will darken when spacing tightens (which is exactly what per-vertex narrowing does).

**Where a ribbon would seam, ranked by likelihood:**

| Hazard | Mechanism | Evidence |
|---|---|---|
| Refill blobs at segment boundaries | `scriptEnd` → new `Stroke` → `s.travelled = 0` → `reservoir` jumps back to 1.0 → darker dabs | `Engine.ts:1710` |
| Spacing-phase reset | `s.carry` restarts at 0 per `Stroke`, so overlap at the join is whatever the first dab happens to be | `Engine.ts:1678-1687` |
| Direction discontinuity | `s.dx/s.dy` reset per `Stroke`, so the first dab of the next segment uses `lastDir`/zero | `Engine.ts:1666-1674`, `lastDir` at `:207` |
| Banding from a non-additive ribbon | A one-shot vector `stroke()` path (or `source-over` fills) has hard edges by construction | `Engine.ts:1819-1820` |
| Beading when spacing exceeds the footprint | `spacingFrac` for `pen` is a flat `0.5`; raising it for a ribbon would expose distinct dabs | `Engine.ts:1695` |
| Paper-grain discontinuity | The grain threshold depends on pressure and water; a width-by-pressure mapping would modulate grain in the wrong place | `Engine.ts:1712` |

**Recommendation:** the ribbon deposit mode should be implemented as **elongated dabs stamped along the spine with the existing additive `brushInk` path and the existing per-dab normalisation**, not as a filled path. That makes seamlessness structural. The spike's seam metric should be a per-pixel derivative/step scan across segment joins at 2× downsampled resolution (matching D-14's supersampled look intent), not an eyeball check.

### Q4 — Stroke-count cost: derive, then measure

**Per-dab spacing is derivable exactly.** With the size slider at 0.5 (`sizeMult = 3^0 = 1`), full pressure, zero speed, no jitter, spacing (in document heights) = `radius × spacingFrac`:

| Brush preset | `size[1]` | radius | `spacing` | `aspect` | `spacingFrac` | dabs per doc-height |
|---|---|---|---|---|---|---|
| BASE / round | 0.05 | 0.0400 | 0.3 | 1 | 0.3000 | **83.3** |
| chalk | 0.012 | 0.0096 | 0.2 | 1 | 0.2000 | **520.8** |
| detail | 0.014 | 0.0112 | 0.28 | 1 | 0.2800 | **318.9** |
| flat | 0.038 | 0.0304 | 0.14 | 0.26 | 0.0714 | **460.8** |
| hake | 0.08 | 0.0640 | 0.1 | 0.2 | 0.0447 | **349.4** |
| spatter | 0.008 | 0.0064 | 4.5 | 1 | 4.5000 | 34.7 stamps × 5 dabs = **173.6** |
| pen | — | 0.0065 | 0.5 | — | 0.5000 | **307.9** |

Preset numbers `[VERIFIED: packages/efx-watercolor/src/playground/brushes.ts]` (grepped this session: BASE `size: [0.011, 0.05], spacing: 0.3, aspect: 1`; chalk `[0.003,0.012] spacing 0.2`; detail `[0.0025,0.014] spacing 0.28`; flat `aspect 0.26 size [0.02,0.038] spacing 0.14`; hake `aspect 0.2 size [0.05,0.08] spacing 0.1`; spatter `size [0.003,0.008], spacing: 4.5, scatter: 10, dabs: 5`). Arithmetic above is derived from the two quoted laws, **not measured**.

A full-sheet diagonal on a 2048×1536 document (`aspect = dw/dh = 1.333`) is `sqrt(1.333² + 1²) ≈ 1.667` doc-heights, so:

- BASE ≈ **139 dabs/stroke**
- chalk ≈ **868 dabs/stroke**
- detail ≈ **532 dabs/stroke**
- flat ≈ **768 dabs/stroke**
- pen ≈ **513 dabs/stroke**

**The width coupling is the non-obvious cost trap.** `spacing ∝ radius`, so dabs ∝ 1/radius: halving a vertex's width multiplier doubles the dab count along that span. A stroke authored with 0.4× and 1.8× anchors costs more than the same spine at 1.0× uniformly.

**Reference stroke count — must be measured, and the instrument already exists.** Use `recordPhysicsPaintPerformanceCounter` + `physicsPaintPerformanceTrace` (median / p95 / max per stage, `PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES` includes `render.canvasMount`), and the runtime stroke counter `aquarelleLiveStrokeCount` (`view/aquarelleStrokeSelection.ts:382`). Reference document sizes for the spike should match the ones the project already measures against: **1920×1080 / 2048×1536 / 3072×2304** `[VERIFIED: packages/efx-watercolor/probe/watercolor-opacity/probe.ts:901-905]`:
```ts
  const examples = {
    '1920x1080': memoryExample(1920, 1080),
    '2048x1536': memoryExample(2048, 1536),
    '3072x2304': memoryExample(3072, 2304),
  }
```

**Derived budget check (to be confirmed by measurement):** at ~500 dabs/stroke, a 100-stroke sheet is ~50 000 dabs per full re-render. At 60 Hz, a 16.7 ms frame allows ~0.33 µs/dab — below any plausible GL stamp cost. That is the *reason* D-15's "nothing is baked while wireframe is on" is load-bearing rather than cosmetic, and it is the number the spike should falsify or confirm.

**The probe harness is the spike vehicle.** Clone `packages/efx-watercolor/probe/watercolor-opacity/`: `probe.ts` imports engine internals, `run.mjs` esbuild-bundles it and drives headless Chrome with `--enable-unsafe-swiftshader`, parses `<pre id="result">`, writes `/tmp/<probe>/result.json`, and prints a verdict. It already pins `Math.random` to mulberry32 and reseeds per stroke from `traceSeed` — exactly the discipline a determinism-sensitive spike needs.

### Q5 — The determinism pin: where it lives, and what must be added

**The pin file is `packages/efx-watercolor/src/determinismContract.test.ts`.** Existing pins that a vector stroke inherits for free, and the ones that must be extended:

`[VERIFIED: packages/efx-watercolor/src/determinismContract.test.ts:131,138,151,158,181]`
```ts
  it('applyStroke/stepTick/captureFrame twice on fresh adapters yields identical bytes', () => {
  it('projects traceSeed = hashMutationId so replays share one seed law', () => {
  it('src/engine and src/payload contain zero Math.random occurrences', () => {
  it('src/engine and src/payload contain zero crypto.getRandomValues occurrences', () => {
  it('pins the same literal in the engine package as the host pins in its own suite', () => {
```

**Two gaps this phase must close:**

1. **The `Math.random` scan covers only `src/engine` and `src/payload`.** A new `src/vector/` (or wherever the spine sampler lands) is **outside the scan** — the test would pass while the new module used an unseeded source. Either place the sampler under an existing scanned folder or widen the scan; the planner should choose explicitly.
2. **`package.json` dependency pin.** `[VERIFIED: packages/efx-watercolor/src/determinismContract.test.ts:191]`
```ts
  it('package.json dependencies omit engine 1 and include host + spectral', () => {
```
   This is the mechanical enforcement of REL-01 for the engine package. Importing `bezier-js` into `efx-watercolor` would fail it.

**New pins Wave 0 must add:**

- **Same-script byte identity across the two deposit modes' watercolor arm** (a `renderMode: 'watercolor'` stroke must render byte-identically to a legacy stroke with no `renderMode` field).
- **Same-script byte identity across `simple-ribbon`** twice on fresh adapters (the existing test shape, parameterised by mode).
- **Reopen determinism:** encode → decode → replay produces the same bytes as the original replay (this is the one that catches an AQTL field that round-trips as a different float).
- **Undo/redo determinism:** the existing `applyStroke/stepTick/captureFrame` pin generalised to "edit anchors, undo, redo, capture" — the adapter must be fully recovered, not partially.

**Known determinism hazard from the probe:** the paper seed is drawn from `Math.random` in the constructor *before* the adapter installs `seededRandom(1)`, so a naive fresh-engine comparison diverges `[VERIFIED: packages/efx-watercolor/probe/watercolor-opacity/probe.ts:938]`:
```
Pinned paper seed: two fresh engines reproduce exactly (...); Unseeded paper diverges (...) because paperSeed is drawn from Math.random in the constructor before the adapter installs seededRandom(1); isolation must restore/clone the paper seed.
```
Any new test that constructs a bare engine and compares must pin the paper seed the same way, or it will produce a flaky "determinism regression" that is really a test bug.

### Q6 — Data model placement: inside `P`, and do not widen `AquarelleTool`

**The host contract must not change.** `StudioStroke<P>` carries the engine blob opaquely:

`[VERIFIED: packages/efx-paint-host/src/animation/types.ts:34-54]`
```ts
export interface StudioStroke<P = unknown> {
  pts: readonly StudioPoint[]
  /** Stroke duration on the fixed tick grid (integer). */
  ticks: number
  /** Diffusion budget in ticks (per-stroke cuisson). */
  cuisson: number
  motion: StudioStrokeMotion | null
  /** Stable id into the engine's brush pack. */
  brushId: string
  toolOverrides: Readonly<Record<string, number | string | boolean>>
  /** FNV-1a-derived stroke seed (D-25 determinism law). */
  traceSeed: number
  /** Recording-order key — finite number used only for ordering comparison (DATA-03). */
  recordedOrder: number
  /** Host-owned play anchor. */
  playFrame: number | null
  /** Shared display colour (kept for held-pose hash stability). */
  color: string | null
  /** OPAQUE engine payload — host never reads this. */
  engine: P
}
```

`StudioPoint` is fixed and its `tx`/`ty`/`tw` slots are tilt-shaped, not handle-shaped: `[VERIFIED: packages/efx-paint-host/src/animation/types.ts:9-17]`
```ts
export interface StudioPoint {
  x: number
  y: number
  p: number
  tx: number
  ty: number
  tw: number
  tick: number
}
```

**The genericity tests that will say no to a contract extension** (name them in the plan's verification steps):
- `[VERIFIED: packages/efx-paint-host/src/script/payload.test.ts:206]` — `it('leaves the engine slot byte-identical (host never reads P)')`
- `[VERIFIED: packets/efx-paint-host/src/script/payload.test.ts:130,141]` — `StudioStroke<unknown> accepts a synthetic stroke with an opaque engine slot`; `EngineAdapter<unknown> exposes the one plug-point surface`
- `[VERIFIED: app/src/efx-paint/host-split/hostImportGraphContract.test.ts:263]` — `StudioStroke<unknown> / EngineAdapter<unknown> compile with zero engine-1 imports`
- `[VERIFIED: app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts:105,191]` — round-trip on the ONE `StudioStroke<P>` shape; `payloadCodec.parse is fail-closed on foreign shapes`

**Therefore:** `anchors`, `anchorKind`, sparse width factors and `renderMode` go into `AquarelleStrokePayload`:

`[VERIFIED: packages/efx-watercolor/src/payload/toStudioStroke.ts:63-72]`
```ts
export interface AquarelleStrokePayload {
  tool: AquarelleTool
  color: string | null
  params: Record<string, number>
  brushId: string
  toolOverrides?: AquarelleToolOverrides
  mutationId?: number
  diffusionFrames?: number
  timestamp: number
  playFrame?: number
```

**Do NOT add a member to `AquarelleTool`.** It is a four-literal union validated in three places:

`[VERIFIED: packages/efx-watercolor/src/payload/toStudioStroke.ts:55]`
```ts
export const AQUARELLE_TOOLS: readonly AquarelleTool[] = Object.freeze([
```
(the union itself is `export type AquarelleTool = 'brush' | 'water' | 'pen' | 'lift'` at `:54`)

- AQTL encodes it as a `u8` code (`brush=0, water=1, pen=2, lift=3`) and fails closed on unknown tools: `[VERIFIED: app/src/components/physic-paint/performance/scriptTimelineCodec.ts:426-427]`
```ts
  const toolCode = TOOL_CODE_BY_NAME[engine.tool];
  if (toolCode === undefined) fail('invalid-tag', `unknown tool "${String(engine.tool)}"`);
```
- Rust validates against the same four literals: `[VERIFIED: app/src-tauri/src/services/script_library.rs:2764-2879]` (read this session) — `validate_engine_payload_aquarelle` matches `tool` against `Some("brush" | "water" | "pen" | "lift")`.
- `codec.ts` validates membership: `[VERIFIED: packages/efx-watercolor/src/payload/codec.ts:110]`
```ts
  if (!(AQUARELLE_TOOLS as readonly string[]).includes(engine['tool'])) return false
```
- The UI filters are typed on the union: `AquarelleStrokeToolFilter = AquarelleTool | 'all'` (`app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:142`).

**Recommended shape:** vector-ness is implied by `anchors !== undefined`; the stroke keeps `tool: 'brush' | 'pen'` (its paint behaviour) and adds `anchors`, `anchorKind[]`, sparse width, and `renderMode`. This is a direct application of the project's conditional-canonical-term pattern and satisfies D-10's "a uniformly-wide vector stroke writes no width data at all".

**Precedent for a *tool* that is not in the union:** the colour picker. `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:143-146]`
```tsx
      {/* 261030-cnq: the color picker. A HOST tool — deliberately outside
          WATERCOLOR_RAIL_TOOLS and the `AquarelleTool` union, so latching it
          never changes the paint tool and unlatching is "back to the previous
          tool". A paint-tool key (B/W/E/P) or Select entry disarms it. */}
```
The vector pen is the same kind of thing — a Studio tool that swaps what a click does, not a new paint medium.

### Q7 — Dual-language `.mce`: the actual persistence chain (and the REL-02 premise problem)

**⚠️ Decision-grade finding — report to the user, do not silently plan around it.**

The ROADMAP and D-01/D-10/D-12 all state that new fields are "persisted in both TS and Rust". **That is not how strokes persist today.** The chain is:

```
AquarellePayloadEvent[]
  → AQTL v1 binary (app/src/components/physic-paint/performance/scriptTimelineCodec.ts)
  → SNAP v5 container (app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts)
  → opaque bytes written by Rust (app/src-tauri/src/services/studio_script_snapshot.rs)
```

**AQTL is explicit, not generic.** Its engine block is a fixed field list, and it fails closed on unknown override keys:

`[VERIFIED: app/src/components/physic-paint/performance/scriptTimelineCodec.ts:67,70]`
```ts
export const SCRIPT_TIMELINE_BINARY_MAGIC = 'AQTL';
...
export const SCRIPT_TIMELINE_BINARY_VERSION = 1;
```
`[VERIFIED: app/src/components/physic-paint/performance/scriptTimelineCodec.ts:479-495]`
```ts
  const paramKeys = Object.keys(params).sort();
  writer.u32(assertUint(paramKeys.length, 'engine.params count'));
...
  encodeOverrideMask(writer, engine.toolOverrides, 'engine.toolOverrides');
...
  const diffusionFrames = engine.diffusionFrames;
  writer.u8(diffusionFrames === undefined ? 0 : 1);
```
`[VERIFIED: app/src/components/physic-paint/performance/scriptTimelineCodec.ts:373]`
```ts
      if (index < 0) fail('invalid-tag', `${what} has unknown override key "${key}"`);
```
`[VERIFIED: app/src/components/physic-paint/performance/scriptTimelineCodec.ts:728]`
```ts
  if (version !== SCRIPT_TIMELINE_BINARY_VERSION) {
```
(The header comment at `:23-34` is the authoritative field list: "Stroke body: u8 mutationId presence + u32 id; u8 playFrame presence … u8 color presence + u16-length UTF-8 color; u8 toolOverrides … u8 diffusionFrames presence + u32; f64 timestamp; u8 playFrame presence + i32.")

**Rust never parses the container.** `[VERIFIED: app/src-tauri/src/services/studio_script_snapshot.rs]` (read this session, head) states the path law `<package>/scripts/<layerId>/<trackId>-v1.snap` and that "this service stores the opaque bytes and never parses the container".

**`MceEngineStrokePayload` is declaration-only.** `[VERIFIED: app/src/types/project.ts]`
```ts
export interface MceEngineStrokePayload {
  engine: Record<string, unknown> | null;
}
```
`[VERIFIED: app/src-tauri/src/models/project.rs]`
```rust
pub struct MceEngineStrokePayload {
    pub engine: Option<Value>,
}
```
with the comment that the wire shape is pinned "so the field-diff test can see it; the v1.0 package carrier is still opaque (`HashMap<String, Value>`) and does not construct this yet."

**The only Rust code that parses engine-slot keys is permissive.** `validate_engine_payload_aquarelle` (`script_library.rs:2764-2879`) validates the known fields and **accepts unknown keys** (no deny-unknown-fields). So new fields will not be rejected — and will not be validated either.

**What this means for the plan (three separate pieces of work, not one):**

1. **AQTL v2 in TS only.** Add the new fields to `encodeStrokeBody`/`decodeStrokeBody`, bump `SCRIPT_TIMELINE_BINARY_VERSION` to 2, and keep v1 readable (or refuse it — see Open Question 1) with the existing typed `ScriptTimelineCodecError`. Also extend `SNAP` if any container-level change is needed (none expected — the watercolor body is length-prefixed).
2. **REL-02 satisfied at the declaration layer.** Add matching `Mce*` members to **both** `app/src/types/project.ts` and `app/src-tauri/src/models/project.rs` so `mceFieldContract.test.ts`'s field-diff sees them — the exact Phase 56 precedent. `[VERIFIED: app/src/lib/mceFieldContract.test.ts:104,108,121,213,242]`
```ts
const RUST_SRC = readFileSync(
...
const TS_SOURCES = [
...
const ALLOWED_ONE_LANGUAGE = new Set([
...
  function expectMemberKeys(name: string, keys: readonly string[]): void {
...
    expectMemberKeys('MceEngineStrokePayload', ['engine']);
```
   Note the contract harness asserts **exact member key sets**, so adding a key to `MceEngineStrokePayload` is a test edit, not a silent pass. `ALLOWED_ONE_LANGUAGE` currently holds only `MceSequence.fps` — do not add a vector field to that set (D-01's reversibility note explicitly forbids one-language fields).
3. **A TS-side round-trip pin.** Because Rust is opaque, the reopen guarantee is only as good as AQTL's encode/decode round trip. That test is the real REL-02 proof, and it must include the absent-means-watercolor default.

**Also note the `params` escape hatch:** `params` is a generic sorted-key `Record<string, number>` that persists without any codec change, and Rust validates it as finite f64s. New engine params therefore ride for free. That said, `params` is semantically the wet-globals bag (`toEngineParams` maps it), so smuggling anchors through it would work mechanically and be wrong architecturally. Record it as the reason a codec change looks avoidable when it is not.

### Q8 — Wireframe as performance mode: the mechanism already ships

**D-15's "nothing is baked while wireframe is on" is the draft-mode law, one visual variant away.** The shipped precedent is quick 261101-o2m Move/Edit Draft:

`[VERIFIED: app/src/components/physic-paint/view/scriptStrokeEdition.ts:133-141]`
```ts
/**
 * 261101-o2m: the Move/Edit **Draft** VIEW mode. ON suspends ONLY the
 * watercolor engine re-render: every edit still commits to the script exactly
 * as today (and stays undoable), while the committed sheet keeps its last
 * rendered pixels. Session/UI state only — never written to the document,
 * never part of the undo stack, never persisted. Read by the Stroke settings
 * strip leaf (render), the cached-base leaf and the Studio event handlers
 * (`.peek()` only); NEVER the Studio render body (rule 5).
 */
export const draftMode = signal(false);
```

The correctness invariant and the display-only cache eye live in the same module:

`[VERIFIED: app/src/components/physic-paint/view/scriptStrokeEdition.ts:149-152,157-161,171-177]`
```ts
export const draftPixelsDirty = signal(false);
...
export function setDraftMode(on: boolean): void {
  if (!on && draftPixelsDirty.value) return;
  if (draftMode.value === on) return;
  draftMode.value = on;
}
...
export const frozenCacheVisible = signal(true);

/** Compare-then-write — 1000 identical calls notify zero times (rule 3). */
export function setFrozenCacheVisible(on: boolean): void {
  if (frozenCacheVisible.value === on) return;
  frozenCacheVisible.value = on;
}
```
and the display-only contract for the eye, which is the exact wording D-16 needs: "`DISPLAY-only: no commit, capture, save or export ever consults it`".

**The suspension sites are named and pinned.** All reads are `.peek()` inside event handlers, never the render body:

| Site | Purpose | Evidence |
|---|---|---|
| `PhysicsPaintStudio.tsx:5359` | every exit settles one recompute; no-op when off and clean | `if (!draftMode.peek() && !draftPixelsDirty.peek()) return Promise.resolve(true);` |
| `PhysicsPaintStudio.tsx:5711` | track switch refuses to capture a frozen sheet into the outgoing key | `if (draftMode.peek() \|\| draftPixelsDirty.peek()) return;` |
| `PhysicsPaintStudio.tsx:5918` | `resetSheet` does not wipe the sheet mid-draft | `if (draftMode.peek()) return;` |
| `PhysicsPaintStudio.tsx:5927` | undo/redo `rebake` marks dirty and skips the engine | `if (draftMode.peek()) { setDraftPixelsDirty(true); return Promise.resolve(true); }` |
| `PhysicsPaintStudio.tsx:5955` | replay capture suppressed | `if (replayed && tileHistory && !skipCapture && !draftMode.peek()) {` |
| `PhysicsPaintStudio.tsx:10691` | cross-realm publish of the gate | `const active = draftMode.value \|\| draftPixelsDirty.value;` |
| `PhysicsPaintStudio.test.ts:5628,5657,5743,5777,5783,5840,5923` | source-string pins for all of the above | see file |

**The cross-realm gate is mandatory, not optional.** Draft needed it because "ANY persistence channel that writes in that window would persist a new script against the pre-Draft pixel sidecar":
`[VERIFIED: app/src/lib/physicPaintDraftMode.ts:2-8]`
```ts
 * 261101-o2m (D-05, T-261101-o2m-01): the cross-realm Draft gate.
 *
 * While the Studio's Draft mode is ON its script is committed but its watercolor
 * pixels are deliberately frozen, so ANY persistence channel that writes in that
 * window would persist a new script against the pre-Draft pixel sidecar. The
 * Studio's own five exits are closed inside the Studio (a settle-then-act law);
 * the channels that live in the MAIN realm — the autosave debounce, the 60s
 * autosave interval, manual save and export — need a gate they can read, and
 * this leaf module is it.
```
It also carries a heartbeat/staleness belt (`PHYSIC_PAINT_DRAFT_HEARTBEAT_MS = 5000`, `PHYSIC_PAINT_DRAFT_STALE_MS = 20000`) so a dead Studio cannot wedge autosave. A wireframe that truly suppresses baking has the same problem and the same answer.

**Where the wireframe deviates from Draft:** Draft's pixels lag its script, which is why it needs `draftPixelsDirty` and may not be left while dirty. A wireframe toggled purely for viewing does not commit script changes, so it needs no dirty flag **if** entering wireframe is a pure view flip and leaving triggers exactly one recompute of the current frame. The spike/plan should decide which of the two it is, and say so — a wireframe that silently commits while frozen is a data-loss path.

**The visible half is a separate, trivial seam.** `AquarelleCachedBaseLayer` hides via a class only, keeping the canvas warm, and no capture/save/export path consults it:
`[VERIFIED: app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx:194-205]`
```tsx
  // 261101-o2m (D-02): the Stroke settings cache eye. The read is a render-body
  // subscription of THIS leaf only (never the Studio). The hide is display-only
  // — the canvas stays mounted so the decoded pixels stay warm, and no capture,
  // save or export path consults it.
  const cacheVisible = frozenCacheVisible.value;
  return (
    <canvas
      ref={canvasRef}
      class={`aquarelle-cached-base${cacheVisible ? '' : ' aquarelle-cached-base-hidden'}`}
      aria-hidden="true"
    />
  );
```
The wireframe overlay itself belongs beside `ScriptStrokeOverlay` in the same mount (`PhysicsPaintCanvasMount.tsx:204-229`), which already stacks cached base → live engine → overlay.

**D-16 compliance checklist for the toggle:** session-only signal in `scriptStrokeEdition.ts`; no `.mce` field; no revision bump; not in any cache key (`efxPaintCompositeCache.ts` derives track content keys — must not read it); not in export; compare-then-write setter; never read in the Studio render body.

### Q9 — Undo/redo: where it lives and how Phase 25 maps

**Studio history is one module with a snapshot-before/after contract.** `[VERIFIED: app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts]` (outlined this session, 1439 lines) — `useRotoPhysicalEditHistory`, `recordBackgroundEdit` (`:977`), `snapshotRevision` (`:506`), `buildReplayProposal` (`:670`), plus `RotoPhysicalEditHistoryIdentity`, `ReferencedActionHistoryCommand`, `AquarelleScriptHistoryRoute`, `beginAutoKeyPaintGroup`, `setDebugRotoUndo`.

**The aquarelle route is a five-member port**, and the draft gates sit inside it: `restore`, `resetSheet`, `rebake`, `rollback`, `notify`, `publishOwner` (see the block quoted in Q8 at `PhysicsPaintStudio.tsx:5918-5960`).

**Phase 25's precedent is snapshot-before, restore-on-undo, one entry per gesture:**
`[VERIFIED: app/src/components/canvas/PaintOverlay.tsx:1783-1791]` (grepped this session)
```tsx
const snapshotBefore = penAnchorSnapshot.current;
...
undo: () => { stroke.anchors = structuredClone(snapshotBefore); paintStore._notifyVisualChange(undoLayerId, undoFrame); }
```
Note it is a **UX reference only** — it lives on the legacy main-editor paint layer and does not carry over (61-CONTEXT `code_context`).

**Mapping for each VEC-02 operation:**

| Gesture | Snapshot boundary | Commit path |
|---|---|---|
| Drag an anchor | pointerdown (before) | pointerup → `updateAquarelleStrokesInScript` → one revision bump |
| Drag a handle | pointerdown | pointerup → same |
| Alt+drag (handle break) | pointerdown | pointerup → same (kind promotion rides the same patch) |
| Insert anchor (click a segment) | the click itself (no drag) | one entry |
| Delete anchor (Delete key) | before the delete | one entry |
| Width stepper commit | release-commit per the dialog's existing law | one entry |
| Multi-select then move | first pointerdown of the group drag | pointerup → one entry |

**The commit seam already enforces the invariants undo depends on.** `[VERIFIED: app/src/components/physic-paint/view/aquarelleRecordState.ts:252-263]`
```ts
    const active = aquarelleToolOverrides.value;
...
  aquarelleToolOverrides.value = remembered
```
and the compare-then-write setter law that prevents a same-value commit from creating a phantom undo entry:
```ts
export function setAquarelleParam(key: AquarelleGlobalKey, value: number): void {
  if (!Number.isFinite(value)) return;
  const current = aquarelleParams.value;
  if (current[key] === value) return;
  aquarelleParams.value = { ...current, [key]: value };
}
export function setAquarelleTool(tool: AquarelleTool): void {
  disarmAquarellePicker();
  exitRailMotionEditing();
  if (aquarelleActiveTool.value === tool) return;
  aquarelleActiveTool.value = tool;
}
```
`updateAquarelleStrokesInScript(mutationIds, patch)` **validates the whole patch first, skips unchanged targets, REPLACEs stroke+entry at the same timeline index, and bumps the revision once** — which is exactly the "one undo entry per gesture" primitive. Use it; do not add a second mutation path.

**Warning for the plan:** `ScriptStrokeOverlay.tsx:315` already commits transforms only when `crossed && !isIdentityScriptStrokeTransform(transform)`. Anchor drags need the same sub-threshold guard, or a click that moves 0.2 px creates an undo entry.

### Q10 — Interaction and hit testing: imitate the Studio handles, not the app-canvas ones

**The Studio already owns a handle grammar built for exactly this.** `[VERIFIED: app/src/components/physic-paint/view/scriptStrokeTransform.ts]` (outlined this session, 328 lines):
```ts
export const SCRIPT_TRANSFORM_HANDLE_SIZE_PX = 9
export const SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX = 8
export const SCRIPT_TRANSFORM_ROTATE_STEM_PX = 28
export const SCRIPT_TRANSFORM_ROTATE_RADIUS_PX = 7
const ROTATE_SNAP_RAD = Math.PI / 12
const SCALE_MIN_FACTOR = 0.1
const SCALE_MAX_FACTOR = 10
const IDENTITY_ANGLE_EPSILON = 1e-6
const IDENTITY_FACTOR_EPSILON = 0.01
```
with `scriptStrokeSelectionBox`, `scriptStrokeTransformHandles`, `hitTestScriptStrokeTransformHandle`, `rotateScriptPoint`, `scaleScriptPoint`, `applyScriptStrokeTransform`, `buildScriptStrokeTransform`.

**The gesture loop already resolves handles before strokes.** `[VERIFIED: app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx:169,248,268,305,315,378-379]`
```ts
      ? hitTestScriptStrokeTransformHandle(point, selectionBox)
...
        ? hitTestScriptStrokeTransformHandle(point, selectionBox)
...
    if (gesture.kind === 'transform') {
...
      if (!crossed || isIdentityScriptStrokeTransform(transform)) return;
...
          const bandPx = previewStrokeSize && props.port.bandFor !== undefined
            ? props.port.bandFor(entry, size)
```
Anchors and Bézier handles should be hit-tested in the same priority band and drawn with the same counter-scaled screen-pixel law (9 px body, 8 px pad), so zoom does not change the grab target.

**The app-canvas precedent is a poorer fit but supplies the naming the question asked for.** `[VERIFIED: app/src/components/canvas/transformHandles.ts:8,19,25,46,134,180,207,286]` — `HandleType`, `HandlePosition`, `LayerBounds`, `getLayerBounds`, `getHandlePositions`, `hitTestHandles`, `getRotationZone`, `getCursorForHandle`. The Studio overlay does not use it; it uses `scriptStrokeTransform.ts`. Use the Studio one.

**Interaction bracketing is the idle/flush scheduling seam.** `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx:3,430,446,461,475,585]`
```ts
import { beginInteraction, endInteraction, markInteractionActive } from '../bridge/gestureIdleScheduler';
```
Every handle drag brackets itself with `beginInteraction(pointerId)` / `endInteraction(pointerId)`. Anchor/handle drags must do the same, or a finalization/flush fires mid-gesture (`GESTURE_IDLE_WINDOW_MS = 400` in `gestureIdleScheduler.ts`).

**The width envelope to draw already exists as a pure module.** `[VERIFIED: app/src/components/physic-paint/view/aquarelleStrokeBand.ts:5,13,38,89,112,142,188,212]`
```ts
//  REUSE CONTRACT: the next quick (Draft mode) must import THIS
...
export function paintTipForStroke(
export function paintRadiusDocFor(
export function buildStrokeBand(
export function buildStrokeBandCached(
export function trimStrokeBandCache(liveIds: Iterable<number>): void {
```
It is pure (no Preact/DOM), works in doc-frame stations, and documents its approximations ("samples are decimated to MAX_POLYLINE_POINTS, speed is 0"). A per-vertex width envelope should be a second pure function in this family that takes the anchor width profile, not a new geometry system. The overlay already renders `data-testid={entry.kind === 'lift' ? 'stroke-lift-ribbon' : 'stroke-size-band'}` — the VEC-05 envelope should extend that path rather than add a parallel one.

### Q11 — Auto-smooth tangent derivation

**Recommended: centripetal Catmull-Rom (α = 0.5), evaluated per anchor as a tangent, then converted to Bézier handles.** For three consecutive anchors `P0, P1, P2` with `d = |P1 − P0|^α` (α = 0.5):

```
m1 = (P2 − P0 + d·((P1 − P0)/d1 − (P2 − P1)/d2)) / 2      (tangent at P1)
outHandle = P1 + m1/3        inHandle = P1 − m1/3
```

- Set `outHandle = P1 + (P2 − P0)/6` and `inHandle = P1 − (P2 − P0)/6` for the simple uniform case, but **do not ship uniform**: on unevenly spaced anchors it overshoots and can loop, which is the exact failure the CONTEXT calls out.
- Endpoints of an open path get a one-sided tangent (`P1 − P0` direction, scaled by 1/3).
- Tag: `[ASSUMED]` — this is textbook spline arithmetic, not read from a project source or official doc this session. The *decision* to use centripetal is already locked (Claude's Discretion recommends it); the formula must be pinned by a golden test.

**Determinism requirement:** derived handles are **not persisted** (D-03: "auto-smooth anchors draw no handles", and D-10's byte-identical-when-untouched law). They must therefore be recomputed identically on every hydrate. Consequences:
- the derivation must be pure float64 with a fixed operation order (no `Math.hypot` vs `sqrt(x*x+y*y)` mixing between the two call sites),
- it must live in the same package as the spine sampler so live and bake agree,
- a golden test must pin **exact** handle coordinates (not toBeCloseTo) for a fixed anchor set including an uneven-spacing case and a duplicate-point case (duplicate points make centripetal `d = 0` and must be handled by a declared fallback — an open question worth pinning rather than discovering at runtime).

**"Pin whichever is chosen so a reopen re-derives the same curve"** is satisfied by the golden test plus the reopen round-trip pin (§Q5).

### Q12 — Tool row and dialog integration (with one premise correction)

**⚠️ D-05 names a component that is not mounted.** `AquarelleToolRow.tsx` has **zero JSX mounts in the shipped tree**; a test asserts it must not be:

`[VERIFIED: app/src/components/physic-paint/view/panelSplitShell.test.tsx:156-173]`
```tsx
  it('watercolor shell is settings only: no tool row, no Dry button (261017-w4x I-06)', () => {
...
    expect(body, 'tool-row mount must leave').not.toMatch(/<AquarelleToolRow\b/);
```
A repo-wide grep for `<AquarelleToolRow` returns only that negative assertion. The shipped four-tool row is `WatercolorRail` inside `PhysicsPaintToolRail.tsx`:

`[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:52-64]`
```ts
/** UI checklist rows 8/9: Water color rail = Brush | Water | Pen | Lift | Dry. */
const WATERCOLOR_RAIL_TOOLS: ReadonlyArray<{
  id: AquarelleTool;
  label: string;
  shortcut?: string;
  Icon: (props: { size?: number }) => ComponentChildren;
}> = Object.freeze([
  { id: 'brush', label: 'Brush', shortcut: 'B', Icon: Paintbrush },
  { id: 'water', label: 'Water', shortcut: 'W', Icon: Droplet },
  { id: 'pen', label: 'Pen', shortcut: 'P', Icon: Pen },
  { id: 'lift', label: 'Eraser', shortcut: 'E', Icon: Eraser },
]);
```
rendered as `physics-paint-icon-button` with `aria-pressed` inside `nav.physics-paint-tool-rail` (`:110-138`). **D-05's intent is satisfiable; the named file is stale.** Insert the fifth entry here (or accept that `AquarelleToolRow` is dead code and say so) — this is a finding to surface, not a decision to take silently.

**Shortcut arbitration has ONE authority.** `[VERIFIED: app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts:364-374]`
```ts
      if ((key === 'b' || key === 'w' || key === 'e' || key === 'p') && actions.selectAquarelleTool) {
        event.preventDefault();
        // 261029-lel: W is a silent no-op while the live sheet is dry (the key
        // is still consumed). B / E / P never consult the gate.
        if (key === 'w' && state.canSelectWater && !state.canSelectWater()) return;
        actions.selectAquarelleTool(
          key === 'b' ? 'brush' : key === 'w' ? 'water' : key === 'p' ? 'pen' : 'lift',
        );
        return;
      }
```
Bare keys already taken: `b w e p i a f c d` plus `g o x [ ]` and `Tab`/`space`/arrows. `v` is used **only** with `meta` (`:196`), so **`V` is free** and reads as "vector". (Claude's Discretion; recommend `V` — and the button title should follow the existing `title={waterGated ? … : shortcut ? `${label} (${shortcut})` : label}` grammar.)

**The dialog is three pinned tabs, Geometry by default.** `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:166-172]`
```ts
type StrokeSettingsTab = 'geometry' | 'stack' | 'paint';

const STROKE_SETTINGS_TABS: ReadonlyArray<{ key: StrokeSettingsTab; label: string }> = [
  { key: 'geometry', label: 'Geometry' },
  { key: 'stack', label: 'Stack' },
  { key: 'paint', label: 'Paint' },
];
```
The header comment pins the model: "one pinned tab row (Geometry | Stack | Paint), Geometry by default"; "the tabs hold no stroke data — a ref-held signal holds only the active tab key"; "Geometry: every row is a release-commit, free-entry SliderStepper". That is where the spline-pointer header toggle (D-06), the width stepper (D-08) and the collapsed advanced wet section (D-13) belong.

**`SliderStepper` lives outside the physic-paint tree.** `[VERIFIED: app/src/components/shared/SliderStepper.tsx]` — imported as `import { SliderStepper } from '../shared/SliderStepper';` from `app/src/components/sidebar/PhysicPaintProperties.tsx:11`. The dialog's import path from `physic-paint/view/` is therefore `../../shared/SliderStepper`. Do not duplicate it.

**Projection seam:** new dialog fields belong in `strokeSettingsModel.ts` (`strokeSettingsFields`, `buildAppearancePatch`, `listStrokeTipOptions`, `resolveStrokeSettingsView`), never inline in the dialog — the CONTEXT names it as "the projection seam the modal reads".

### Q13 — Other risks

See `## Risks and Pitfalls`. The four that most warrant a plan-level checkpoint are: the D-05 stale-file correction, the REL-02/AQTL split (Q7), the D-09 `maxRadius ≤ 1` cap (Q1), and the `determinismContract` scan-scope gap (Q5).

## Stack / Dependencies

### Core — nothing new is installed

REL-01 holds. The engine package's dependency list is exactly two workspace packages, and a contract test pins it:

`[VERIFIED: packages/efx-watercolor/package.json]`
```json
  "dependencies": {
    "@efxlab/efx-paint-host": "workspace:*",
    "@efxlab/efx-spectral": "workspace:*"
  },
```
`[VERIFIED: packages/efx-paint-host/package.json]`
```json
  "dependencies": {
    "effect": "4.0.0-rc.115"
  },
```

| Need | Existing asset | Where |
|---|---|---|
| Cubic Bézier evaluation | Hand-written (≈40 lines) or app-side `bezier-js` | `bezier-js@^6.1.4` is **already** an app dependency (`app/package.json:29`) |
| Curve fitting | Not needed (anchors are authored, not fitted) | `fit-curve@^0.2.0` exists but is irrelevant here |
| Icons | `lucide-preact@^1.57.0` — `PenTool`, `Spline` available | `app/package.json:32` |
| Numeric stepper | `SliderStepper` | `app/src/components/shared/SliderStepper.tsx` |
| RNG | `seededRandom` / `mixStrokeSeed` / `hashMutationId` | engine + host packages |
| Signals | `@preact/signals@2.11.3` | `app/package.json:22` |

**Do not import `bezier-js` into `efx-watercolor`.** It would (a) add a runtime dependency (REL-01) and (b) fail the engine's own dependency pin (`determinismContract.test.ts:191`). The spine evaluator must be a small hand-written cubic/centripetal implementation inside the package — which is what `Engine.ts` already does everywhere else for geometry.

### Package Legitimacy Audit

**No packages are installed by this phase.** Gate not applicable.

| Package | Registry | Status |
|---|---|---|
| — | — | none proposed |
| `bezier-js` | npm | pre-existing app dependency (v6.1.4); **not introduced** by this phase; must not cross into `efx-watercolor` |
| `fit-curve` | npm | pre-existing app dependency; unused by this phase |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious:** none

### Version / tool verification commands used

```bash
cat app/package.json packages/efx-watercolor/package.json packages/efx-paint-host/package.json
cat app/vitest.config.ts
```
(`app/package.json` reports `"version": "2.1.0-beta2"` — consistent with the tag recorded in project memory.)

## Patterns and Conventions

### Pattern 1 — Engine payload, not host contract (HOST-02 / D-19)

Engine-specific data rides `engine: P`; the host never inspects it. Vector anchors, anchor kinds, sparse width factors and `renderMode` all go in `AquarelleStrokePayload`. The four genericity tests listed in §Q6 are the enforcement.

### Pattern 2 — Conditional canonical terms

Write a field only when present and non-default, so an untouched object stays byte-identical. D-10 is a direct application ("a uniformly-wide vector stroke writes no width data at all"), as is D-12's absent-means-`watercolor`. `toStudioStroke` already applies it (`diffusionFrames` clamped, optional fields omitted).

### Pattern 3 — Session-only view state (Phase 60 precedent, applied by D-16)

One module-level signal + a compare-then-write setter, read via `.peek()` in event handlers and never in a render body; never in `.mce`, revision, cache key or export. The two shipped models are `physicsPaintCanvasZoom.ts` (Phase 60) and `draftMode` / `frozenCacheVisible` (quick 261101-o2m).

### Pattern 4 — Fail-closed typed codec errors

`scriptTimelineCodec.ts` has a typed `ScriptTimelineCodecError` with named tags (`invalid-tag`, `invalid-string`, `invalid-value`) and refuses unknown versions. AQTL v2 must extend that vocabulary, not add a catch-all.

### Pattern 5 — One commit seam, validate-all-then-mutate

`updateAquarelleStrokesInScript` validates the entire patch before mutating, skips unchanged targets (so no phantom undo entry), REPLACEs stroke+entry at the same timeline index, and bumps the revision once. Every vector mutation goes through it.

### Pattern 6 — Counter-scaled screen-pixel handles

9 px body, 8 px hit pad, 28 px rotate stem, 7 px radius, `PI/12` snap, 0.1–10 scale clamp, identity epsilons; hit-tested before stroke hits; bracketed by `beginInteraction`/`endInteraction`.

### Pattern 7 — PROBE harness for measurement, not prose

`probe/<name>/{probe.ts,index.html,run.mjs}`; esbuild → headless Chrome (`--enable-unsafe-swiftshader`) → `<pre id="result">` → `/tmp/<name>/result.json`; deterministic RNG pinned around engine construction; a `verdict` string at the end. Wave 0 should be a fourth copy of this shape.

### Anti-Patterns to Avoid

- **A second renderer for the ribbon.** D-11 forbids it; `Engine.stamp` is the only legitimate deposit seam.
- **A `renderMode` that defaults to `simple-ribbon` or is inferred from params being zero.** D-12 requires explicit + absent-means-watercolor.
- **Adding `'vector'` to `AquarelleTool`.** Breaks AQTL's `u8` tool code, Rust's four-literal validator, `codec.ts`'s membership gate, and every tool filter — for no gain, since `anchors !== undefined` already discriminates.
- **Per-vertex brush or colour.** Milestone-locked out (ROADMAP success criterion 2).
- **Storing derived handles for auto-smooth anchors.** Duplicates state, and a divergent copy silently wins on reopen.
- **Snapshotting a frozen sheet into a frame cache.** The Draft gates exist because this exact mistake loses work; a wireframe that re-bakes on exit must keep them.
- **A `.test.tsx` target.** `app/vitest.config.ts` includes only `src/**/*.test.ts` + `../packages/efx-paint-host/src/**/*.test.ts`; a `.test.tsx` file runs zero tests (the tree's workaround is a sibling `Foo.test.tsx.test.ts`).
- **`pnpm test` as the full gate.** `app/package.json:11` is `"test": "vitest"` — **watch mode**. Use `vitest run`.

## Validation Architecture

> `workflow.nyquist_validation` is not disabled in `.planning/config.json` as far as this research observed; this section is included.

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest `^2.1.9` (`app/package.json:52`); engine + host packages pin the same |
| Config file | `app/vitest.config.ts` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run <path>` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` (NOT `pnpm test` — that is `vitest` in watch mode) |
| Engine package suite | `pnpm --filter @efxlab/efx-watercolor exec vitest run` |
| Headless-engine probe | `node packages/efx-watercolor/probe/<name>/run.mjs` (real WebGL2, ~9 min timeout) |
| Component tests | Node "vnode harness" (`materialize()` walks the vnode tree, no DOM) — see `TimelineMotionChannels.test.ts` / `AquarelleToolRow.test.tsx` shapes |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| VEC-01 | A vector stroke evaluates to a spine passing through its anchors; Alt places a corner | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/vector/spine.test.ts` | ❌ Wave 0 |
| VEC-01 | Ribbon tool appears in the rail as a 5th, visually separated entry with `aria-pressed` | vnode harness | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` | ⚠️ file absent; `AquarelleToolRow.test.tsx` is the shape to copy (and it is `.test.tsx` — must be a `.test.ts` sibling to run) |
| VEC-02 | Anchor/handle hit-test priority over strokes; 8 px pad at any zoom | unit | `… vitest run src/components/physic-paint/view/scriptStrokeTransform.test.ts` | ✅ exists (extend) |
| VEC-02 | Insert/delete change the anchor list and the spine in one commit | unit | `… vitest run src/components/physic-paint/view/aquarelleRecordState.test.ts` | ⚠️ extend; verify file exists before relying on it |
| VEC-03 | Sparse width: absent factor interpolates; uniform stroke stores nothing | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/payload/toStudioStroke.test.ts` | ⚠️ check existing payload tests |
| VEC-04 | Brush id + colour are stroke-level; no per-vertex fields exist in the payload type | source/type pin | included in the AQTL field pin below | ❌ Wave 0 |
| VEC-05 | Wireframe on ⇒ no capture, no reset, no rebake, no cross-realm persist | source-contract | `… vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ exists — extend the Draft pin block at `:5628-5923` |
| VEC-05 | Toggle is not in `.mce`, the revision, any cache key, or export | source-contract | `… vitest run src/lib/mceFieldContract.test.ts` + a new negative scan | ✅ / ❌ extend |
| VEC-06 | AQTL encode→decode round-trips anchors, kinds, sparse widths, `renderMode` | unit | `… vitest run src/components/physic-paint/performance/scriptTimelineCodec.test.ts` | ✅ exists (extend) |
| VEC-06 | Reopen: encode→decode→replay produces identical bytes | integration (headless engine) | probe or adapter test: `pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts` | ✅ exists (extend) |
| VEC-06 | New fields declared in BOTH TS and Rust | field-diff | `… vitest run src/lib/mceFieldContract.test.ts` | ✅ exists (extend `expectMemberKeys`) |
| VEC-07 | Each operation is exactly one undo entry | unit | `… vitest run src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` | ⚠️ verify; else add |
| All | Determinism: same script ⇒ same pixels, twice, per mode | contract | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts` | ✅ exists (extend) |
| All | No unseeded RNG in the new module | static scan | same file — **must widen the `src/engine` / `src/payload` scan** | ⚠️ gap |

### How determinism / `.mce` round-trip / undo semantics are proven

1. **Determinism** — `determinismContract.test.ts` already proves "twice on fresh adapters yields identical bytes" and pins the seed literal `mixStrokeSeed(hashMutationId(42), 3) === 179180383`. Extend with a `renderMode` parameter and add an undo/redo arm. The paper-seed trap (§Q5) must be respected: pin `paperSeed` before constructing bare engines.
2. **`.mce` round-trip** — AQTL is the only layer that can lose information, because Rust is opaque. The proof is a `serialize → bytes → parse → deep-equal` unit test plus a byte-identity test after replay. Do **not** assert that Rust validates the new fields; it does not.
3. **Undo semantics** — assert the *count* of history entries after: one anchor drag, one handle drag, one insert, one delete, one width commit, one no-op drag (must produce zero). The compare-then-write setters and `updateAquarelleStrokesInScript`'s unchanged-target skip are what make the no-op case pass.

### Sampling Rate

- **Per task commit:** the single test file touched (`vitest run <path>`).
- **Per wave merge:** `vitest run` for the affected package(s) — app and/or `@efxlab/efx-watercolor`.
- **Phase gate:** the full `vitest run` (app) + `@efxlab/efx-watercolor` suite + the Wave-0 probe result JSON committed as evidence.

### Wave 0 Gaps

- [ ] `packages/efx-watercolor/probe/vector-spine/` — clone of `probe/watercolor-opacity/` (`probe.ts`, `index.html`, `run.mjs`). Must answer the five ROADMAP spike questions: segment-runs vs payload-extension seam scan, sampling law at 1×/4×/16× tick density, seam step metric across segment joins, dab-count cost vs stroke count at 1920×1080 / 2048×1536 / 3072×2304, and byte-identity across runs.
- [ ] `packages/efx-watercolor/src/vector/spine.test.ts` — spine evaluation, arc-length station assignment, duplicate-anchor fallback, centripetal handle golden values (exact).
- [ ] `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` — sparse width projection, absent-means-uniform, `renderMode` default.
- [ ] `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` — AQTL v2 round trip including absent fields and v1 refusal/acceptance decision.
- [ ] `app/src/lib/mceFieldContract.test.ts` — extended `expectMemberKeys` for the new `Mce*` members; no new `ALLOWED_ONE_LANGUAGE` entries.
- [ ] `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — wireframe gate pins mirroring the Draft block.
- [ ] `app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` — fifth-entry pin (`.test.ts`, not `.test.tsx`).
- [ ] Undo-granularity test for the new gestures (extend `useRotoPhysicalEditHistory` coverage or add a focused file).

## Risks and Pitfalls

### Explicit conflicts with locked decisions (must be surfaced, not planned around)

**C1 — D-05 names an unmounted component.** `AquarelleToolRow.tsx` has no JSX mount; `panelSplitShell.test.tsx:173` asserts it must not be mounted. The shipped tool row is `WATERCOLOR_RAIL_TOOLS` in `PhysicsPaintToolRail.tsx:59-64`. *Recommendation:* satisfy D-05's intent in `PhysicsPaintToolRail.tsx`, and record that `AquarelleToolRow` is dead code (either delete it or leave it with its tests).

**C2 — REL-02's "persisted in both TS and Rust" is not how strokes persist.** See §Q7. The real work is an AQTL v2 in TS plus declaration-layer `Mce*` members in both languages plus a TS round-trip pin. *Recommendation:* split the plan's persistence task into those three explicit deliverables; do not write a task that says "add the field to the TS interface and the Rust struct" and expect reopen to work.

**C3 — D-09's multiplier cannot ride the existing `scriptScale`.** `Engine.ts:844` caps it at 1 (`Math.min(1, …)`). Any implementation that tries to route per-vertex width through `maxRadius` will silently lose every widening edit. *Recommendation:* the spike must exercise a 1.8× vertex and assert the measured radius grows by 1.8×, not by 1.0×.

**C4 — D-11's "fixed bake path" does not mean the bake file changes.** `aquarelleBake.ts` never stamps; it advances ticks and captures. The deposit mode belongs in `Engine.ts` (`trace`/`stamp`), and the bake file only needs touching if the ribbon introduces a new timing/RNG dependency. *Recommendation:* plan the mode change in `Engine.ts` and treat `aquarelleBake.ts` as read-only unless a determinism pin forces otherwise.

### Pitfall 1 — The segment-run seam is structural, not cosmetic
`scriptEnd` drops the `Stroke`, so `s.travelled` (reservoir), `s.carry` (spacing phase) and `s.dx/s.dy` (direction smoothing) all reset. A tapered stroke built from segments will show refill blobs and phase jitter at every segment join, worst on `brush` presets with high `capacity` and low `water`. **Warning sign:** seams appear only on strokes with more than two width values, and are worse on long strokes.

### Pitfall 2 — Dab count inverts with width
`spacing ∝ radius`, so narrowing a vertex increases dabs. A stroke authored with narrow anchors can cost 2–5× the uniform stroke. **Mitigation:** the width stepper's minimum should be a planned floor, and the spike should measure cost at the minimum width, not at 1.0.

### Pitfall 3 — The `Math.random` scan does not cover a new folder
`determinismContract.test.ts` scans `src/engine` and `src/payload` only. A new `src/vector/` escapes it and the suite stays green. **Mitigation:** widen the scan in the same commit that adds the folder.

### Pitfall 4 — Paper seed is unseeded before the adapter installs `seededRandom(1)`
A test that constructs a bare `WatercolorEngine` and compares two runs will diverge, and the failure looks like a determinism regression. **Mitigation:** pin `Math.random` to mulberry32 around construction, as the probe already does.

### Pitfall 5 — AQTL is explicit; a new payload field is invisible until encoded
Adding a field to `AquarelleStrokePayload` compiles, records, re-renders live — and loses the field on reopen. Nothing warns. **Warning sign:** anchors survive save/reopen in-session but vanish after an app restart. **Mitigation:** the AQTL round-trip test is the gate, and it must include a non-default `renderMode` and a sparse width profile.

### Pitfall 6 — Rust accepts unknown engine keys, so it will not catch a mismatch
`validate_engine_payload_aquarelle` has no deny-unknown-fields. A field that TS writes and Rust's struct omits passes validation silently. The `mceFieldContract` field-diff is the only catcher.

### Pitfall 7 — Wireframe without a cross-realm gate can persist a stale sidecar
The Draft module exists because autosave, the 60 s interval, manual save and export live in the **main realm**. A wireframe that suppresses baking without publishing a gate lets those channels commit a script against frozen pixels. **Warning sign:** a reopen shows the pre-wireframe paint with post-wireframe geometry.

### Pitfall 8 — The wireframe toggle must not touch the cache key or revision
D-16 + Phase 60's law. `efxPaintCompositeCache.ts` derives track content keys; if the toggle reaches a key, every stroke on the sheet re-derives on toggle and the "performance mode" becomes the expensive path.

### Pitfall 9 — Source-string pins will break the moment the tool row is renamed
`PhysicsPaintStudio.test.ts`, `panelSplitShell.test.tsx`, `AquarelleToolRow.test.tsx` all contain literal source assertions. Repoint them at the new authority (Phase 60's PATTERNS calls this out explicitly: "Repoint, never relax or delete").

### Pitfall 10 — `pnpm test` is watch mode
`app/package.json:11` `"test": "vitest"`. CLAUDE.md forbids watch mode. Always `vitest run`.

### Pitfall 11 — A `.test.tsx` file silently runs zero tests
`app/vitest.config.ts` includes `src/**/*.test.ts`. The tree's workaround is `Foo.test.tsx.test.ts`. Verify the collected-file count when adding a component test.

### Pitfall 12 — Multi-select plus per-vertex width is an N-stroke write
`aquarelleStrokeSelection.ts` already carries a selection **set**. A width commit against a multi-selection must produce **one** undo entry and **one** revision bump — which means one `updateAquarelleStrokesInScript` call with all ids, not a loop.

### Pitfall 13 — D-14 widens the blast radius beyond VEC-04's text
The render mode applies to hand-painted strokes too. That reaches the freehand bake path, the brush pack (`simple-ribbon` preset), and the dialog's simple/advanced section split. Budget it as its own plan, or a "small" VEC-04 task will absorb the whole phase.

### Pitfall 14 — The simple-ribbon preset must not be a fifth `AquarelleTool`
It is a *brush preset* (`BRUSH_PRESETS` in `playground/brushes.ts`), not a tool. Adding it to the tool union re-opens the C2/AQTL problem.

## Open Questions

1. **AQTL v1 files: accept or refuse?**
   - What we know: the codec is fail-closed on unknown versions (`scriptTimelineCodec.ts:728`), and project memory records a standing decision of "no backward compat for old projects" (clean break on format changes).
   - What's unclear: whether saved `.mce` packages from beta2 exist that must open.
   - Recommendation: bump to v2 and refuse v1 with a named typed error, consistent with the standing no-backward-compat law — but confirm with the user before the plan locks it, because it is a data-availability decision.

2. **Duplicate anchors in the centripetal derivation.**
   - What we know: `d = |P1 − P0|^0.5` is zero for coincident points, which makes the tangent formula divide by zero.
   - What's unclear: whether the pen tool should refuse a duplicate click, or the derivation should fall back to a uniform tangent.
   - Recommendation: refuse at draw time (fail-closed, visible) and pin the fallback in the golden test for imported data.

3. **Does the wireframe suppress *all* baking or only the sheet?**
   - What we know: D-15 says "nothing is baked while wireframe is on" and the Draft gates cover capture, reset, rebake, replay-capture and cross-realm persistence.
   - What's unclear: whether the *reference/durable base* and the Roto PlayScript bake path are also in scope, or only the Studio sheet.
   - Recommendation: scope to the Studio sheet path in this phase and state it; the Roto controller is a separate consumer.

4. **Escape hatch if payload extension is rejected in the spike.**
   - What we know: segment runs have no engine change but reset reservoir/carry.
   - What's unclear: whether the visual seam is acceptable at the sheet's working resolution.
   - Recommendation: make Wave 0 produce a *verdict string* (the probe convention) plus the seam metric images, so the decision is evidence-based and the fallback is pre-scoped.

5. **Where does the wireframe toggle live in the chrome?**
   - What we know: Claude's Discretion; the Draft/cache-eye controls sit in the Stroke settings strip; the timeline zoom pill is in the header flow.
   - Recommendation: mirror the cache-eye placement in the Stroke settings header next to the spline-pointer toggle — the same "view of the current stroke" family, same leaf, no new chrome grammar.

6. **Sample/tick density for a vector spine.**
   - What we know: one sample per integer tick through `feedDueSample`; `trace()`'s 48-substep cap bounds the arc between samples.
   - What's unclear: whether a spine should be sampled at anchor-to-anchor tick spans proportional to arc length (natural easing) or at a fixed ticks-per-doc-height rate.
   - Recommendation: fixed tick stations derived from arc length, pinned by a golden test — it keeps drawing speed independent of `ticks`, which the host schedule owns.

## Sources

### Primary (HIGH confidence — read this session, quoted verbatim above)

- `packages/efx-watercolor/src/playground/Engine.ts` — `radius`/`brushRadius`/`spacingFrac`/`trace`/`stamp`, blend modes, `scriptBegin`/`scriptMove`, reservoir
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — `HOST_TICK_HZ`, `feedDueSample`, `scriptBegin`/`scriptMove`, `seededRandom`, `setClock`
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — `createAquarelleBake`, `stepTick`, `captureFrame`, `FIX_SETTLE_TICKS`
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` — `AquarelleTool`, `AQUARELLE_TOOLS`, `AquarelleStrokePayload`
- `packages/efx-watercolor/src/payload/codec.ts` — `AQUARELLE_SCHEMA_VERSION`, `isStrokeShape`, `cloneStrokeForWire`
- `packages/efx-watercolor/src/determinismContract.test.ts` — pins and scan scope
- `packages/efx-watercolor/src/engine/deposit.ts` — tracer/fluid path with per-stamp radius
- `packages/efx-watercolor/probe/watercolor-opacity/{probe.ts,run.mjs}` — the spike harness and measurement conventions
- `packages/efx-paint-host/src/animation/types.ts` — `StudioStroke<P>`, `StudioPoint`
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` — AQTL v1 wire format
- `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` — SNAP v5 container
- `app/src-tauri/src/services/studio_script_snapshot.rs` — opaque storage
- `app/src-tauri/src/services/script_library.rs` — `validate_engine_payload_aquarelle`
- `app/src/types/project.ts`, `app/src-tauri/src/models/project.rs`, `app/src/lib/mceFieldContract.test.ts` — dual-language contract
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — the real tool row
- `app/src/components/physic-paint/view/AquarelleToolRow.tsx` — the unmounted component
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` — the one shortcut authority
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — tab model
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — Draft, cache eye, selection, preview signals
- `app/src/components/physic-paint/view/scriptStrokeTransform.ts` + `engine/ScriptStrokeOverlay.tsx` — handle law
- `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` — pure width-envelope module
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — commit seam, compare-then-write
- `app/src/lib/physicPaintDraftMode.ts` — cross-realm gate
- `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx`, `PhysicsPaintCanvasMount.tsx`, `aquarelleEnginePort.ts` — the mount stack
- `app/vitest.config.ts`, `app/package.json`, both package manifests — toolchain and REL-01 evidence
- `.planning/phases/61-vector-painting-tool/61-CONTEXT.md` and `61-DISCUSSION-LOG.md`
- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §4, §5.3, §5.4, §7, §11
- `.planning/phases/59-…/59-CONTEXT.md:24` — the no-approximating-basis precedent
- `.planning/phases/60-…/60-CONTEXT.md:115` — session-only view metrics law
- `.planning/phases/60-…/60-PATTERNS.md` — the project's pattern-map conventions

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` § Phase 61 — the spike clause and delivery law (read this session)
- `.planning/REQUIREMENTS.md` — VEC-01..07, REL-01..04

### Tertiary (LOW confidence)

- Centripetal Catmull-Rom tangent formula (§Q11) — textbook arithmetic, tagged `[ASSUMED]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Centripetal Catmull-Rom with α = 0.5 is the right auto-smooth basis, and the tangent→Bézier handle conversion is `m/3` | §Q11 | Curve shape differs from expectation; a golden test still pins whatever is chosen, so the risk is aesthetic, not structural |
| A2 | A 100-stroke sheet at ~500 dabs/stroke is over a 16.7 ms frame budget | §Q4 | Wireframe may not be as load-bearing as claimed; but D-15 is locked regardless, so this only affects urgency, not scope |
| A3 | AQTL v1 documents exist in the wild and may need to open | §Q7 / Open Q1 | If none exist, refusing v1 is trivially safe; if many exist, refusing is a data-availability break |
| A4 | The wireframe needs the cross-realm gate only if it suppresses baking of *committed* strokes | §Q8 | If the wireframe is a pure view flip that never suppresses a commit, the gate is unnecessary work |
| A5 | `V` is free as a bare shortcut | §Q12 | If a future conflict exists, the shortcut changes; cosmetic only |

**If this table were empty:** no claim would need confirmation. It is not empty — A1, A3 and A4 are the ones discuss-phase should confirm before the plan locks them.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node (project) | build/test | ✓ | v24.15.0 (per session hook) | — |
| pnpm workspace | package filtering | ✓ | (used throughout `package.json`) | `npm --workspace` is not configured |
| Vitest | all unit/contract tests | ✓ | `^2.1.9` | — |
| Headless Chrome / Chromium | Wave 0 probe (real WebGL2) | ✓ (per `run.mjs` candidate list) | `/Applications/Google Chrome.app/…` | Chromium path |
| esbuild | probe bundling | ✓ | pinned candidate `esbuild@0.27.7` | `node_modules/.bin/esbuild` |
| WebGL2 | engine + probe | ✓ on the target machine (engine ships) | — | `--enable-unsafe-swiftshader` software fallback (used by `run.mjs`) |
| Rust / Tauri toolchain | only if the Rust struct changes | ✓ (repo ships `src-tauri`) | — | none needed — Rust is opaque |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none that block execution.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — manifests read directly; REL-01 verified by the engine's own dependency pin.
- Architecture (renderer, sampling, persistence, UI mount points): **HIGH** — every claim is a quoted file:line from a read performed this session.
- Cost/pitfalls: **MEDIUM-LOW** — the dab-count arithmetic is derived from quoted laws, but no measured baseline exists in the repository; the spike is the instrument.
- Curve math: **LOW/ASSUMED** — the formula is not from a project source; pin it with a golden test.

**Research date:** 2026-11-10
**Valid until:** ~2026-12-10 for the architecture (stable); the spike numbers expire immediately upon measurement — treat Wave 0's result JSON as the authority.

**Researcher note on the tool strategy seam:** all research in this phase was in-repository (no external library/API questions), so no `research-plan` / `classify-confidence` / `research-store` round trips were used. Confidence tiers above were assigned by source type per the provenance rules.
