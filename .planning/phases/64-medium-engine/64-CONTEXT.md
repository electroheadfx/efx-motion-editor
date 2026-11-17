# Phase 64: Medium Engine - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Paint gains weight. One `Viscosity` global hardens the fluid; five named `Mediums` (`watercolor`, `gouache`, `pastel`, `graphite`, `acrylic`) apply whole parameter sets in one write; a real paint-**thickness** channel deposited through each dab's own tip is lit as an emboss; a `Body` term makes a covering stroke replace the settled paint under it; a Kubelka-Munk **scattering** term lets a light pigment lighten a dark one; and the brush library groups its responses by medium.

Delivers (in spec order — the chain is internal and fixed):

- **Spec 03 — Viscosity**: one global raising water dissipation and suppressing spread (`0.12 × (1 − v·0.9)`), snapshotted per stroke like `lift`, applied at exactly two engine sites.
- **Spec 04 — Medium records**: `{ id, name, params }` as plain serializable data; five built-ins over the canonical globals; one store write per switch; medium id advisory, per-stroke params snapshot authoritative.
- **Spec 05 — Thickness + emboss**: ONE document-resolution half-float channel, deposited through the tip's footprint, accumulating across strokes; lit in the composite from a one-texel gradient with a per-document `light` render parameter; captured in the engine snapshot and protected for undo.
- **Spec 06 — Body (order)**: a cover pass reusing the Lift program with the stroke's own tip, eroding settled pigment and thickness under each dab before that dab deposits.
- **Spec 07 — Brush groups**: a compile-time `group` on `BrushPreset`, five library sections, group → medium in one write only when the group changes, 15 responses classified + 8 new ones.
- **Spec 08 — Scattering**: `S` riding the existing `inkB.a` / `fixedB.a` channels, driven by `Body`, composited with the KM layer-over-background form; `S = 0` reproduces today's Beer-Lambert output bit-for-bit.

Does **not** add: a paint height field beyond the one thickness channel (MED-F01); extra medium presets (MED-F02); per-band `S`; alpha compositing; any new render target beyond the thickness channel; any package/type/signal/`BRUSH_PACK_KIND` rename; any `.mce` schema break. Viscosity is additive to the existing globals — never a redefinition of `flow`, `water`, `load`, `bleed` or deposit maths.

</domain>

<decisions>
## Implementation Decisions

### Medium surface

- **D-01:** **The medium picker is a compact dropdown row at the top of the Paint tab, directly above the globals rows** (`AquarelleGlobalsPanel`, mounted by `WatercolorModuleSection`). It shows the selected medium's name and opens a 5-item menu. Cause and effect stay in one stack: picking a medium visibly jumps the rows below it. Not in the top bar, not in the Brush tab.
- **D-02:** **A medium writes exactly the 10 table keys** — `water`, `load`, `flow`, `bleed`, `dry`, `edge`, `granulation`, `viscosity`, `body`, `emboss`. It **never** writes `size` (the shared Size slider owns it, 261017-wmw D-05) and **never** writes `lift` (the eraser popover owns it). Medium records may still be typed as a `Pick<>`/subset of `AquarelleGlobalParams`; the write applies only those 10.
- **D-03:** **No "edited" marker.** After a manual global tweak the medium stays selected and nothing new is drawn (MED-13). **Re-picking the already-selected medium re-applies its full record** — that is the "get back to pure acrylic" path, with zero extra UI. The globals rows are the truthful display of drift.
- **D-04:** **Every medium application is ONE write to the live params bag** — `aquarelleParams.value = { ...current, ...mediumParams }` (the compare-then-write law at `aquarelleRecordState.ts:308`), plus the selected-medium id in the same handler. Never a cascade of `setAquarelleParam` calls.
  **Requirement amendment:** spec 07 §2 names `commitAquarelleSelectionParams` as "the existing single-write path". That function patches the **selected strokes** and returns `null` with no active selection (`aquarelleStrokeSelection.ts:735-753`); it cannot set the next stroke's values. MED-11 ("selecting a medium never alters already-recorded strokes… the medium sets values for the next stroke only") and spec 07 UAT 2 require the live bag. **D-04 supersedes that parenthetical**; a medium switch is never a selection edit.
- **D-05:** **The brush-group path shares D-04's write.** Picking a response card selects the response and, **only when the group changed**, applies that group's medium through the same handler and sets the medium id — so the Paint-tab dropdown never disagrees with the params. Inside a group nothing is written (MED-28/MED-13).

### Light and emboss

- **D-06:** **The three light controls (azimuth, elevation, intensity) live in the Paper tab, below the paper grain rows** (`RightPanelPaperTab`). The tab's heading becomes **"Paper & Light"**. The light is a document-level render setting like the paper; it is not a Paint-tab global and it is not a floating sheet.
- **D-07:** **`emboss` is a Paint-tab globals row** alongside Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed, Viscosity and Body — it is a canonical per-stroke param carried by the medium and snapshotted with the stroke (MED-16). The Paint tab therefore goes from 7 to **10** rows.
- **D-08:** **The light is per paint-layer document**, stored next to the paper in the same document record (`efx_paint_documents`, keyed by layer). Not project-wide: two paint layers may be lit differently.
- **D-09:** **The light ships ON by default**: azimuth/elevation taken from the fixed upper-left direction `paperLightFS` already uses, `intensity = 1.0`. This is "today's light" — the light that already lights the paper — so emboss > 0 reads with body the moment a heavy medium is picked. Bit-identity is preserved independently: zero thickness lights to **exactly 1.0** at any intensity (an emboss is a gradient term, never a flat multiply), so `emboss = 0` leaves every pre-milestone project byte-identical.

### Heavy-paint feel

- **D-10:** **Thickness = the dab's own ink amount × `emboss`** — the value already in the dab loop (`amount`, `Engine.ts:1939`). No separate load/capacity term. The tip's contour, `roughness` and `stampJitter` therefore appear as real ridges, a dry brush's skipped dabs give a broken ridge line, and relief always agrees with the visible trace.
- **D-11:** **The cover pass erases uniformly — no paper-tooth gate.** The `stampFS` re-threshold (`uGrain`/`uGrainThr`) is **not** added to the cover draw. A uniform erase cannot leave dark speckles of unerased pigment in the paper's valleys, and the cover pass's real customers are gouache (55) and acrylic (90), which say "no tooth"; the new deposit re-adds its own tooth pattern on top. (Spec 06's "chalk says yes / acrylic says no" is settled as **no**.)
- **D-12:** **Pen/vector strokes deposit no thickness and run no cover pass.** `case 'pen'` splats through its own round `splatInk` path with no dab loop and no tip footprint (`Engine.ts:1968`), so it has neither a tip to deposit through nor a place in the cover pass. **Declared behaviour:** pen strokes render flat even at `emboss > 0` / `Body > 0`; the UAT must not imply otherwise. This keeps MED-14's "through its own tip" law literal and one deposit site.
- **D-13:** **The emboss gradient samples ONE document texel**, exactly as `paperLightFS` does for the paper relief, so paint body and paper texture read as one light. Document-space sampling means zoom never changes it (no shimmer, no crawl), and LINEAR half-float sampling keeps it smooth when zoomed. It captures the bristle striations, roughness and `stampJitter` grooves that spec 07's new tips exist to show.

### Scattering

- **D-14:** **One shared perceptual curve `f(body)` drives both terms** — `S = S_MAX × f(body)` and the cover-pass erase amount. Opaque paint both scatters and replaces; a single control must move both, or the physical-coherence claim and MED-36 break. Shape: low-mid `Body` stays a glaze, only high `Body` reaches a true cover — this makes spec 08 UAT 3 ("Body 50 lightens without erasing; the dark still tints it") literal. Exact `f`, `S_MAX` and the epsilon are recorded in the plan.
- **D-15:** **`paperCol` stays a final RGB multiply on every `uMode` path** — the paper's tint, mottling and relief keep reading through covering paint. Physical purity (real acrylic hides the paper) is traded for the sheet still feeling like a sheet, and every `uMode` path keeps its current structure — which protects the byte-identical gates.
- **D-16:** **Granulation and edge modulation scale `S` too.** The existing `a *= k; b *= k` (`shaders.ts:676-681`) also scales the scattering scalar: grain is a pigment phenomenon, so it must pool opacity as well as colour, or the grainiest paint would look the flattest.
- **D-17:** **`S ≈ 0` takes an early-out using today's exact exponential arithmetic**; the KM form runs only for texels that actually carry `S`. This makes the watercolor path cost the same as today by construction and makes the `S = 0` bit-identity gate trivial — the old maths literally runs.

### Brush library sections

- **D-18:** **Five sections with short uppercase headers — `WATERCOLOR`, `GOUACHE`, `CHALK`, `GRAPHITE`, `ACRYLIC`** — reusing the existing `BrushSection` label style (10px, 700, uppercase, secondary text colour). **Requirement amendment:** spec 07's "Chalk / pastel" and "Acrylic / oil" headers are replaced by the short names, so every section header matches the medium name in D-01's dropdown.
- **D-19:** **No collapse.** Always expanded, fixed order, scrolling is the only navigation (spec 07: no filter, no search, no collapse-state persistence). Each section keeps its own **2-column** grid — the existing `BrushSection` contract the card CSS was written against.
- **D-20:** **No group indication beyond the selected card's own highlight.** The selected card shows the response; the Paint-tab medium dropdown shows the paint. No highlighted section header, no per-section counts.

### Claude's Discretion

- Exact `S_MAX`, the perceptual curve's exponent, the scattering epsilon, and the numerically stable small-argument form of the KM expression (verified band by band, never a divide-by-zero).
- The exact tuned medium numbers — spec 04's amendment table is the starting point; the plan records what it ships.
- The thickness deposit's proportionality constant and half-float ceiling; whether the thickness channel joins the paper-grain fingerprint and the memory gauge (measure and state the cost).
- `uMode == 4` (pigment alpha): apply the emboss to the premultiplied colour and leave alpha untouched (spec's recommendation), rather than skipping the emboss.
- Cover-pass falloff: reuse `liftFS`'s existing `exp(-(q·q)²)` profile unchanged — the Lift tool keeps its own behaviour (spec 06 exclusion), so no falloff unification and no second program. Measure a covering stroke against the same stroke at `Body 0`; if a lip or halo appears, tune `uAmount`, never the shader's support.
- Light control shape (three steppers/sliders in the Paper tab) and the exact azimuth/elevation values that reproduce `paperLightFS`'s direction.
- The acrylic bristle striation is a **procedural tip** (spec's recommendation), not a machine-scoped texture — deterministic and travels with the build.
- Plan decomposition across the six specs (the internal chain 03 → 04 → 05 → 06 → 07 → 08 is fixed by `Depends on`/`Blocks`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase specs (the authority; D-04 and D-18 amend spec 07)
- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-03-viscosity.md` — Viscosity global, two engine sites, per-stroke snapshot, neutral default
- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-04-medium-profile.md` — medium record shape, five built-ins + amendment table, one-write law, no rename
- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-05-pigment-relief.md` — thickness channel, deposit through the tip, emboss, per-document light, snapshot/undo, declared behaviours
- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-06-coverage.md` — `Body` order, cover pass via the Lift program, double-pool protection, declared behaviours
- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-07-brush-groups.md` — `group` tag, classification table, 8 new responses, sections (amended by D-04/D-18)
- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-08-scattering.md` — KM scattering, `S` channels, calibrations, `S = 0` gate, declared behaviours

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` §Medium Engine — MED-01..MED-38, MED-F01, MED-F02, and the Out of Scope table
- `.planning/ROADMAP.md` §"Phase 64: Medium Engine" — goal, 7 success criteria, spec provenance, delivery law

### Prior phase context
- `.planning/phases/63-brush-tip-pipeline/63-CONTEXT.md` — the brush library's two-axis structure, `BrushSection`, D-02 (`BrushesDocker` never revived), D-03 (sectioned grid), the single-mapping law for tips

### Live code sites the specs name (line numbers have drifted — verify before editing)
- `packages/efx-watercolor/src/playground/Engine.ts` — `Params`/`DEFAULT_PARAMS` (:14-36), target allocation (:408-415), `stamp()` `case 'brush'` dab loop (:1922-1946), `case 'pen'` `splatInk` path (:1968), `brushInk` (:2036), `lift()` (:2143), dissipation (`uDissipation`, :2227), spread (`uSpread`, :2275), `captureWhole`/`uploadWhole` (:524-549), `snapshotLayers` (:2085)
- `packages/efx-watercolor/src/playground/shaders.ts` — `stampFS` (:35), `advectInkFS` (:194), `settleFS` (:248), `bleachFS` (:262), `liftFS` (:280), `paperLightFS` (:528), `displayFS` (:620), granulation/edge modulation (:676-681), `col = rgb * paperCol` (:728)
- `packages/efx-watercolor/src/playground/params.ts` — `AquarelleCanonicalParams` / `DEFAULT_CANONICAL_PARAMS` / `toEngineParams` (the ONE canonical ↔ vendor mapping)
- `packages/efx-watercolor/src/playground/brushes.ts` — `BrushPreset` (:11-56), `BRUSH_PRESETS` (15 ids)
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `AquarelleGlobalParams` / `AQUARELLE_GLOBAL_KEYS` / `DEFAULT_AQUARELLE_PARAMS`, `aquarelleParams`, `setAquarelleParam` (:308, the compare-then-write law)
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` — `GLOBAL_ROWS` (:27), the Reset batch
- `app/src/components/physic-paint/view/aquarellePaintControls.ts` — `pickAquarelleBrush`, `commitAquarelleSelectionParam(s)` (**selection edits only** — see D-04)
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — `commitAquarelleSelectionAppearance` (:735) and its no-selection `null` return
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` — `BrushSection` + `BrushCard` (:284-380), the texture strip above the grid
- `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` — the per-document render-settings home for the new light rows
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — paper-tab props wiring (:337)

### Persistence and cache laws
- `app/src/lib/mceFieldContract.test.ts` — the field-diff pin; the definition of done for the new optional document `light` field (declared in BOTH TS and Rust in the same pass)
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` — the content fingerprint seam (`getContentSignature`, :125-126): "any script mutation must change it" — the light must join it so a light change is a cache miss and a deterministic re-bake
- `.planning/REQUIREMENTS.md` Out of Scope — the exact list of what may not be added (no alpha compositing, no per-band `S`, no second engine)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`BrushSection`** (`WatercolorBrushLibrary.tsx:284`) — already renders a full-width section with an uppercase title and its own 2-column card grid; generalize its `id` from the literal `'responses'` and map five groups in fixed order. `BrushCard` needs no change.
- **`SliderStepper`** — the row control the globals panel uses; the three new global rows (Viscosity, Body, Emboss) and the three light rows reuse it.
- **`aquarelleParams` + `setAquarelleParam`** — the live params bag and its compare-then-write law; D-04's medium write is one spread assignment on this bag, not ten setter calls.
- **`liftFS` + `lift()`** — the tip-footprint erase with `uAmount` and `FUNC_ADD / ZERO, ONE_MINUS_SRC_COLOR`; the cover pass is this program plus a second target, not a new program.
- **`paperLightFS`** — the central-difference normal and fixed upper-left light; the emboss reuses its maths (and D-13's one-texel radius) and D-09's default direction comes from it.
- **`eachDab` / `stamp()`** — the single dab loop where the cover pass and the thickness deposit both slot in; `brushInk` is the existing deposit seam.
- **`history.protect` + `snapshotLayers()`** — `lift()` already protects the settled pool per dab; the cover pass must protect **both** pools itself, before its first draw, because it runs before `brushInk`'s own `touch()`.
- **`HALF_FLOAT_R` + the target block (`Engine.ts:408-415`)** — the one-format single-channel target the thickness channel copies (`wet` is the precedent), plus the memory gauge list at :422-423.
- **`captureWhole`/`uploadWhole`** — the whole-document snapshot `WholeDoc.layers` gains `relief` here, or a restored sheet loses thickness while its strokes survive.
- **`PaperPicker` / `RightPanelPaperTab`** — the per-document render-settings pattern the light rows join.

### Established Patterns

- **One store write per user action.** Medium switch = one params write; group→medium = one handler that also writes the medium id.
- **Per-stroke params snapshot is authoritative; the medium id is advisory.** A stroke replays from its recorded bag, never from the current medium.
- **Compare-then-write** (`efx-preact-reactivity` rule 3); signals only, never `useState`; no signal writes from a render body; identity-stable effect deps.
- **Fail-closed, total parsers** for anything persisted; new fields declared in BOTH TypeScript and Rust in the same pass (serde silently drops undeclared keys; `mceFieldContract.test.ts` is the tripwire).
- **Bit-identity is a numeric contract, not a visual one.** `S = 0`, `emboss = 0`, `Body = 0` and viscosity at default each get pixel-buffer comparisons.
- **Replay determinism is the acceptance bar** for every term: same stroke ⇒ same raster live, on bake and on replay.
- **No backward compatibility for old projects** on format changes — but here every new key is additive and defaults neutral, so nothing needs migrating.
- `vitest run`, never watch. Do not start the server. Build from `packages/efx-watercolor/src/`, never `dist/`.

### Integration Points

- **`AquarelleGlobalsPanel`** — the medium dropdown joins as its first row; `GLOBAL_ROWS` grows from 7 to 10; the Reset batch must cover exactly the 10 medium keys (never `size`, never `lift`).
- **`WatercolorModuleSection`** — mounts the globals panel; no structural change beyond the new row.
- **`PhysicsPaintRightPanel` → `RightPanelPaperTab`** — the light rows join the paper/grain props; the tab heading becomes "Paper & Light".
- **`WatercolorBrushLibrary`** — five `BrushSection`s replace the single "Brushes" section; the texture strip and import row stay above the grid, unchanged.
- **`Engine.Params` + `params.ts` `toEngineParams`** — `viscosity`, `body`, `emboss` enter the vendor bag and the ONE canonical mapping; the canonical record grows to 12 keys.
- **Engine snapshot / undo / cache** — `WholeDoc.layers.relief`, `snapshotLayers()`, the memory gauge, and the Studio content fingerprint are the four places thickness and light must be threaded through, or undo, restore or the cache will silently diverge.
- **`.mce`** — the optional document `light` field plus the additive per-stroke `viscosity`/`body`/`emboss` keys inside the opaque params bag the Rust side already round-trips as a `Value`.

</code_context>

<specifics>
## Specific Ideas

- The five mediums are the milestone's vocabulary: a **response** is the physical behaviour of a brush, a **medium** is the paint it carries. Every UI decision above is built to keep those two axes from blurring.
- The `watercolor` medium **IS** today's `DEFAULT_AQUARELLE_PARAMS` with every new key at 0 — a fresh session must be bit-identical to the pre-milestone build.
- The light being on by default is deliberate: the milestone's headline ("heavy paint has visible body") must be visible the moment acrylic is picked, not hidden behind a knob the user has to find.
- `Body` is the one control that does two jobs (order + opacity) on purpose, which is why D-14 gives it one curve.
- The user's standing expectation: the imported/shipped visual must actually change — a label or a greyed control is not delivery.

</specifics>

<deferred>
## Deferred Ideas

- **MED-F01** — A real paint height field: directional buildup, knife ridges, bristle striations as true impasto geometry. The one thickness channel is deliberately not that.
- **MED-F02** — Additional medium presets beyond the five built-ins.
- **Pen-tool thickness** — deliberately excluded this phase (D-12). If pen strokes later need body, it is its own second deposit law outside the dab loop.
- **Collapsible brush sections** — considered and rejected for this phase (D-19); session-only collapse is the natural pickup if the 23-card library proves long in practice.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing.md` — "Frame fade — compositing/export cumulative-frame crossfade". Matched only on the keywords `compositing`/`export`/`watercolor` (score 0.6); unrelated to the Medium Engine. Not folded.

</deferred>

---

*Phase: 64-Medium Engine*
*Context gathered: 2026-11-17*
