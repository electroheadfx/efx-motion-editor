# Phase 64: Medium Engine - Context

**Gathered:** 2026-11-17
**Updated:** 2026-11-19 — acrylic bristle deposit extension (plans 64-21…64-24)
**Status:** Ready for planning (extension)

<domain>
## Phase Boundary

Paint gains weight. One `Viscosity` global hardens the fluid; five named `Mediums` (`watercolor`, `gouache`, `pastel`, `graphite`, `acrylic`) apply whole parameter sets in one write; a real paint-**thickness** channel deposited through each dab's own tip is lit as an emboss; a `Body` term makes a covering stroke replace the settled paint under it; a Kubelka-Munk **scattering** term lets a light pigment lighten a dark one; and the brush library groups its responses by medium.

**Extension (2026-11-19): the acrylic brush.** The two bristle responses stop being stamped tips and become a **per-bristle carrier plus a 5-nearest gather**, ported from the reference brush and validated by spike 002. This is the milestone's "denser, heavier, genuinely opaque" claim taken to its physical end: each bristle carries its own loaded paint, picks up what is under it, and deposits on the paper threshold. Acrylic gains a little water so its edges stop reading rigid, and a real **last-touch** field so Wet/Dry means age rather than a proxy. Three of the user's asks drive it (`SPECS/v2.2.0-medium-engine/better-acrylic.md`): blend instead of transparency, directional anti-aliased edges, and acrylic/water with a Dry that stops the mixing.

Delivers (in spec order — the chain is internal and fixed):

- **Spec 03 — Viscosity**: one global raising water dissipation and suppressing spread (`0.12 × (1 − v·0.9)`), snapshotted per stroke like `lift`, applied at exactly two engine sites.
- **Spec 04 — Medium records**: `{ id, name, params }` as plain serializable data; five built-ins over the canonical globals; one store write per switch; medium id advisory, per-stroke params snapshot authoritative.
- **Spec 05 — Thickness + emboss**: ONE document-resolution half-float channel, deposited through the tip's footprint, accumulating across strokes; lit in the composite from a one-texel gradient with a per-document `light` render parameter; captured in the engine snapshot and protected for undo.
- **Spec 06 — Body (order)**: a cover pass reusing the Lift program with the stroke's own tip, eroding settled pigment and thickness under each dab before that dab deposits.
- **Spec 07 — Brush groups**: a compile-time `group` on `BrushPreset`, five library sections, group → medium in one write only when the group changes, 15 responses classified + 8 new ones.
- **Spec 08 — Scattering**: `S` riding the existing `inkB.a` / `fixedB.a` channels, driven by `Body`, composited with the KM layer-over-background form; `S = 0` reproduces today's Beer-Lambert output bit-for-bit.
- **Acrylic bristle deposit (spike 002 slicing)**: 64-21 record + reservoirs (deterministic set, paper seed pinned, no visual change), 64-22 the gather + the mixing law (the cost-bearing core and the cover-mask decision), 64-23 traces + directional edges (§4.3–§5.5 — acceptance ask #2), 64-24 acrylic water + wetness (the R32F last-touch pair — acceptance ask #3). This is a re-opening of the phase, not a replacement: D-01…D-20 stand.

Does **not** add: a paint height field beyond the one thickness channel (MED-F01); extra medium presets (MED-F02); per-band `S`; alpha compositing; any package/type/signal/`BRUSH_PACK_KIND` rename; any `.mce` schema break. Viscosity is additive to the existing globals — never a redefinition of `flow`, `water`, `load`, `bleed` or deposit maths. The bristle extension adds **no second engine**: the per-bristle state and the last-touch field live in `efx-watercolor`'s existing `Engine`/`shaders` and join its existing target/history/whole-doc lists.

</domain>

<decisions>
## Implementation Decisions

### Medium surface

- **D-01:** **The medium picker is a compact dropdown row at the top of the Paint tab, directly above the globals rows** (`AquarelleGlobalsPanel`, mounted by `WatercolorModuleSection`). It shows the selected medium's name and opens a 5-item menu. Cause and effect stay in one stack: picking a medium visibly jumps the rows below it. Not in the top bar, not in the Brush tab.
- **D-02:** **A medium writes exactly the 10 table keys** — `water`, `load`, `flow`, `bleed`, `dry`, `edge`, `granulation`, `viscosity`, `body`, `emboss`. It **never** writes `size` (the shared Size slider owns it, 261017-wmw D-05) and **never** writes `lift` (the eraser popover owns it). Medium records may still be typed as a `Pick<>`/subset of `AquarelleGlobalParams`; the write applies only those 10. **Extension:** the bristle keys (`feather`, `pickup`, `refill`, `wetSeconds`) join the table per D-22 and the Claude's Discretion entry below; the write still applies every key the medium declares, in one assignment.
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
- **D-11:** **The cover pass erases uniformly — no paper-tooth gate.** The `stampFS` re-threshold (`uGrain`/`uGrainThr`) is **not** added to the cover draw. A uniform erase cannot leave dark speckles of unerased pigment in the paper's valleys, and the cover pass's real customers are gouache (55) and acrylic (90), which say "no tooth"; the new deposit re-adds its own tooth pattern on top. (Spec 06's "chalk says yes / acrylic says no" is settled as **no**.) **Extension:** for bristle responses the erase is bristle-modulated (D-21), but it still carries no paper-tooth gate.
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

### Acrylic bristle deposit (64-21 … 64-24)

- **D-21:** **The cover is bristle-modulated for bristle responses.** At Body > 0 the erase mask comes from the same 5-nearest gather that deposits, so where the response leaves no paint the settled underlayer stays visible ("gaps show the underlayer"). A dry brush therefore reads as a dry brush at full Body instead of a solid marker. Consequence for 64-22: the footprint mask is no longer the cover's mask on these responses, so the Body-100 cost gate must be re-measured — the spike's 675.5 ms (1080²) / 1.17 s (2K) were measured with the footprint cover and are a **reference point, not the acceptance bar**. Non-bristle responses keep the shipping footprint cover unchanged. — **Reversibility:** costly — the mask plumbing and the acceptance baselines move together; reverting re-opens 64-22's gates.
- **D-22:** **`Feather` is a new canonical global (0..100)** that softens the cover edge (64-22) and the acrylic water edge (64-24) with one control. The Paint tab goes 10 → **11** rows. It travels in the medium record and the per-stroke snapshot like every other canonical key, and at 0 it must reproduce the neutral edge exactly (the identity discipline of MED-02). — **Reversibility:** costly — a new canonical key reaches `AquarelleGlobalParams`, `AQUARELLE_GLOBAL_KEYS`, `DEFAULT_AQUARELLE_PARAMS`, the canonical↔vendor mapping, every medium record and the snapshot; removal would leave a dead key in recorded strokes.
- **D-23:** **The live-pickup boundary is declared, not engineered.** A live stroke picks up the paint already on the engine's sheet — i.e. the current session's strokes. Paint committed to an earlier frame or session lives in a WebP raster that the engine never holds, so a stroke crossing it picks that paint up **when it is applied and re-baked**, not live. Hydrating the committed base and replay-on-frame-entry are rejected for this phase. The UAT judges pickup on the applied result.
- **D-24:** **Wetness is the reference's §3.4 last-touch field, not a proxy.** A document-sized `R32F` ping-pong pair holds per-texel last-touch time; the deposit refreshes it weighted by the deposit mask; wetness is `exp(−age / wetSeconds) · alpha` and gates pickup, so Dry genuinely stops the mixing. Measured cost: **+26.1 MB at 1080² / +67.1 MB at 2K** (sheet + undo atlas), **+103 ms** bake on the 20-stroke passage, **0 B** frame cache (every frame starts dry). The channel joins **pool 0 as one `FLOAT_R` layer** and must enter `allocateHistory` / `snapshotLayers` / `travel` / `docTargets` **and** `captureWhole` / `uploadWhole` together — the `relief`/`cover` precedent. Its cleared value is **not** 0: a sentinel one week old, or every texel reads as freshly touched. — **Reversibility:** costly — a new history layer, atlas format, undo snapshot and memory gauge line; removing it later re-opens undo pairing and every capture path.
- **D-25:** **"Water in acrylic" is a retuned medium record, not a new engine term.** Raise the acrylic record's existing `water` / `bleed` / `flow` so the fluid transport produces slightly irregular, flowing edges. No picked-up-moisture term. — **Reversibility:** reversible — numbers in one record; the look changes, the code does not.
- **D-26:** **The gather belongs to the two bristle responses only** — `bristle-flat` and `bristle-round`. Every other response keeps its stamped tip and stays bit-identical. The gather follows the **response, not the medium**: a bristle response carrying the watercolor medium still gets hairs. — **Reversibility:** costly — the response's deposit path, its target usage and its cost profile all change; the other 21 responses are untouched by construction.
- **D-27:** **A texture picked on a bristle response turns the gather off and stamps the texture.** MED-31 ("a texture replaces the selected response's footprint") stands unamended; the texture picker stays a real escape hatch.
- **D-28:** **Trails come from pickup alone.** The carrier already drags picked-up colour along the stroke; the reference's §3.3 deposit-time smear is **not** ported this phase (it mixes straight RGB the spectral field does not store, so a coefficient-space equivalent would be a new law). If UAT says the crossing does not trail enough, the smear is its own measured term.
- **D-29:** **Delivery-law amendment for the bristle slicing.** The ROADMAP's "no new render target / no new program" clauses are amended **exactly** to: three `RGBA16F` `1×256` reservoir targets plus one static `1×256` shape target (ping-ponged), and the document-sized `R32F` last-touch pair (D-24) — plus three passes (the `1×256` carrier, the gather over the dab rectangle, the touch refresh). Nothing else: no second engine, no new full-document pass beyond the last-touch pair, no package/type/signal/`BRUSH_PACK_KIND` rename, no `.mce` break. The byte-identity set that must survive unchanged: neutral watercolor, `Body = 0`, `S = 0`, `emboss = 0`, and **every non-bristle response**.
- **D-30:** **The pending UAT is split around the extension.** Rows 1 (Viscosity), 3 (reopen/replay + per-layer light), 4 (Paper & Light drag) and 5 (Play/Apply bakes) run **now** against the 20-plan build. Rows 2 (undo/redo of a covering stroke) and 6 (zoom/emboss) are **deferred to the post-bristle UAT**, because the new cover mask and the last-touch layer change exactly what those rows assert. No row is tested against a build it no longer describes, and nothing is tested twice.

### Claude's Discretion

- **Params surface (decided here, not asked):** `feather` (D-22), `pickup` and `refill` join the canonical global set **and** the Paint tab (13 rows); `wetSeconds` stays a **medium-record value with no row** — it is temporal and rarely tuned, while pickup/refill are the two knobs the reference exposes and the ones that carry the "clean start, muddy middle, dry scrape" feel. `Feather` sits after Body; `pickup`/`refill` sit after Feather.
- **Paper seed (decided here, not asked):** the paper seed is **recorded as an additive optional document field**, on the light's precedent (declared in TS and Rust in the same pass, fail-closed parser, `mceFieldContract.test.ts` tripwire). A fresh replay sets it before the first stroke; absent reads as derived from the document id. This closes the pre-existing replay-equality gap spike 002 proved on the **current** engine (`det-paper-baseline`: `7d58f971` vs `c5594fba`), and it is what makes 64-21's determinism gate meaningful. — **Reversibility:** costly — a persisted document field reaches both languages; removal is a contract change.
- The exact tuned medium numbers — spec 04's amendment table is the starting point; the plan records what it ships. Same for the retuned acrylic `water`/`bleed`/`flow` (D-25).
- Exact `S_MAX`, the perceptual curve's exponent, the scattering epsilon, and the numerically stable small-argument form of the KM expression (verified band by band, never a divide-by-zero).
- The thickness deposit's proportionality constant and half-float ceiling; whether the thickness channel joins the paper-grain fingerprint and the memory gauge (measure and state the cost).
- `uMode == 4` (pigment alpha): apply the emboss to the premultiplied colour and leave alpha untouched (spec's recommendation), rather than skipping the emboss.
- Cover-pass falloff: reuse `liftFS`'s existing `exp(-(q·q)²)` profile unchanged — the Lift tool keeps its own behaviour (spec 06 exclusion), so no falloff unification and no second program. Measure a covering stroke against the same stroke at `Body 0`; if a lip or halo appears, tune `uAmount`, never the shader's support.
- Light control shape (three steppers/sliders in the Paper tab) and the exact azimuth/elevation values that reproduce `paperLightFS`'s direction.
- The acrylic bristle striation is a **procedural tip** (spec's recommendation), not a machine-scoped texture — deterministic and travels with the build.
- Plan decomposition across the six specs (the internal chain 03 → 04 → 05 → 06 → 07 → 08 is fixed by `Depends on`/`Blocks`).
- **Bristle slicing constants:** the gather's bite-size terms (`count` clamp 40–256, spacing `2/count`, radius floor 0.8 px), the reservoir layout (three `RGBA16F` at 24 B/bristle: carried absorbance 0–3; 4–6 + alpha; load/across/seed/jitter), the sentinel age, the `wetSeconds` default, the *contact/landing/dryEdge* defaults (§6), and the exact `Feather` falloff shape. Every one must cite its notes section.
- The **seed call order** for the bristle set is part of the record's meaning — one `traceSeed` RNG, one draw per field even when a run is clipped (the spike's `bristles.ts`, 99 lines, 8-float stride).

</decisions>

<gap_closure_rulings>
## Gap-Closure Rulings (2026-11-22, from `/gsd-plan-phase 64 --gaps`)

- **G-01 — Criticals first (scope of this run).** This gap-closure run fixes **CR-03, CR-04, WR-03 and WR-04** and the regression gates that would have caught them. The visible acrylic contract (UAT rows 11–14, GAP-1…GAP-5) and the probe-baseline / invariant re-authoring are a **follow-up gap-closure run**, planned once the paint law stops moving — so the baselines are re-authored once, not twice. *(The follow-up run is now planned as 64-29..64-38, scoped 2026-11-22 to visible closure GAP-1..GAP-4 plus the probe contract; GAP-5 excluded, see G-04.)*
- **G-02 — Body stays bag-only; do not touch it.** Body was removed from the Paint panel by quick 261121-mtu and **defaults to 0**. No Body row returns in this milestone. MED-19, ROADMAP SC5 and 64-06 truth 1 are amended to "exposed through medium selection only, default 0"; the value stays in `AQUARELLE_GLOBAL_KEYS`, the medium records and the Reset key set.
- **G-03 — D-27 amended: a texture tip composes with the bristle gather.** A brush carrying a `textureId` no longer bypasses `isBristleResponse`; the texture modulates the gather/deposit while hairs, pickup and wetness remain. UAT row 14 ("at least as good as either path alone") is the acceptance. Implemented in the follow-up run.
- **G-04 — D-28 amended: a coefficient-space smear is in scope.** The artist wants the reference's trainées (trails dragging underlying colour). The smear is a **new measured term in coefficient space** (never an RGB smear, per D-28's constraint), driven by pickup/feather. Implemented in the follow-up run. *(Superseded 2026-11-22 by the visible-closure scope ruling: GAP-5 stays OUT of phase 64; D-28's no-RGB-smear constraint stands. The smear is not planned by 64-29..64-38.)*
- **G-05 — Emboss stays capped at 15.** The cap is the artist's post-UAT decision recorded at `aquarelleParamVisibility.ts:87-90`; 64-04 truth 5 is amended from 0..100 to the capped band rather than the cap being raised.
- **G-06 — UAT rows 11–14 remain the artist's live judgement.** No row is marked passed by this run; the criticals close defects, the follow-up lands the visible behaviours, and the artist re-tests on the native surface.
</gap_closure_rulings>

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

### Acrylic bristle extension (the new work's authority)
- `SPECS/v2.2.0-medium-engine/better-acrylic.md` — the three user asks (blend not transparency · directional anti-aliased edges · acrylic/water with Wet + feather) and the REA Brush-blending remarks (blending in the brush and on contours, trails, edge variation)
- `.planning/spikes/002-acrylic-bristle-deposit/README.md` — **the primary reference**: per-leg verdicts with numbers, the complete formula table carrying its § numbers, the Studio touch-point table, the "What NOT to port" list, the proposed 64-21…64-24 slicing, and the 2026-11-19 frontier measurement (gather + Body-100 coverage compose)
- `.planning/spikes/002-acrylic-bristle-deposit/results/*.json` — every gate capture quoted in the README (digests, durations, region means, GPU bytes, reservoir digests)
- `.claude/skills/spike-findings-efx-motion-editor/SKILL.md` — packaged blueprint; `references/bristle-deposit.md` is the condensed build law and `sources/002-acrylic-bristle-deposit/` preserves `bristles.ts`, `bristleShaders.ts`, `patches/Engine.diff` and the probe. **Patches are against base `406d1ead1` and must be read as law, not applied blindly** — `shaders.ts` has since gained 64-20's coverage transport (`advectCoverFS`, `coverClearFS`, `FILM_PRESENCE`).
- `/Users/lmarques/Dev/craft-brushes/notes/brush-blending.md` — the reverse-engineered algorithm (external absolute path). **Every claimed formula must quote its section: §2, §3.1–§3.5, §4.1–§4.5, §5.1–§5.6, §6, §8, §9**
- `/Users/lmarques/Dev/craft-brushes/site/assets/app.js` — the reference shaders (`F` bristles, `R` stamp, `I` present); consulted **only** for ambiguities (e.g. `spacing` normalised at app.js:1208–1213)
- `.planning/spikes/001-coverage-composite/VERDICT.md` — the approved coverage composite (spike 001) the gather composes with; authority for the `Body` coverage law 64-13…64-17 shipped
- `.planning/spikes/MANIFEST.md` — the two idea rows and their VALIDATED verdicts
- `.planning/spikes/WRAP-UP-SUMMARY.md` — methodological carry-overs (prove neutrality before believing a delta; compare inside the same harness; one engine per page; median over p95)

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` §Medium Engine — MED-01..MED-38, MED-F01, MED-F02, and the Out of Scope table. **MED-01..38 are all satisfied by plans 64-01…64-20; the bristle extension is specified by `better-acrylic.md` + spike 002, not by a MED id.**
- `.planning/ROADMAP.md` §"Phase 64: Medium Engine" — goal, 7 success criteria, spec provenance, delivery law (amended by D-29)

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
- `app/src/lib/mceFieldContract.test.ts` — the field-diff pin; the definition of done for the new optional document `light` field **and the paper seed field** (declared in BOTH TS and Rust in the same pass)
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` — the content fingerprint seam (`getContentSignature`, :125-126): "any script mutation must change it" — the light must join it so a light change is a cache miss and a deterministic re-bake
- `.planning/REQUIREMENTS.md` Out of Scope — the exact list of what may not be added (no alpha compositing, no per-band `S`, no second engine)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`BrushSection`** (`WatercolorBrushLibrary.tsx:284`) — already renders a full-width section with an uppercase title and its own 2-column card grid; generalize its `id` from the literal `'responses'` and map five groups in fixed order. `BrushCard` needs no change.
- **`SliderStepper`** — the row control the globals panel uses; the three new global rows (Viscosity, Body, Emboss), the three light rows, and the extension's **Feather / Pickup / Refill** rows reuse it.
- **`aquarelleParams` + `setAquarelleParam`** — the live params bag and its compare-then-write law; D-04's medium write is one spread assignment on this bag, not a series of setter calls.
- **`liftFS` + `lift()`** — the tip-footprint erase with `uAmount` and `FUNC_ADD / ZERO, ONE_MINUS_SRC_COLOR`; the cover pass is this program plus a second target, not a new program.
- **`paperLightFS`** — the central-difference normal and fixed upper-left light; the emboss reuses its maths (and D-13's one-texel radius) and D-09's default direction comes from it.
- **`eachDab` / `stamp()`** — the single dab loop where the cover pass and the thickness deposit both slot in; `brushInk` is the existing deposit seam the gather replaces **for the two bristle responses only** (D-26). The verified order today is `coverPass` → `coverageDeposit|brushInk` (Engine.ts:2188-2196); the carrier must run **before** `coverPass`.
- **`history.protect` + `snapshotLayers()`** — `lift()` already protects the settled pool per dab; the cover pass must protect **both** pools itself, before its first draw, because it runs before `brushInk`'s own `touch()`.
- **`HALF_FLOAT_R` + the target block (`Engine.ts:408-415`)** — the one-format single-channel target the thickness channel copies (`wet` is the precedent), and the same precedent for the last-touch `FLOAT_R` pair (D-24).
- **`captureWhole`/`uploadWhole`** — the whole-document snapshot `WholeDoc.layers` gained `relief` and `cover` before; the last-touch channel must join it or a resize silently loses the wetness memory.
- **`PaperPicker` / `RightPanelPaperTab`** — the per-document render-settings pattern the light rows join.
- **The spike workbench as read-as-law** — `.planning/spikes/002-acrylic-bristle-deposit/workbench/src/playground/bristles.ts` (deterministic set, fixed RNG call order) and `bristleShaders.ts` (carrier / deposit / cover / touch fragments). Copy the laws and the call order; the workbench's additive absorbance deposit is **not** the acceptance look (its crossing reads darker than the stroke body — that is the pickup signature).

### Established Patterns

- **One store write per user action.** Medium switch = one params write; group→medium = one handler that also writes the medium id.
- **Per-stroke params snapshot is authoritative; the medium id is advisory.** A stroke replays from its recorded bag, never from the current medium.
- **Compare-then-write** (`efx-preact-reactivity` rule 3); signals only, never `useState`; no signal writes from a render body; identity-stable effect deps.
- **Fail-closed, total parsers** for anything persisted; new fields declared in BOTH TypeScript and Rust in the same pass (serde silently drops undeclared keys; `mceFieldContract.test.ts` is the tripwire).
- **Bit-identity is a numeric contract, not a visual one.** `S = 0`, `emboss = 0`, `Body = 0`, viscosity at default, `Feather = 0`, and every non-bristle response each get pixel-buffer comparisons.
- **Replay determinism is the acceptance bar** for every term: same stroke ⇒ same raster live, on bake and on replay. The bristle set is a pure function of the recorded `traceSeed` in a fixed call order, and the paper seed must be pinned (D-24 / Claude's Discretion) — the current engine already fails replay equality without it.
- **No backward compatibility for old projects** on format changes — but here every new key is additive and defaults neutral, so nothing needs migrating.
- `vitest run`, never watch. Do not start the server. Build from `packages/efx-watercolor/src/`, never `dist/`.
- **Probe methodology** (`probe/medium-engine/`): one engine per page for cost gates; `bakeMs`/`renderMs` are **measured, never gated** (64-17's contract); prove neutrality before believing a delta; median over p95.

### Integration Points

- **`AquarelleGlobalsPanel`** — the medium dropdown joins as its first row; `GLOBAL_ROWS` grows from 7 to 10 (shipped) to **13** with Feather/Pickup/Refill; the Reset batch must cover exactly the keys each medium declares (never `size`, never `lift`).
- **`WatercolorModuleSection`** — mounts the globals panel; no structural change beyond the new rows.
- **`PhysicsPaintRightPanel` → `RightPanelPaperTab`** — the light rows join the paper/grain props; the tab heading becomes "Paper & Light".
- **`WatercolorBrushLibrary`** — five `BrushSection`s replace the single "Brushes" section; the texture strip and import row stay above the grid, unchanged.
- **`Engine.Params` + `params.ts` `toEngineParams`** — `viscosity`, `body`, `emboss`, and now `feather`, `pickup`, `refill` enter the vendor bag and the ONE canonical mapping; the canonical record grows past 12 keys.
- **Engine snapshot / undo / cache** — `WholeDoc.layers.relief`, `WholeDoc.layers.cover`, now `WholeDoc.layers.<last-touch>`; `snapshotLayers()`, the memory gauge, and the Studio content fingerprint are the places thickness, light and wetness must be threaded through, or undo, restore or the cache will silently diverge.
- **`stamp()` brush branch** — insert `bristleTravel()` → `carrierPass()` before `coverPass()`; replace `brushInk()` with the gather for the two bristle responses; `brushRelief()` and the wet draw keep their order. The carrier **must** sample the canvas before the dab deposits or it picks up its own output.
- **`adapter/engineAdapter.ts` + `payload/toStudioStroke.ts`** — `setRandom(seededRandom(1))` runs at adapter creation (:250), `applyPaper` at :258; the pinned paper seed must be set **before** the first `applyStroke`, and `traceSeed` (derived from `mutationId`) already keys the bristle set — no new per-stroke field is needed for the set itself.
- **`.mce`** — the optional document `light` field, the additive per-stroke `viscosity`/`body`/`emboss` (and now `feather`/`pickup`/`refill`) keys inside the opaque params bag the Rust side already round-trips as a `Value`, plus the new **paper seed** document field (Claude's Discretion, light precedent).

</code_context>

<specifics>
## Specific Ideas

- The five mediums are the milestone's vocabulary: a **response** is the physical behaviour of a brush, a **medium** is the paint it carries. Every UI decision above is built to keep those two axes from blurring — and D-26 extends it: the gather is a response property.
- The `watercolor` medium **IS** today's `DEFAULT_AQUARELLE_PARAMS` with every new key at 0 — a fresh session must be bit-identical to the pre-milestone build.
- The light being on by default is deliberate: the milestone's headline ("heavy paint has visible body") must be visible the moment acrylic is picked, not hidden behind a knob the user has to find.
- `Body` is the one control that does two jobs (order + opacity) on purpose, which is why D-14 gives it one curve.
- The user's standing expectation: the imported/shipped visual must actually change — a label or a greyed control is not delivery.
- **From the user, on the acrylic (better-acrylic.md):** "je veux que le réglage à 100% agit comme un super mélangeur et à 0% il mélange rien. Les bords devrait avoir une valeur edge de mélange, actuellement c'est trop net." — Body at 100 must *mix*, edges must blend, and at 0 nothing mixes. D-21 and D-22 answer this.
- **From the user, on the brush (REA remarks):** blending in the brush and on contours, *trainées* (trails) that drag the underlying colour, better anti-aliasing, and a natural random edge variation on top of the tips.
- **"Pickup is the trail"** — the reservoir carrying picked-up colour along the stroke is the trail; no separate smear term (D-28).
- The workbench's crossing reading darker than the stroke's own body (89.9 vs 113.3 luma) is the **pickup signature**, not a finished look — the acceptance is the applied result on the real engine.

</specifics>

<deferred>
## Deferred Ideas

- **MED-F01** — A real paint height field: directional buildup, knife ridges, bristle striations as true impasto geometry. The one thickness channel is deliberately not that.
- **MED-F02** — Additional medium presets beyond the five built-ins.
- **Pen-tool thickness** — deliberately excluded this phase (D-12). If pen strokes later need body, it is its own second deposit law outside the dab loop.
- **Collapsible brush sections** — considered and rejected for this phase (D-19); session-only collapse is the natural pickup if the 23-card library proves long in practice.
- **§3.3 coefficient-space smear** — rejected this phase (D-28). If UAT says pickup does not trail enough, it returns as its own measured term — it is a new law, not a port.
- **Exact live pickup parity** — base hydration and replay-on-frame-entry were rejected (D-23). Either returns as its own architecture phase if live/committed divergence proves visible in practice.
- **Picked-up moisture feeding the fluid** — rejected (D-25); the acrylic record retune is the answer this phase.
- **Half-resolution or compressed last-touch channel** — a memory lever if +26.1 / +67.1 MB proves heavy on real hardware; it would blur the wetness field and needs its own measurement.
- **The gather on more responses** — deferred by D-26; adding a response that carries it is additive.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing.md` — "Frame fade — compositing/export cumulative-frame crossfade". Matched only on the keywords `compositing`/`export`/`watercolor` (score 0.6); unrelated to the Medium Engine. Not folded. Re-checked 2026-11-19 for the bristle extension — still unrelated.

</deferred>

---

*Phase: 64-Medium Engine*
*Context gathered: 2026-11-17 · updated 2026-11-19 (acrylic bristle deposit)*
