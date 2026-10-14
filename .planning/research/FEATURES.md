# Feature Research

**Domain:** Multi-module paint workstation (v2.0.0) — module switcher, watercolor engine, spectral pigment mixing, procedural paper pack
**Researched:** 2026-10-14
**Confidence:** HIGH on oracle/local facts (specs + `SPECS/v1.1.0-water-color/watercolor-playground/` tree read directly); MEDIUM on competitor/"generally" tier (Rebelle page fetched; Krita/CSP/Procreate knowledge tier, docs URLs 404'd)

**Evidence tiers used throughout (quality gate):**
- **[ORACLE]** — `msurguy/watercolor-playground` local tree demonstrates it (method + observable behaviour only; the repo is unlicensed — clean-room rule stands).
- **[GENERAL]** — watercolor / paint apps generally do it (Rebelle confirmed on their site; Krita, Expresii, Clip Studio, Procreate on knowledge tier).
- **[OOS]** — plausible but explicitly out of v2.0.0 scope (locked in specs / PROJECT.md).

---

## Feature Landscape

### (a) Module switcher over ONE shared Studio engine

The switcher is a **surface control, not a document control**. Locked law: modules change the options/features surface drained into the panels; the Studio engine (script record, bake, cache, timeline) is shared and does not fork.

#### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Top-bar MODULE SWITCHER icon near existing icons, three named slots "Brush \| Water color \| Krita" | The milestone's headline; users must see the product is multi-module | LOW | Placement/iconography/grouping are discuss-phase gray zones (DECIDED 2026-10-14) — do NOT pre-decide layout here |
| Krita slot visible but inert ("coming in v2.1.0") | Switcher is designed for three modules; shipping two with a dead third slot is honest | LOW | **Do NOT implement krita** — slot only. Disabled-state styling + tooltip is enough |
| Switching drains the selected module's OWN options into the panels (brush pack + option surface) | Locked: "each module drains its OWN options/features into the panels" | MEDIUM | Needs a declarative per-module panel descriptor (brush list + slider/option set) so adding Krita later is additive, not a rewrite |
| ONE shared Studio engine — script, cache, timeline unchanged by the switcher | Locked architecture invariant | LOW (if respected) | The temptation to fork Studio per module is the main architecture risk |
| Module-specific brush pack visible after switch (Brush = existing engine-1 brushes; Water color = 14 tips + custom) | A switcher that does not change what you can paint with is a dead control | MEDIUM | Brush pack snapshot travels in `.mce` per R1.7 (deliberate exception to 52.2 refs-only law) |
| Fail-closed cross-engine behaviour | Already specified for script Apply (`physicsPaintRotoScriptApplyRefusal` class) | MEDIUM | Extend the same class to "drawing target" honesty: a module's strokes land on that engine's paint kind; unreadable/cross-engine scripts refuse with a named visible error (53.1 law) |

**Expected user-visible behaviour when switching mid-document (recommended default; exact UX is discuss-phase):**
1. Canvas, timeline, caches, Loop Clips, export — completely untouched. No rebake, no reload, no document mutation.
2. Panels repopulate: brush library + option sliders change to the selected module's surface. Panel layout grouping is a gray zone (user decides at integration).
3. Existing layers keep their engine identity forever. A Physics-layer stroke stays physics; an aquarelle-layer stroke stays aquarelle.
4. The switcher sets the **intent for the next stroke / next created paint layer**, not a conversion of what exists. (Recommended: creating a paint layer while a module is active defaults to that module's kind; naming of the 4th layer kind is UI-SPEC scope per Q7.)
5. Script Apply stays fail-closed across engines: a watercolour script refuses onto a Brush-module layer and vice versa, with a named error — never half-applies.
6. Undo/redo, save/reopen and `.mce` are unaffected by switcher position (session/tool state, not document authority). Whether the active module persists across reopen is a gray zone — recommend session-only, consistent with other tool state.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Property-rich option surface per module (aquarelle exposes 8 global params + per-brush multipliers; krita later exposes .myb property stacks) | The whole point of modules: one engine, distinct craft surfaces | MEDIUM–HIGH | The option-surface contract is the real design work of the switcher, not the icon |
| Per-engine stroke payload in one shared script envelope | Scripts remain first-class Studio artefacts across modules without a parallel library | MEDIUM | Locked: shared envelope + per-engine payload; rejected flat `PaintScript` and standalone `WatercolorScript` |
| Brush pack snapshot in `.mce` per module | Old scripts replay identically after the app pack evolves | LOW–MEDIUM | Locked exception to refs-only law — do not "fix" into a reference |
| Third-module readiness proven by two | Shipping 2 of 3 modules through the same seam proves the seam before Krita lands in v2.1.0 | — | Free if the descriptor contract is honest |

#### Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Converting an existing layer/strokes between modules | "I painted in the wrong module" | Engines have different physics and script payloads; conversion is lossy fiction | Delete/redraw, or paste as a baked result; never a convert command |
| Live engine-per-frame or per-stroke module switching inside one layer | "Flexibility" | Breaks determinism, script replay, and cache identity | One engine per paint kind; module switcher only picks the surface |
| Implementing Krita now "since the slot exists" | Third slot looks unfinished | libmypaint WASM + .myb pack is its own milestone (v2.1.0); folded-in it poisons 56 | Visible disabled slot with "v2.1.0" hint |
| Per-module forks of Studio (script, cache, timeline) | Faster local shortcuts | Guarantees drift; the locked invariant exists to prevent it | `efx-paint-host` generic over stroke payload (Phase 55) |
| Migrating v1.0.1 module/script state | "Nice reopen" | Clean break accepted 2026-10-14; migration code is banned | Fail-closed named error for unreadable data (53.1 law) |
| Pre-deciding panel layout / iconography in specs | Desire for certainty | User decides at discuss-phase (DECIDED 2026-10-14) | Capture behaviour contracts only; layout is integration-time |

#### Complexity & dependencies (switcher)

- **Depends on:** Phase 55 `efx-paint-host` (shared Studio law, generic payload) — the switcher is a consumer of that seam, not a sibling implementation. Engine brush packs (aquarelle pack from 56; engine-1 brushes already exist).
- **Complexity:** the shell is LOW; the **drain contract** (what a module publishes to the panels) is MEDIUM and is where future Krita cost is won or lost.
- **Existing-feature coupling:** paint layer kinds (Basic/FX/Physics + the 4th aquarelle kind), script library + Apply refusal class, Studio window lifecycle (module switch must not re-open/re-mount Studio — Studio mirrors main-window bounds and stays one window).

---

### (b) Watercolor engine (paint-aquarelle) with property-rich brush set

#### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Wet-in-wet blooms that survive into baked frames | The look the user is buying the engine for | HIGH | Locked: forcing Dry at frame boundaries is **prohibited** (P4). Global wet field, not per-stroke local diffusion |
| Hard wet-on-dry edges | Second half of the watercolour look | HIGH | Pigment never seeps onto dry paper (conservation law) |
| Dark tide lines at drying wash edges | Signature watercolour artefact | HIGH | Capillary flux down the wetness gradient, gated by mobility both sides [ORACLE] |
| Subtractive pigment mixing (yellow + blue = green) | [ORACLE] headline demo; [GENERAL] table stakes for any watercolour claim | HIGH | Via `efx-spectral` absorbance model — see (c) |
| Granulation tied to paper tooth | [ORACLE] + [GENERAL] (Rebelle lists granulation as a headline feature) | MEDIUM | Deposit role of the four-role law — bakes into the mark, does not make WebP paper-dependent |
| Water control + pigment load + flow | Every wet-media tool has these [GENERAL] | LOW (surface) / HIGH (sim) | Oracle global params: `size, water, load, flow, bleed, dry, edge, granulation` (`Params` in `engine/Engine.ts`) |
| Bleed / diffusion control | [ORACLE] exposes `bleed`; [GENERAL] diffusion is the wet-media essence | HIGH | Wet-gated diffusion pass |
| Dry speed + explicit Dry/fix action | Glazing workflow requires it [ORACLE README: "Press Dry (D) when you want to glaze"] | MEDIUM | `fix` pass: mobile `ink` settles into `fixed`; in scripts dry is `dt`-driven, not a button |
| Edge (tide-line darkening) control | [ORACLE] `edge` param | MEDIUM | User-facing slider in oracle Settings panel |
| Four tools `brush \| water \| pen \| lift` | Locked scope (Q8=A) | MEDIUM | Water = clear water wets/moves paint; pen = ink line that feathers wet; lift = blot |
| Property-rich brush set: 14 tips + custom | Locked: "full set with properties" — this is what makes engine 2 a *craft* engine vs engine 1's one brush type | MEDIUM | [ORACLE] preset ids: round, detail, rigger, flat, hake, filbert, mop, dry, fan, sponge, spatter, sumi, dagger, stipple (+ custom PNG/JPG tip import) |
| Per-brush property surface | [ORACLE] `BrushPreset`: tip, aspect, rotation (follow/fixed/random), angle + angleJitter, size[pressure 0..1], pressureSize, speedThin, spacing, scatter, dabs, sizeJitter, water/load/flow multipliers, capacity (runs dry), grain (tooth gate), wetRound | MEDIUM | This is the "property-rich" payload the panels must drain; brush referenced by stable id + per-stroke `toolOverrides` (R1.7) |
| Dry-brush skip on the tooth | [ORACLE] `grain`/dry brush presets; [GENERAL] | MEDIUM | Deposit role; bakes into mark |
| Script record → physics play → WebP bake → cache | THE acceptance axis (R3) — Studio law unchanged | HIGH | Same bake pipeline as Physic Paint; per-stroke `diffusionFrames` (cap 600, Q1=C) |
| Deterministic replay (same script ⇒ same pixels) | Cacheable bake requires it | HIGH | Fixed tick grid ~1/60 s, integer ticks (Q2=B); FNV-1a traceSeed per stroke; no `Math.random()` in deposit/sim path |
| Bake survives user leaving the frame | Long fluid cuisson > one diffusion window | MEDIUM | Port `finalizationQueue` pattern (bounded Effect queue, generation-stale, `beginFlush`); existing PlayScript renderer aborts on dispose — not acceptable (R3.3) |
| Transparent where unpainted | Compositor law: tracks transparent between each other | LOW | A5 acceptance row |
| Durable script library (load/save/thumbnail, Apply, Loop Clip) | Same lifecycle class as Roto scripts (R3.5) | LOW | Reuse host envelope |

**Expected user-visible behaviour (aquarelle):**
- Painting wet-into-wet mixes and blooms in real time on the Studio canvas; wet-on-dry strokes keep hard edges; washes dry with tide lines.
- Global sliders (water / pigment / flow / bleed / edges / grain / dry speed) + per-brush multipliers behave like the oracle's Settings + Brush Library: preset choice changes handling (mop floods, dry brush skips tooth, spatter scatters), sliders change the current stroke's physics.
- Apply of an aquarelle script creates a Loop Clip whose baked WebP frames show blooms and tide lines — the wet look is in the frames, not a live sim.
- Scrubbing/repeats/export read the WebP cache only (unchanged). Export with transparent background shows paint only.
- Record → save → load → play reproduces marks (A1–A5 rows).

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animateable watercolour (scripted blooms over time) | [ORACLE] cannot do this — it has no stroke recording (raster undo tiles, `.wcp` raster layers). EFX adds the missing half via Studio law | HIGH | This IS the differentiator vs the oracle and vs painting-in-an-NLE workflows |
| StrokeWriter-equivalent scripted driving proven as first-class | Text/shapes get genuine wet marks in the oracle via `StrokeWriter`; our PlayScript player is the analogue | MEDIUM | Bridge concept only (clean-room) |
| Custom tip import (PNG/JPG → brush) | [ORACLE] feature; artists expect it [GENERAL] | LOW–MEDIUM | Packed like other tips in the brush-pack snapshot |
| Wet-region-only simulation + stop-when-dry | [ORACLE] perf law; keeps Studio responsive at HD | MEDIUM | wet-mask readback; idle dry sheet costs no GPU |
| White gouache as a pigment channel (opaque cover / bleach) | [ORACLE]; gouache-ish highlights on watercolour | LOW | 8th absorbance channel |
| Brush-pack snapshot in `.mce` | Old scripts replay after pack evolution | LOW | Locked; deliberate exception |

#### Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Forced Dry at every frame boundary to "simplify" the bake | Bakes look stable per frame | **Kills the look** (bloom must evolve across frames) — prohibited P4 | Per-stroke `diffusionFrames` owns the cuisson window |
| Live GPU fluid sim on the timeline | "Real-time playback" | Scrub/repeats/export must read cache (P3); nondeterministic and heavy | Bake once, play the cache |
| Text / Shape / Fill / Hand tools (v2.0.0) | [ORACLE] has all four | Locked out: Text/Shape carry OFL fonts + vpype-js, Hand carries MediaPipe; only `brush\|water\|pen\|lift` animate through scripts | Fill is the one plausible later add (distance-ramp front = own tranche) |
| Transliterate oracle/inkwash shaders or TS | Fast | Both unlicensed (P1) | Clean-room reimplementation of published method |
| Parallel standalone `WatercolorScript` library | Isolation instinct | Breaks Studio law | Shared envelope + per-engine payload |
| Per-stroke paper authority / baked-in paper | Paper "belongs to the mark" | Breaks no-rebake compositor law | Paper = `paperPass` fond (see (d)) |
| Engine-1 physics tweaks folded into 56 | Opportunism | Blast-radius creep; engine 1 unchanged until v2.1.0 spectral adoption | Keep 56 to engine 2 + paper pack |

#### Complexity & dependencies (aquarelle)

- **Hard prerequisites:** Phase 54 (Preact 11, live UAT gate) → Phase 55 (`efx-paint-host` split, format-identical, replay-parity guard) → 56. Spectral package must exist before pigment path works — 57 content may be created early inside 56 (locked fallback), never duplicated inside the engine.
- **Texture/runtime cost:** velocity RG16F + wet R16F + `ink` 2×RGBA16F + `fixed` 2×RGBA16F + paper RGBA8 at doc size; oracle caps sheet ~2048×1536 / MAX_DOC_PIXELS — our HD runtime (52.1, 512 MB LRU) must budget this; fluid bake duration can exceed Physic Paint's max `diffusionFrames`.
- **Existing machinery to ride (do not rebuild):** `renderRotoPlayScriptFrames` bake cadence, `finalizationQueue` (Effect v4 bounded queue), `traceSeed` determinism philosophy, `.mce` package IO through Rust (`project_package_fs_scope`), tick/`diffusionFrames` contract, script library lifecycle, compositor `getFlattenedFrame`.
- **Open at plan time (from specs):** sim step-count/dt quantisation exact value; layer-kind naming (Water/Aquarelle/Wash — UI-SPEC); `types.ts` split shape (paint-host Q1/Q2).

---

### (c) Shared spectral pigment mixing (`efx-spectral`, MIT)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Subtractive mixing visible in marks: yellow + blue = green (wet AND dry) | The mixing is the point of engine 2 | HIGH | Absorbance adds linearly with concentration → Beer–Lambert glazes [ORACLE] |
| One shared package consumed by engines — not a private watercolour utility | Locked: "never duplicate mixing code inside the watercolor engine" | LOW | `packages/efx-spectral` + MIT `NOTICE` attributed |
| Correct display of mixes in baked WebP (not just live canvas) | Cache is the playback path | MEDIUM | Display rebuild must match bake: 16-band quadrature + `exp(−A)` → sRGB (ΔE_OK ≈ 0.1–0.2 vs 38-band) [ORACLE] |
| Licence hygiene | Mixbox banned project-wide (CC BY-NC) | LOW | spectral.js = MIT, attribute; method + reflectance data usable |

**Expected user-visible behaviour:** colours mix like paint (rose + ultramarine → violet, sienna + ultramarine → soft grey); glazes stay translucent; white gouache covers opaquely; exported frames match the canvas.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Engine-1 adoption in v2.1.0 (replaces RYB `mixSubtractive` heuristic) | One colour model across modules | MEDIUM | Explicitly OUT of v2.0.0; Q5-gated; may supersede kmerp path of `SPECS/real-paint/03-pigment-mixing.md` (decide at v2.0.0 close — do not decide now) |
| 7-coeff absorbance basis advected in fluid textures | Enables mixing to happen *inside* the sim (add/advect/diffuse coeffs), not as a post-blend | HIGH | This is why the oracle's approach ≠ stock spectral.js API |

#### Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Vendoring the npm `spectral.js` v3 API as-is for the sim path | It's the MIT library | v3 is CPU K/S mixing (`Color`/`mix`); the sim needs the 7-coeff absorbance basis the oracle built from the same method/data | `efx-spectral` = MIT data + CPU helpers + **GLSL basis export** (locked shape); do not adopt v3 K/S API blindly for GPU transport |
| Hiding spectral inside `efx-watercolor` | Fewer packages | Makes engine 1 depend on engine 2 later | Standalone tiny shared package (locked; rejected alternatives documented) |
| Hiding it inside `efx-paint-host` | "Shared = host" | Host is the Studio law, not a colour toolbox | As above |
| Mixbox (any form) | Better gamut | CC BY-NC — banned project-wide | spectral.js method |
| Per-stroke RGB averaging "mixing" | Simpler | Not subtractive; fails the look | Absorbance transport |

#### Complexity & dependencies (spectral)

- **Consumers:** `efx-watercolor` (mandatory now) · `efx-physic-paint` (v2.1.0, Q5-gated) · `efx-krita` does **not** use it (libmypaint mixes internally; smudge ≠ mixing).
- **Cost:** LOW to create the package (data + helpers + GLSL export); the expensive part is the fluid-side integration (2×RGBA16F layout: coeffs 0–3 in A, 4–6 in B.rgb, gouache in B.a).
- **Ordering:** tranche 0c in the spec's split; if 56 needs it first, create early inside 56 or pull 57 forward (locked fallback).

---

### (d) 10-procedural-paper pack (ALL paints)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 10 named procedural papers: cold press, hot press, rough, khadi, washi, laid, canvas, toned sand, kraft, student/cellulose | Deliverable named in R2.4 and the milestone; the oracle's set [ORACLE] | MEDIUM | Clean-room procedural height/mottle/fleck fields → `PaperPassTile` shapes — no copied shaders |
| Usable by ALL paints (normal, physic, aquarelle, later krita) through the same `paperPass` | Locked: "for ALL paints" | LOW–MEDIUM | `encodePassTiles(height, tint, …)` already exists (`app/src/lib/paperPass.ts`) |
| Paper is composite-only: no rebake on paper change | Locked Q5 + P-level law | LOW | Paint WebPs stay transparent; paper = valley(multiply)+peak(lighten) tiles at the composite seam |
| Paper display state (id, strength, scale) on the document/fond, in undo + save | R2.5 — never per-stroke/per-script authority | MEDIUM | Reuse PKG display-token care: paper display state must rotate the change token (learn from PKG-06/BKG-09 display-setter gap) |
| Engine-side tooth (granulation settle, dry-brush skip) bakes into the mark (deposit role) | Four-role law (P6) | MEDIUM | Mark is paper-agnostic on the recompose axis even though tooth influenced deposit |

**Expected user-visible behaviour:** pick a paper in the Studio paper library → the fond swaps tiles instantly (no rebake, no cache invalidation) → all paints sit on it; aquarelle granulation and dry-brush breakup change with the chosen tooth; changing paper after painting recomposes the stack without touching paint frames.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Paper influences paint *behaviour* (granulation, dry-brush skip), not just appearance | [ORACLE] and Rebelle both key on this; it is what makes paper a craft control | MEDIUM | Deposit role vs display role kept distinct |
| Lit relief + mottle + fleck fields (per-preset bump/tint/fleck/mottle) | Visually credible surfaces | MEDIUM | [ORACLE] `PaperPreset`: kind (height-field id), tint, fleck, bump, mottle |
| One pack, every module | Multi-module value at zero extra per-module cost | LOW | Rides Phase 56 |

#### Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Baking paper into paint WebP frames | "Looks done" | Forces rebake on paper change; breaks recomposable stack | Composite-only `paperPass` fond (locked) |
| Animatable per-frame paper | "Paper motion effects" | Rejected in Q5; explodes cache semantics | Static document paper; FX layer for motion needs |
| Rebelle-style 180-surface library / user-uploaded paper scans now | Parity anxiety | Scope explosion; 10 procedural presets are the deliverable | Later: import-as-height-map as its own tranche |
| Copied paper shaders from the oracle | Fast | Unlicensed (P1) | Clean-room procedural fields |
| Paper state per stroke or per script authority | Script portability | R2.5: display hint at most on a script | Document/fond owns paper |

#### Complexity & dependencies (paper pack)

- **Rides Phase 56** (locked), but is engine-agnostic — it must land as Studio library content + `PaperPassTile` generation, not as watercolour-private code.
- **Depends on:** existing `paperPass` contract and the four-role texture law (`SPECS/real-paint/00-overview.md`); document/fond authority (`physicPaintStore._resolveDocumentFondInstruction` / D-11 single fond authority).
- **Watch:** display-class save token (PKG-06 lesson) and the deferred cache-footprint issue — 10 full-height tile pairs add memory; the paper pack should generate tiles at working resolution on demand, not cache 10 × HD pairs forever.

---

## Feature Dependencies

```
Phase 54 Preact 11 (hard gate, live UAT closes before 55)
    └──requires──> Phase 55 efx-paint-host (Studio law split, generic payload, replay parity)
                       ├──requires──> Phase 56 efx-watercolor engine core (fluid + brushes + determinism)
                       │                   ├──consumes──> efx-spectral (Phase 57, or created early inside 56)
                       │                   ├──consumes──> Studio bake pipeline (exists) + finalizationQueue pattern (exists)
                       │                   └──rides────> Paper pack (10 procedural papers → paperPass, ALL paints)
                       └──supports───> Module switcher (shell + per-module drain contract)
                                           ├──drains──> Brush module surface (engine-1 brushes, exists)
                                           ├──drains──> Water color surface (aquarelle pack + params, from 56)
                                           └──slot────> Krita module (v2.1.0, NOT implemented)

Script record ──requires──> tick grid + diffusionFrames (host) + traceSeed
Script Apply  ──conflicts─> cross-engine target (fail-closed refusal)
Paper change  ──conflicts─> rebake (never; composite-only)
Watercolour look ──conflicts──> forced Dry at frame boundaries (prohibited)
efx-spectral  ──conflicts─> Mixbox (licence ban); per-stroke RGB averaging
```

### Dependency Notes

- **55 before 56 is hard:** aquarelle must consume the host, not re-grow script/tick/bake machinery. Pay the split once (it is also Krita's prerequisite).
- **Spectral before pigment path:** mixing is not optional polish; if 56 hits pigment work before 57 exists, create `packages/efx-spectral` early (locked fallback). Never fork the mixing code into the engine.
- **Paper pack depends only on `paperPass`** — it can land early or late inside 56 but must be Studio-library-shaped from the first commit (all paints), not watercolour-private.
- **Module switcher depends on 55's generic payload seam** and on at least one module surface existing; it is the integration face, so it belongs late (after engine core + at least Brush surface is defined), and its layout is discuss-phase.
- **Conflicts to keep out of the same work item:** engine-1 colour upgrade (v2.1.0), libmypaint/krita, Fill/Text/Shape/Hand tools, paper animation, any migration code.

---

## MVP Definition (maps to the locked v2.0.0 scope)

### Launch With (v2.0.0)

- [ ] Phase 54 Preact 11 + live reactivity UAT — hard sequencing gate
- [ ] Phase 55 `efx-paint-host` split, format-identical, engine-1 replay parity (A5: fake engine-2 payload round-trips)
- [ ] `efx-spectral` package (MIT data + helpers + GLSL basis, attributed) — may land as 57 or early-in-56
- [ ] Aquarelle engine core: fluid grid, wet-gated transport + tide line, fix/dry, granulation, determinism (tick grid + traceSeed)
- [ ] Property-rich brush set: 14 tips + custom import; `BrushPreset` property surface + stable id + `toolOverrides`
- [ ] Option surface: `size, water, load, flow, bleed, dry, edge, granulation` + per-brush multipliers (the oracle's Params set is the checklist)
- [ ] Tools `brush | water | pen | lift` only
- [ ] Studio script law for aquarelle: record → play physics (no forced Dry) → WebP bake (per-stroke `diffusionFrames` ≤ 600) → cache; bake host survives leaving the frame
- [ ] Acceptance rows A1–A5 (replay parity, identical bakes, visible bloom/tide line in baked frames, independent cache ranges, transparent export)
- [ ] Paper pack: 10 procedural papers in the Studio paper library, composite-only, all paints, document-owned paper state
- [ ] Module switcher: top-bar icon, 3 slots (Krita inert), per-module option drain over the one Studio engine, fail-closed cross-engine Apply

### Add After Validation (v2.0.x / v2.1.0)

- [ ] Krita module (libmypaint WASM + .myb pack) — the v2.1.0 slot; planned only after v2.0.0 closes
- [ ] Engine-1 adopts `efx-spectral` (replaces RYB heuristic) — v2.1.0, Q5-gated at v2.0.0 close
- [ ] Fill tool (bucket wash) — the one plausible aquarelle annex; its own tranche
- [ ] kmerp vs spectral sufficiency call for engine 1 — decide at v2.0.0 close, not now

### Future Consideration (v2.2+)

- [ ] Text (single-line OFL fonts) / Shape (SVG, vpype-js) / Hand (MediaPipe) annex tools — not motion-script material
- [ ] User-imported paper scans as height maps — needs its own generation/validation story
- [ ] 2K resolution, AI features — out of v2.0.0 scope by lock
- [ ] Waveform in Paint timeline (existing FUT backlog — never fold into a phase)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Aquarelle wet look surviving bake (bloom + tide line + hard edges) | HIGH | HIGH | P1 |
| Studio script record/play/bake for aquarelle (A1–A5) | HIGH | HIGH | P1 |
| efx-spectral subtractive mixing | HIGH | MEDIUM | P1 |
| Property-rich brush set (14 tips + custom + props) | HIGH | MEDIUM | P1 |
| Option surface (water/load/flow/bleed/dry/edge/granulation) | HIGH | LOW (surface) | P1 |
| Paper pack (10, all paints, composite-only) | HIGH | MEDIUM | P1 |
| Module switcher shell + Krita slot + option drain | HIGH | MEDIUM | P1 |
| Bake host survives navigation (finalizationQueue port) | HIGH | MEDIUM | P1 |
| Brush-pack snapshot in `.mce` | MEDIUM | LOW | P1 |
| Custom tip import | MEDIUM | LOW | P2 |
| White gouache channel | MEDIUM | LOW | P2 |
| Krita module | HIGH (later) | HIGH | P2 (v2.1.0) |
| Engine-1 spectral adoption | MEDIUM | MEDIUM | P2 (v2.1.0) |
| Fill tool | MEDIUM | MEDIUM | P3 |
| Text/Shape/Hand annex tools | LOW | HIGH | P3 |
| Imported paper scans | LOW | MEDIUM | P3 |

---

## Competitor / Reference Feature Analysis

| Feature | watercolor-playground [ORACLE] | Rebelle 8 [GENERAL] | Krita / CSP / Procreate [GENERAL] | Our Approach |
|---------|-------------------------------|---------------------|-----------------------------------|--------------|
| Wet-in-wet bloom + tide line | Yes (global wet field, inkwash-derived) | Yes (headline; drips, Blow, tilt) | Krita watercolor-ish engines approximate; CSP/Procreate are stylized | Clean-room global wet field; bloom survives bake (scripted — they don't animate) |
| Subtractive mixing | Yes (7-coeff absorbance from spectral.js method) | Yes (pigment engine) | Approximate (Krita mix; Procreate smudge ≠ mixing) | `efx-spectral` shared package |
| Brush property surface | 14 tips + rich `BrushPreset` props + custom PNG | 260+ presets, Brush Creator, stabilizer | Krita per-engine option stacks; CSP sub-tools; Procreate brush studio | 14 tips + custom; properties drained by the module switcher |
| Paper | 10 procedural presets (tint/fleck/bump/mottle), size presets | 180+ surfaces, paper library, grain interacts with media | Paper is usually texture overlay only | 10 procedural papers, but paper = composite fond + deposit-role tooth (two roles kept distinct) |
| Animation / script replay | **No** (raster undo, `.wcp` raster; only `StrokeWriter` for scripted text/shapes) | No (paint app) | No | **Our differentiator:** Studio script law → WebP bake → timeline |
| Engine/module switcher | Single engine | Media switcher (watercolor/oils/inks…) | Krita brush engines per tool; CSP sub-tools; never document-level | Top-bar module switcher over one Studio engine |
| Licence posture | **No LICENSE** (method-only for us) | Commercial | Mixed | Clean-room + MIT spectral only |

---

## Sources

- `SPECS/v1.1.0-water-color/00-grill-context.md` + `01-gsd-context.md` (Phase 56 locked context — bake model, licence boundary, tranche split)
- `SPECS/v1.1.0-paint-host/context.md` (Phase 55 host split contract)
- Local oracle tree `SPECS/v1.1.0-water-color/watercolor-playground/` — `README.md`, `src/engine/brushes.ts` (`BrushPreset` + 14 `BRUSH_PRESETS`), `src/engine/papers.ts` (10 `PAPERS`), `src/engine/Engine.ts` (`Params` = size/water/load/flow/bleed/dry/edge/granulation; tools brush/water/pen/lift), `src/app/registry.ts` (tool registry), `src/draw/StrokeWriter.ts` (scripted sample feeding), `src/components/SettingsPanel.tsx` (user-facing slider set) — read 2026-10-14
- [Rebelle product page](https://www.escapemotions.com/products/rebelle) (fetched 2026-10-14 — MEDIUM confidence, marketing-level detail)
- [rvanwijnen/spectral.js](https://github.com/rvanwijnen/spectral.js) (fetched 2026-10-14 — MIT, v3 K/S API; HIGH confidence)
- `app/src/lib/paperPass.ts` (`PaperPassTile` / `encodePassTiles` valley+peak contract)
- `.planning/PROJECT.md` v2.0.0 milestone lock (semver law, clean break, UI/UX stance 2026-10-14)

---
*Feature research for: v2.0.0 multi-module paint workstation — module switcher, efx-watercolor, efx-spectral, paper pack*
*Researched: 2026-10-14*
