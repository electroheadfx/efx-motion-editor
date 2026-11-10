# Phase 61: Vector Painting Tool - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the Studio a **second kind of stroke**: geometry authored as a path — anchors with handles — instead of sampled points. A vector stroke carries a per-vertex width profile and a per-stroke brush and colour, draws and edits through the existing Move/Edit surface, previews as a wireframe, persists in `.mce`, and re-bakes deterministically.

This phase also adds a **second deposit mode inside the one watercolor engine**: `simple-ribbon`, a clean sweep along the stroke spine that shares the engine's determinism law rather than introducing a second renderer.

It does **not** add painted-stroke curve editing (Phase 62), closed or filled paths, a multi-curve-type menu, or the v2.2.0 Studio API/MCP (Phase 63). Spline-pointer must not enter curve mode on a **hand-painted** stroke in this phase — that is Phase 62's capability.

</domain>

<decisions>
## Implementation Decisions

### Milestone-locked (carried in, NOT re-asked)

These were settled before this discussion and must not be reopened by research or planning:

- **VEC-01..07 are the requirement set.** `pen-tool` draws with corner and smooth points; `spline-pointer` edits anchors, coupled handles, handle break, insert, delete and multi-select; width varies per vertex; brush type and colour are **per stroke**; a wireframe toggle doubles as the drag-time performance mode; vector strokes persist, reopen and export; undo/redo covers each vector operation.
- **Per-vertex means width only.** There is no per-vertex brush type and no per-vertex colour (ROADMAP success criterion 2).
- **`pen-tool` / `spline-pointer` are lucide icons** and the two named toggle states (milestone §5.3).
- **The renderer is the scope risk, not the pen tool.** The ROADMAP mandates a spike before the data model is locked: per-vertex watercolour feasibility (segment runs vs payload extension), the sampling law, seam quality, stroke-count cost, and the determinism pin.
- **REL-01 holds** — no new runtime dependencies. **REL-02 applies to every new vector field in both TS and Rust.** REL-03 and REL-04 are not involved.
- **Determinism law holds** — 60 Hz integer tick grid, FNV-1a `traceSeed`, no `Math.random()` in the deposit or simulation path.
- **Hide/solo, ordering, opacity and background behaviour are preserved** for vector strokes (ROADMAP success criterion 4).
- **No B-spline.** An approximating basis misses the points you place; the same argument that rejected B-spline on Phase 59 motion channels applies to a drawn path.

### Curve model

- **D-01:** A vector stroke supports exactly **two anchor kinds**: a **Bézier anchor** carrying its own coupled handles (with handle break), and an **auto-smooth anchor** whose handles are derived from its neighbours. One persisted discriminator, no third state. — **Reversibility:** one-way — the anchor kind is a persisted `.mce` field pinned byte-identically by REL-02 in both the TS interface and the Rust struct; adding or renaming a kind later needs a document migration and a dual-language encoder change.
- **D-02:** While drawing, **every placed point is auto-smooth by default**; holding **Alt** places a hard corner. The path flows through the clicks with no handle work unless the user interrupts it.
- **D-03:** **Grabbing an auto-smooth anchor's derived tangent promotes that anchor to a Bézier anchor, permanently.** Auto-smooth anchors draw no handles. The rule is "the moment you take control, you own it" — there is no auto-with-override state, so the parser only ever sees two kinds.
- **D-04:** Hermite, TCB, and a user-selectable Catmull-Rom were **rejected** as curve families. Auto-smooth already delivers the interpolating auto-tangent case they were there to cover.

### Vector mode entry

- **D-05:** The vector pen is a **5th entry in `AquarelleToolRow`** (lucide `PenTool`), visually separated from the four watercolor tools. The row already contains a watercolor tool named `pen` bound to `P`, so the vector entry needs a **distinct label and a non-`P` shortcut**. — **Reversibility:** reversible — one more button in a static row.
- **D-06:** **Two distinct controls, never a toggling button.** The tool-row button always means *draw*; the **spline-pointer button in the Stroke Settings dialog header** always means *edit the selected path*. Picking a paint tool or the vector tool leaves edit mode and returns to drawing. This resolves the cold-start problem: the modal only opens on an existing selection, so it cannot be the way in.
- **D-07:** **Paths are always open.** Enter or double-click finishes the path; clicking the first anchor finishes there rather than closing. No `closed` flag, no fill, no join-back segment.

### Per-vertex width

- **D-08:** Width is authored with a **numeric stepper in the Stroke Settings dialog** for the selected anchors, reusing `SliderStepper`. The canvas shows the resulting width as a **per-vertex width envelope** so the value is visible, not just typed.
- **D-09:** A vertex width is a **multiplier of the stroke's brush size** (e.g. 1.0 / 0.4 / 1.8), matching the engine's existing `toolOverrides` multiplier vocabulary so the brush Size control still rescales the whole stroke coherently.
- **D-10:** Width storage is **sparse** — an anchor carries a factor only once it is edited; untouched anchors interpolate from their nearest set neighbours. **A uniformly-wide vector stroke writes no width data at all**, keeping the payload minimal and the stroke byte-identical in shape to a plain one (the project's conditional-canonical-term pattern). — **Reversibility:** costly — inserting and deleting anchors has to remap or deliberately not remap the sparse factors, and both the TS and Rust encoders must agree on what an absent factor means.

### Render model

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone authority (read first)

- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §5.3 — the vector painting tool scope and its seven original gates (per-vertex properties, curve types, wireframe preview, interpolation wiggle, real object animation, not image caches).
- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §11 — the v2 annotation fixing that **per-vertex properties live in the vector editor, not the timeline lanes**, and that `pen-tool` / `spline-pointer` stay in the Move/Edit modal.
- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §4 — the interpolation notes and the curve-type list this phase resolves.
- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §5.4 — the Phase 62 boundary (painted-stroke curve editing), which this phase must not pre-empt.
- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §7 — what the v7 interface supersedes; the pen/spline controls are **not** lane UI.

### Requirements and roadmap

- `.planning/REQUIREMENTS.md` — VEC-01..07, the traceability table, and the REL-01..04 delivery law.
- `.planning/ROADMAP.md` §Phase 61 — the goal, the five success criteria, the spike clause, and the UI hint.

### Prior phase decisions

- `.planning/phases/59-rail-motion-channels-v7-interface/59-CONTEXT.md` — the **no-approximating-basis** precedent (B-spline rejected on motion channels) applied here to curve families, and the one-evaluator rule.
- `.planning/phases/60-studio-timeline-horizontal-zoom/60-CONTEXT.md` — the **session-only view state** law that D-16 applies to the wireframe toggle.

### Design oracles

- `SPECS/UI-SPECS/zoom and audio.png` — NLE chrome reference for the Studio control grammar (readout/stepper grouping).
- No dedicated vector-painting UI spec exists. The UI contract for this phase is defined by these decisions; consider `/gsd-ui-phase 61` before planning if the surface warrants its own spec.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `app/src/components/physic-paint/view/AquarelleToolRow.tsx` — the four-tool row (brush | water | pen | lift, shortcuts B/W/P/E), the `physics-paint-segmented-button` visual grammar, `aria-pressed`, and the water-tool grey-out precedent. D-05 adds a fifth entry here.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — the movable, selection-gated Move/Edit modal: no backdrop, no focus trap, header chrome (icon + title + rounded close), `SidebarScrollArea` internals, pinned tab row (Geometry | Stack | Paint). Hosts the spline-pointer toggle (D-06), the width stepper (D-08) and the collapsed advanced wet-params section (D-13).
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` — `resolveStrokeSettingsOpen`, `resolveStrokeSettingsView`, `strokeSettingsFields`, `buildAppearancePatch`, `listStrokeTipOptions`, and the geometry helpers. The projection seam the modal reads; new fields belong here rather than inline in the dialog.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — select mode, selection sets, Shift+A select-all, the paint→eraser→all filter. This is the existing Move/Edit scope that gates the dialog.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `aquarelleActiveTool`, `setAquarelleTool`, the compare-then-write setters, `AquarelleGlobalParams` (the eight globals plus `lift`), and the single record-path commit seam a vector stroke must go through.
- `packages/efx-paint-host/src/animation/types.ts` — the generic `StudioStroke<P>` contract (`pts`, `ticks`, `cuisson`, `motion`, `brushId`, `toolOverrides`, `traceSeed`, `recordedOrder`, `playFrame`, `color`, opaque `engine: P`) and `EngineAdapter<P>`. A vector stroke either fits inside `P` or deliberately extends the host contract — the planner must decide which, and the host-genericity contract tests will say no to engine leakage.
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` — the single engine→host projection, `AquarelleTool = 'brush' | 'water' | 'pen' | 'lift'`, and `AquarelleStrokePayload` (the opaque engine slot). The natural home for anchors and `renderMode`.
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — the fixed bake path where the `simple-ribbon` deposit mode (D-11) lives.
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` and `app/src/components/canvas/transformHandles.ts` — the on-canvas handle precedent: `getHandlePositions`, `hitTestHandles`, `getRotationZone`, `getCursorForHandle`, counter-scaled screen-pixel handles, interaction bracketing via `beginInteraction`/`endInteraction`.
- **Phase 25 (v0.6.0) Bezier Path Editing** — the shipped interaction grammar to imitate: coupled handles by default, Alt+drag breaks the tangent, click a segment to insert, Delete removes, one undo entry per drag gesture. It lives on the **legacy main-editor** paint layer (`app/src/components/overlay/PaintToolbar.tsx`, `paintStore`), so it is a **UX reference only** — the code does not carry over. Note the deliberate inversion: Phase 25's pen tool only edited existing strokes; this phase's pen tool draws.

### Established Patterns

- **One engine, one host.** `StudioStroke<P>` / `EngineAdapter<P>`; the host never inspects `P`. A second renderer would violate the v2.0.0 single-engine pivot.
- **Dual-language `.mce` law.** Every new field is declared in BOTH the TS interface and the Rust struct, enforced by `mceFieldContract.test.ts`. serde silently drops undeclared keys on open.
- **Conditional canonical terms.** Write a field only when it is present and non-default, so an untouched object stays byte-identical. D-10's sparse width profile is a direct application.
- **Determinism is structural.** 60 Hz integer ticks, FNV-1a `traceSeed`, no `Math.random()` in deposit/simulation; the same script must produce the same pixels across runs, undo/redo and reopen.
- **Fail-closed parsing.** An unreadable value refuses with a named visible error; never drop data silently.
- **Session-only view state never enters `.mce`.** Canvas zoom and timeline zoom are the models (D-16).
- **Compare-then-write signal setters** so a same-value commit causes no render and no undo entry.
- **REL-01:** no new runtime dependencies.

### Integration Points

- `AquarelleToolRow.tsx` — the vector pen entry (D-05) and its shortcut arbitration against the existing `P`.
- `PhysicsPaintStrokeSettingsDialog.tsx` + `strokeSettingsModel.ts` — spline-pointer toggle, width stepper, advanced wet params, render-mode switch.
- `aquarelleRecordState.ts` — the record path; a vector stroke must commit through the same seam as a painted one.
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` and `AquarelleStrokePayload` — the payload extension for anchors, sparse widths and `renderMode`.
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — the second deposit mode and its determinism pin.
- The `.mce` document: TS interface, Rust struct, `mceFieldContract.test.ts`, and the round-trip pin (build→hydrate in TS, save→open in Rust).
- The compositor (`app/src/efx-paint/compositor/`) and the export path — hide/solo, ordering, opacity and background behaviour must survive unchanged.

</code_context>

<specifics>
## Specific Ideas

- **"Both worlds."** The user wants *effect brushes* (watercolor deposit) and *simple strokes* (clean ribbon) available in the same product, and was explicit that this must **not** become two engines: *"the clean ribbon should be implemented in watercolor system in one engine. because all law for watercolor apply."*
- **Hybrid is a feature, not an accident.** Simple-ribbon ships with the seven wet globals at zero but reachable in a collapsed section; nudging them up is how a user deliberately blends physics back into a plain ribbon.
- **A new `simple-ribbon` brush preset** belongs in the brush list so the clean path is discoverable without opening a dialog.
- **The width must be visible.** The user asked for the per-vertex width preview in the wireframe, mirroring how Move/Edit already previews stroke width today.
- The pen is a **drawing** tool. Phase 25 deliberately scoped its pen tool to editing only; that inversion here is intentional, not an oversight.

</specifics>

<deferred>
## Deferred Ideas

- **Closed paths and filled vector shapes** — always-open was chosen for this phase. Fill is a new capability with its own model (fill rule, fill colour, hit-testing), not a flag.
- **Full curve menu** (Hermite / user-selectable Catmull-Rom / B-Spline / TCB) — rejected. B-Spline specifically rejected by the approximating-basis argument.
- **On-canvas width handles** — rejected in favour of the numeric stepper; revisit only if the stepper proves too slow in live use.
- **Pressure-seeded per-vertex widths at draw time** — rejected in favour of sparse storage; a naturally tapered stroke comes from editing the profile, not from the pen.
- **Painted-stroke curve editing** — Phase 62. Spline-pointer must not enter curve mode on a hand-painted stroke here.
- **Interpolation wiggle on vector strokes** — the milestone's gate 5; not in VEC-01..07 and not discussed. If it is wanted, it arrives with the motion model, not with the pen.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — "Frame fade — compositing/export cumulative-frame crossfade (separate from opacity)". Surfaced again by the todo matcher (score 0.6) on the words export/opacity/feasibility, but it is a composite-time crossfade effect with its own staleness contract, not vector painting. Reviewed and deliberately left pending, consistent with Phases 59 and 60 where the same todo was also reviewed and not folded.

</deferred>

---

*Phase: 61-Vector Painting Tool*
*Context gathered: 2026-11-10*
