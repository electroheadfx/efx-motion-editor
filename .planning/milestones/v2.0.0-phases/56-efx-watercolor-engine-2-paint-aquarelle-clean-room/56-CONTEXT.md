# Phase 56: efx-watercolor (engine 2, paint-aquarelle, clean-room) - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the animatable watercolour engine (`packages/efx-watercolor`) under the shared Studio script law, a paper pack usable by ALL paints through the same `paperPass`, and the top-bar module switcher over the one shared Studio. This is the first real consumer of the Phase 55 host seam (`StudioStroke<P>` / `EngineAdapter<P>`).

Scope anchor: engine core (fluid grid + spectral pigment + brush set, clean-room) → Studio script record/play under the host law → WebP bake + cache (`diffusionFrames` ≤ 600, survives leaving the frame) → paper pack into the Studio library (10 procedural + 3 recovered real) → module switcher + panels → `.mce` field contract for every new field → live UAT A1–A5 closes the phase.

Requirements in scope: AQUA-01..AQUA-08, PAPER-01..PAPER-04, MOD-01..MOD-06, DATA-04 (19 requirements).

Dependency hook: this phase CONSUMES `efx-spectral`. If plan-time shows spectral is needed first, create `packages/efx-spectral` early inside 56 (or pull 57's content forward); never duplicate the mixing code inside the watercolor engine.

</domain>

<decisions>
## Implementation Decisions

### Module switcher surface (MOD-01 / MOD-02 / MOD-06)
- **D-01:** The module switcher is a **segmented 3-slot control in the top bar** with **text labels** "Brush | Water color | Krita". Always visible, one click to switch. Not a dropdown, not an icon cycle. — **Reversibility:** costly — the switcher is the product-shape surface of v2.0.0; moving to a different control family after users learn it is a UX break, and the segmented-control state model is what panels drain against.
- **D-02:** Switching module **drains the selected module's OWN options/features into the panels; the document and timeline stay put** (MOD-02). No layer-kind switch, no confirm dialog. The user keeps working on the same frame. — **Reversibility:** costly — panels-drain model is what the shared/module param split (D-05) is built on; adding a layer-kind coupling later would need the panel ownership re-cut.
- **D-03:** The inert **Krita slot is greyed out with a "coming in v2.1.0" tooltip**. Visible roadmap promise, zero interaction cost (MOD-01/06). Clicking does nothing.

### Aquarelle options panel (AQUA-03 / AQUA-04)
- **D-04:** **Globals first, then a collapsible "Brush response" section below.** The 8 global params are the primary sliders; per-brush multipliers live under the collapsible. Matches how Physic Paint already stacks global-then-per-brush.
- **D-05:** **Shared-vs-module param split on the right sidebar** (single home; scope = active module):
  - **SHARED, always visible regardless of active module:** Color (engine-specific mixing underneath — spectral for watercolour), Size, Opacity, Paper (id + strength + scale — state lives on the fond per PAPER-03, controls are global because `paperPass` serves ALL paints per PAPER-02).
  - **MODULE-ONLY, shown only while that module is active (MOD-02):** Water color → `water, load, flow, bleed, dry, edge, granulation` + tool selector (`brush|water|pen|lift`) + tip picker + per-brush multipliers. Brush (Physic) → its own physics param bag. Basic / FX → their own.
  - **Never show watercolour params inside the Brush module panel, and vice versa.**
  - **AQUA-04's `size` maps to the shared Size slider — no duplicate size control.** — **Reversibility:** one-way — the shared/module split becomes the panel ownership contract every module's UI is built against; re-cutting it later means re-laying out every module's sidebar.
- **D-06:** Params use **sliders with a numeric readout** (the existing `SliderStepper` / `NumericStepper` family). Continuous sliders for `water/load/flow/bleed/dry/edge/granulation`; stepper only where integers matter.
- **D-07:** The tip picker is a **Krita-style Brushes docker panel — NOT a popover, NOT a horizontal strip** (reference: Krita "Brushes" docker layout). Structure top to bottom:
  - Toolbar: add / import (custom PNG/JPG tips) / view-mode toggles
  - Category filter ("All categories" dropdown) + search field
  - **VERTICAL scrolling list grouped by collapsible CATEGORY**, each group with a brush count (e.g. "Round — 4")
  - One row per tip: thumbnail (vignette) + name + favorite star
  - Footer: selected brush preview + total brush count

  **Categories are part of the data model, not just display:** the 14 base tips ship grouped (round / flat / texture / experimental), and custom imported tips land in a user category. This scales to Krita later (v2.1.0) where brushes are category-organized — same panel, no rework. Selecting a tip loads its per-brush multipliers into the Brush response surface below. Custom import lives in the toolbar (+ / folder), not as a tile at the end of the list. — **Reversibility:** one-way — categories-in-the-data-model is persisted in the brush-pack snapshot that travels in `.mce` (MOD-04); changing the category model later needs a clean break.
- **D-08:** Per-brush multipliers present as **8 ×multiplier sliders (0.5–2.0 range)** in the collapsible Brush response section, each showing the **computed effective value** next to it (global × multiplier).

### Paper library picker (PAPER-01 / PAPER-03 / PAPER-04)
- **D-09:** The paper picker is a **thumbnail grid popover** in the shared panel (always visible, since paper serves ALL paints). One click to open, 13 cells.
- **D-10:** **Strength + scale sliders sit in the shared panel directly under the paper picker.** State still lives on the fond (PAPER-03) — this is only where the controls are. One place, always reachable.
- **D-11:** Picker cells show the **raw paper tile** (height-map lit relief for procedural papers, the jpg for real scans). Fast, deterministic, no engine involvement in the picker.
- **D-12:** **One library, grouped** under Procedural / Real headers — the 3 recovered real papers (`paper_1/2/3.jpg`) sit in the same grid as the 10 procedural ones. Not separate tabs, not a visually distinct section.

### Aquarelle tool surface (AQUA-02)
- **D-13:** The four tools (`brush | water | pen | lift`) enter as a **module-scoped tool row** in the aquarelle module section of the right sidebar, above the sliders. Never visible in Brush/Basic/FX (matches the D-05 shared/module split).
- **D-14:** **The module switcher owns engine choice; the existing PaintModeSelector (Normal/Physics) stays inside the Brush module only.** Aquarelle never shows it — its physics is always on.
- **D-15:** **Dry exists AND is recorded in the script (AQUA-06 determinism):**
  - Dry is a **user action** (flash-dry the sheet), **NOT a 5th paint tool** — AQUA-02's `brush|water|pen|lift` stay the only tools with pts/brush payload.
  - Dry **IS recorded in the script as a timeline event (dry at tick T)**, same stroke ordering / tick grid, because it changes the wet state of the sheet. Without it, replay cannot reproduce the cooked look.
  - Replay fires the dry event in order between strokes → same pixels.
  - This does **NOT** conflict with "Forced Dry at frame boundaries is prohibited": that lock is about the pipeline auto-drying at boundaries. User-initiated Dry is an explicit, recorded gesture.
  - UX shape: **Dry action button in the aquarelle module panel**, not a canvas tool. Wetting is the existing `water` param / `water` tool.
  - — **Reversibility:** one-way — the Dry event kind enters the persisted script payload; removing it after scripts are recorded needs a clean break.
- **D-16:** Dry travels in the script as a **distinguished payload event kind** (no pts, no brush, just tick + dry) — one payload union, one ordering law, one codec. Keeps HOST-02's genericity clean. Not a separate events array (two ordering surfaces), not a flag on the next stroke (breaks if Dry is the last gesture before Apply). — **Reversibility:** one-way — once the codec emits this event kind, removing it needs a clean break.

### Locked by requirement / prior spec (not re-litigated)
- **D-17:** **Clean-room P1 stands** — no code copied or transliterated from `SPECS/v1.1.0-water-color/watercolor-playground/` (msurguy/watercolor-playground) or `johnowhitaker/inkwash` (both unlicensed). Published method only. The oracle licence P1 decision is a plan-time item (recorded in PROJECT.md Key Decisions).
- **D-18:** Four tools only: `brush | water | pen | lift` (AQUA-02). Text/Shape/Fill/Hand are out of scope. Fill is the one plausible later add.
- **D-19:** Per-stroke `diffusionFrames` (cap 600, script-owned), fixed tick grid ~1/60 s, integer ticks (AQUA-05 / DATA-03). Host owns the mechanism; the engine owns its cap policy (55 D-20).
- **D-20:** Determinism = same script ⇒ same pixels, FNV-1a `traceSeed` per stroke, no `Math.random()` in deposit/sim path (AQUA-06).
- **D-21:** Paper is composite-only via `paperPass` — no rebake on paper change (PAPER-02 / Q5). Engine-side paper influence (granulation settle, dry-brush skip) is the deposit role and bakes into transparent pixels; it is NOT the display fond.
- **D-22:** Paper display state (id, strength, scale) lives on the document/fond in undo + save, with display-class change-token rotation (PAPER-03 — learn from PKG-06/BKG-09).
- **D-23:** Brush-pack snapshot travels in `.mce` (MOD-04) — deliberate exception to the 52.2 refs-only law (55 D-22). Do not "fix" it into a reference.
- **D-24:** ONE shared Studio engine (script, cache, timeline) for all modules (MOD-03) — never forked per module. Host APIs generic over the per-engine stroke payload (HOST-02 / 55 D-19).
- **D-25:** Fail-closed cross-engine Apply (MOD-05 / 53.1 law) — unreadable/cross-engine scripts refuse with a named visible error through the existing owned-refusal surface (55 D-09..D-12). Never half-apply, never silent drop.
- **D-26:** v2.0.0 ships Brush + Water color only (MOD-06). Krita is the v2.1.0 slot — no krita implementation.
- **D-27:** Every new `.mce` field declared in BOTH TS and Rust (DATA-04 / `mceFieldContract` law).
- **D-28:** Forced Dry at frame boundaries is prohibited (P4); live GPU fluid sim on the timeline is prohibited (P3 — cache is the only playback path). No Mixbox (P2). No legacy migration (P5). No fifth texture-modulation role (P6).
- **D-29:** `efx-watercolor` CONSUMES `efx-spectral` — never duplicate the mixing code inside the engine. If plan-time shows spectral is needed first, create `packages/efx-spectral` early inside 56 (or pull 57's content forward).

### Claude's Discretion
- Exact file layout inside `packages/efx-watercolor` (engine / shaders / brushes / papers), as long as the engine is Preact-free and implements `EngineAdapter<P>`.
- The exact category taxonomy names for the 14 base tips (round / flat / texture / experimental are the intended groupings — final names are executor discretion as long as categories exist in the data model).
- Param default values and slider ranges for the 8 globals and the ×multiplier range (0.5–2.0 is the decided band; exact defaults are executor discretion).
- Commit sequencing of engine-core / script / bake / paper / switcher tranches.

### Reviewed Todos (not folded)
- `261003-d08-tier-parity-harness-rescope.md` — "Retire or re-scope the D-08 tier-parity harness row to the one-pipeline contract". Matched on generic keywords only (score 0.4, area `general`). It is about the physics-paint tier-parity harness (`computeTierParityMetrics` family), not watercolour. Left out of Phase 56 scope (also reviewed and left out in 54 and 55).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec and requirements
- `SPECS/v1.1.0-water-color/01-gsd-context.md` — phase-importable spec: R1–R4 requirements, A1–A5 UAT rows, prohibitions P1–P7, ambiguity report (Q1–Q6/Q8 resolved; Q7 layer-kind name = UI-SPEC). The requirement text lives here — do not paraphrase it away.
- `SPECS/v1.1.0-water-color/00-grill-context.md` — shared understanding, bake model locked, algorithm map, licence table, bake-host facts verified against the live tree.
- `.planning/REQUIREMENTS.md` §Watercolor Engine / §Paper Pack / §Module Switcher / §Data Honesty — AQUA-01..08, PAPER-01..04, MOD-01..06, DATA-04 as locked milestone requirements
- `.planning/ROADMAP.md` §Phase 56 — goal + five success criteria; dependency hook wording for `efx-spectral`

### Oracle / reference (read-only — clean-room P1 applies)
- `SPECS/v1.1.0-water-color/watercolor-playground/` — primary oracle (read-only copy). Read `README.md`, `src/engine/` (Engine, shaders, spectral, spectralData, papers, brushes), `src/draw/StrokeWriter.ts`, `src/project/format.ts` first. **No code copied or transliterated (D-17 / P1).** Provenance URL is `https://github.com/msurguy/watercolor-playground` — **no licence**.
- `https://github.com/johnowhitaker/inkwash` — fluid origin, **no licence** (P1 covers it too)
- `https://github.com/rvanwijnen/spectral.js` — spectral colour, **MIT** (Q6 = vendor MIT + attribution)

### Upstream contracts (locked earlier, not re-litigated)
- `SPECS/real-paint/00-overview.md` — four-role texture law (deposit / drying / paper tooth / granulation) — P6 closes the role set
- `SPECS/real-paint/07-paint-script.md` — `PaintScript` contract to extend
- `SPECS/v1.1.0-water-color/01-gsd-context.md` §3 R1.7 — brush set is a project asset: stable id + numeric `toolOverrides`, pack snapshot travels in `.mce` (Q8 = C)

### Host seam (Phase 55 — the consumer surface)
- `packages/efx-paint-host/src/index.ts` — `StudioStroke<P>` / `StudioScriptEnvelope<P>` / `EngineAdapter<P>`; host never inspects `P` (55 D-19)
- `.planning/research/ARCHITECTURE.md` §2 (a) — the efx-paint-host seam map (module move table, generic shapes, dependency direction)
- `.planning/phases/55-efx-paint-host-engine-1-host-split/55-CONTEXT.md` — D-09..D-12 fail-closed Apply / owned-refusal surface; D-20 `diffusionFrames` mechanism vs cap policy; D-22 brush-pack snapshot exception

### Bake / determinism
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — bake host today (aborts on `dispose()` — NOT acceptable for long fluid cuisson)
- `app/src/components/physic-paint/pilot/finalizationQueue.ts` — the bake-host pattern to port (bounded Effect queue, generation-stale commits, `beginFlush`) — 55 D-21
- `packages/efx-paint-host/src/util/traceSeed.ts` — `fnv1a` / `hashMutationId` / `seededRng` — the determinism law (55 D-25)
- `packages/efx-physic-paint/src/types.ts` — `PaintStroke.diffusionFrames`, `AnimationConfig` (engine-1 payload analogue)

### Paper / composite
- `app/src/lib/paperPass.ts` — the composite-only paper contract (conditioned height map → valley + peak tiles → `drawImage` + `globalCompositeOperation`)
- `app/public/img/paper_1.jpg` / `paper_2.jpg` / `paper_3.jpg` — the 3 real paper backgrounds to recover into the Studio paper library (PAPER-04); today wired as canvas1/2/3 inside physic-paint
- `physicPaintStore._resolveDocumentFondInstruction` — the document-fond authority paper state joins (PAPER-03)

### Refusal / data honesty
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` — `buildRotoScriptApplyRefusalMessage` + owned-refusal surface (extend with named cross-engine cases, 55 D-09..D-11)
- `.planning/PROJECT.md` §Key Decisions — v2.0.0 clean break, fail-closed, ONE shared Studio, generic host APIs, tick grid, brush-pack snapshot exception

### Reactivity / async law (mandatory)
- `.claude/skills/efx-preact-reactivity/SKILL.md` — project reactivity discipline (idempotent store setters, identity-stable effect deps, narrow signal reads, no render-body signal writes)
- `.claude/skills/efx-async-orchestration/SKILL.md` — Effect v4 bounded-turn queue conventions; the bake host ports this pattern
- `CLAUDE.md` §Preact — binding project instruction

### Law / constraints
- `project_package_fs_scope` law (memory) — all package/cache IO through Rust; static scans pin both
- Chunk budget: 2000 kB viteBuild desktop ceiling (memory) — shaders/spectral/papers may pressure it; the line-move is a plan-time item

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/efx-paint-host` — the generic seam Phase 56 consumes: `StudioStroke<P>` / `StudioScriptEnvelope<P>` / `EngineAdapter<P>`, animation schedules, `traceSeed`, ticks + `diffusionFrames` mechanism
- `app/src/lib/paperPass.ts` — existing composite-only paper contract the 13-paper library plugs into; changing paper swaps tiles only
- `app/src/components/physic-paint/pilot/finalizationQueue.ts` — Effect v4 bounded-queue pattern the bake host ports (not copy-paste; the pattern)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` — the owned-refusal surface to extend with named cross-engine cases
- `SliderStepper` / `NumericStepper` in `app/src/components/shared/` — the control family D-06 specifies for the params
- Existing vitest setup (`pnpm --filter efx-motion-editor exec vitest run`) — home of the `mceFieldContract` pin (DATA-04), the fake-engine-2 genericity pin, and new determinism pins. No new config.

### Established Patterns
- **Standing contract pins** — `paintVersion` discipline, `mceFieldContract`, `preactSingleCopy`, host genericity: a normal `.test.ts` that fails loudly when an invariant drifts. Every new law in this phase joins that family.
- **paintVersion bump + subscribe** — must survive every aquarelle store setter; `efx-preact-reactivity` is mandatory for all Preact code.
- **Owned-refusal pattern** — `scriptApplyRefusalOwnedRef` + `clearOwnedScriptApplyRefusal` keeps one error channel coherent; cross-engine refusals extend it (55 D-09), never a second channel.
- **Display-class change-token rotation** — PKG-06/BKG-09 known gap is the lesson: paper display state MUST rotate the change token or display-only edits revert on reopen (PAPER-03).
- **Workspace singletons via root `pnpm.overrides`** — `packages/efx-watercolor` (and `efx-spectral` if created here) join the pnpm workspace the same way.

### Integration Points
- Dependency direction: `app/ → efx-watercolor → efx-paint-host`; `app/ → efx-paint-host`; `app/ → efx-physic-paint → efx-paint-host`. `efx-watercolor` must NOT import `efx-physic-paint`.
- Module switcher lives in the top bar (`app/src/components/layout/Toolbar.tsx` neighbourhood); panels drain into the right sidebar (the shared/module split of D-05).
- `physicPaintStore._resolveDocumentFondInstruction` — paper display state joins the document-fond authority.
- `.mce` field contract: every new field (aquarelle brush properties, per-engine stroke payload in the envelope, paper state on the fond, brush-pack snapshot) declared in BOTH TS and Rust.
- Script library UI reads the durable scripts folder — cross-engine Apply refusals land there as named visible errors.

</code_context>

<specifics>
## Specific Ideas

- The tip picker is "Krita-style" — the user attached a Krita "Brushes" docker screenshot as the look target. Vertical category-grouped list, toolbar with add/import, category filter + search, footer with selected-brush preview and total count. Categories are a data-model concern so the same panel serves Krita (v2.1.0) without rework.
- "Never show watercolour params inside the Brush module panel, and vice versa. Right sidebar is the single home; scope = active module." — the shared/module split is a hard ownership boundary, not a convenience.
- "AQUA-04 'size' maps to the shared Size slider, no duplicate size control." — one Size slider for all paints.
- "Dry must exist AND be recorded in the script (AQUA-06 determinism)." — the user was explicit that an unrecorded Dry would make replay unable to reproduce the cooked look. Dry is a recorded timeline event, not a paint tool.
- The Dry decision "does NOT conflict with 'Forced Dry at frame boundaries is prohibited': that lock is about the pipeline auto-drying at boundaries. User-initiated Dry is an explicit, recorded gesture."

</specifics>

<deferred>
## Deferred Ideas

- **Text / Shape / Fill / Hand tools** — out of v2.0.0 scope (locked 2026-10-06). Fill is the one plausible later add (its distance-ramp front is its own tranche).
- **Krita module implementation** (libmypaint WASM + `.myb` pack) — v2.1.0 slot (KRT-01). The switcher ships the inert slot only.
- **Engine-1 spectral adoption** (KRT-02) — v2.1.0, Q5-gated at milestone close.
- **User-imported paper scans** (PAPR-05) — v2.2+. PAPER-04 covers only the 3 recovered real papers already in the repo.
- **Fill tool (bucket wash)** (TOOL-01) — own tranche, later release.
- **Export smoke + chunk-budget checks** — release gates. (Watch the 2000 kB vite ceiling if shaders/spectral/papers pressure it — that line-move is a plan-time item, not this phase's deliverable.)
- **4th paint layer-kind naming** (Water / Aquarelle / Wash) — UI-SPEC scope (spec Q7), not decided here.

### Reviewed Todos (not folded)
- `261003-d08-tier-parity-harness-rescope.md` — physics-paint tier-parity harness (`computeTierParityMetrics`), not watercolour. Left out (third consecutive phase review; leave closed).

</deferred>

---

*Phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room*
*Context gathered: 2026-10-15*
