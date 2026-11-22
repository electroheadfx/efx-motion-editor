# Roadmap: EFX-Motion Editor

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2026-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2026-03-21)
- ✅ **v0.3.0 Audio & Polish** — Phases 15-17 (shipped 2026-03-24)
- ✅ **v0.4.0 Canvas & Paint** — Phases 18-19 (shipped 2026-03-25)
- ✅ **v0.5.0 Motion Blur & Paint Styles** — Phases 20-21 (shipped 2026-03-26)
- ✅ **v0.6.0 Various Enhancements** — Phases 22-25 (shipped 2026-04-03)
- ✅ **v0.7.0 Monorepo & Paint Enhancements** — Phases 26-33 (shipped 2026-04-05)
- ✅ **v0.8.0 Standalone Physics Paint** — Phases 34-38.1 (shipped 2026-08-01)
- ✅ **v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity** — Phases 39-44 (shipped 2026-08-21)
- ✅ **v1.0.0 EFX Paint Multi-Track Frames and Reveal** — Phases 45-53 (shipped 2026-10-12)
- ✅ **v1.0.1 Debt Patch Release** — quicks + inserted Phase 53.1 (shipped 2026-10-13)
- ✅ **v2.0.0 Multi-Module Paint Workstation (MAJOR)** — Phases 54-56 (shipped 2026-11-02)
- ✅ **v2.0.1 Rail Editing & v7 Timeline Rails (PATCH)** — Phase 58 + in-milestone v7 quick (shipped 2026-11-05)
- ✅ **v2.1.0 Rail Motion, Timeline Zoom, Vector Painting & Curve Editing (MINOR)** — Phases 59-62 (shipped 2026-11-14)
- ⏳ **v2.2.0 Brush Tips & Medium Engine (MINOR)** — Phases 63-64 (planned)
- ⏳ **v2.3.0 Studio API/MCP (MINOR)** — Phase 65 (planned)

## Phases

<details>
<summary>✅ v2.1.0 Rail Motion, Timeline Zoom, Vector Painting & Curve Editing (MINOR) — SHIPPED 2026-11-14</summary>

Four phases (59-62, 67/67 plans). 38/38 requirements met or accepted (MOTN-12 undo half accepted as a deviation); audit verdict `tech_debt` with zero blocking gaps, 4/4 phases verified (109/109 must-haves), integration 37/38 and flows 4/5. Every rail animates through compositor-applied Motion keys with the v7 channel lanes; timeline zoom 0.25×-4× from one pitch authority; pen-drawn vector painting with per-vertex size and colour; painted-stroke curve editing re-baking from the recovered pre-script base across every Loop Clip occurrence. No new runtime dependencies.

- [x] Phase 59: Rail Motion Channels & v7 Interface (25/25 plans) — completed 2026-11-08
- [x] Phase 60: Studio Timeline Horizontal Zoom (6/6 plans) — completed 2026-11-09
- [x] Phase 61: Vector Painting Tool (31/31 plans) — completed 2026-11-12
- [x] Phase 62: Painted-Stroke Curve Editing (5/5 plans) — completed 2026-11-14

See `milestones/v2.1.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v2.0.1 Rail Editing & v7 Timeline Rails (PATCH) — SHIPPED 2026-11-05</summary>

One phase (58, 10/10 plans) plus the in-milestone v7 timeline-rails quick. 15/15 requirements (RAIL-01..07, VIS-01..08), audit verdict `tech_debt` with 0 gaps, integration 14/14 and flows 7/7. No `.mce` schema, document, store, or persistence change. Tag `v2.0.1` → `49b5f7e57`, signed/notarized GitHub Latest.

- [x] Phase 58: Rail editing regressions (10/10 plans) — completed 2026-11-05
- [x] v7 timeline rails (in-milestone quick 261104-bop) — completed 2026-11-04

See `milestones/v2.0.1-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v2.0.0 Multi-Module Paint Workstation (MAJOR) — SHIPPED 2026-11-02</summary>

Shipped as a **single Water color workstation**: the module switcher and the Krita placeholder were removed pre-publish (261102-iv5), brushes are preset-only, paper is baked into the watercolor sheet, and `efx-spectral` is off the production path. See `milestones/v2.0.0-ROADMAP.md` for full phase details and the accepted supersessions.

- [x] Phase 54: Preact 11 update (5/5 plans) — completed 2026-10-14
- [x] Phase 55: efx-paint-host (engine-1 host split) (10/10 plans) — completed 2026-10-15
- [x] Phase 56: efx-watercolor (engine 2, paint-aquarelle, clean-room) (11/11 plans) — completed 2026-10-21
- [x] QUICK-01: audio-trim-to-view (in-milestone quick) — completed 2026-11-02

</details>

<details>
<summary>✅ v1.0.1 Debt Patch Release (quicks + inserted Phase 53.1) — SHIPPED 2026-10-13</summary>

PATCH milestone per the semver ladder locked 2026-10-12 (PATCH for debt, MINOR for features). Quicks-first: 6 debt quicks + 1 inserted phase (53.1 frame-model fix) + release. 13/13 v1 requirements approved.

- [x] Quick 1 (261012-c9a): Display-class save token — SAVE-01..03, UAT approved 2026-10-12
- [x] Quick 2 (261012-d6q): Video disk-reference law — VID-01..03, UAT approved 2026-10-12
- [x] Quick 3 (261012-exn): Document-sound decode readiness — SND-01..02, UAT approved 2026-10-12
- [x] Quick 4 (261012-kxg): Export video readiness — VID-04, UAT approved 2026-10-13
- [x] Quick 5 (261013-ctd): Export mux duration law — EXP-01, UAT approved 2026-10-13
- [x] Phase 53.1 (frame-model-fix): Law-1..4 / I-1..5, 6 plans, UAT 5/5 approved 2026-10-13
- [x] Quick 6 (261013-fdh): Field-drop-hole closure N1-N4 + TS↔Rust field-diff contract — MBL-01, pinned 2026-10-13
- [x] Release (261012-hw3): REL-01 version single-source + REL-02 signed/notarized GitHub Latest, published 2026-10-13

</details>

<details>
<summary>✅ v1.0.0 EFX Paint Multi-Track Frames and Reveal (Phases 45-53) — SHIPPED 2026-10-12</summary>

See `milestones/v1.0.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity (Phases 39-44) — SHIPPED 2026-08-21</summary>

See `milestones/v0.9.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v0.8.0 Standalone Physics Paint (Phases 34-38.1) — SHIPPED 2026-08-01</summary>

See `milestones/v0.8.0-ROADMAP.md` for full phase details.

</details>

---

### ⏳ v2.2.0 Brush Tips & Medium Engine (Planned)

**Milestone Goal:** Make the brush tip a real stamp — an imported image becomes the 192×192 mask, travels inside the `.mce`, and survives reopen with three textured tips shipped by default — then give paint named Mediums, real thickness, order and scattering so it can read denser, heavier and genuinely opaque, and group the brushes by medium.

**Source of truth:** `SPECS/v2.2.0-brush-tips/` (specs 01-02) and `SPECS/v2.2.0-medium-engine/` (specs 03-08). No research phase: the eight specs carry the exact file anchors, laws and UAT rows.

- [x] **Phase 63: Brush Tip Pipeline** - An imported PNG/JPG becomes the real 512×512 tip mask in the machine-level user texture library, rebuilt on open; the `.mce` carrier and shipped built-ins were superseded by quick 261116-inu (completed 2026-11-17)
- [ ] **Phase 64: Medium Engine** - A Viscosity global, five Medium profiles, a real paint-thickness field lit as an emboss, a `Body` order term, a scattering term and medium-grouped brushes make paint read dense, heavy and opaque — with a light pigment able to cover and lighten a dark one

**Spec provenance** (planner input, not an execution unit — the `GSD-QUICK-PROMPT-*` filenames are historical names, not quick dispatches): `GSD-QUICK-PROMPT-01-mask-wiring.md` → Phase 63 (TIP-01..06, TIP-10 import caps) · `GSD-QUICK-PROMPT-02-embedded-tips.md` → Phase 63 (TIP-07..09, TIP-11..17, TIP-10 stored-mask caps) · `GSD-QUICK-PROMPT-03-viscosity.md` → Phase 64 (MED-01..06) · `GSD-QUICK-PROMPT-04-medium-profile.md` → Phase 64 (MED-07..13) · `GSD-QUICK-PROMPT-05-pigment-relief.md` → Phase 64 (MED-14..18) · `GSD-QUICK-PROMPT-06-coverage.md` → Phase 64 (MED-19..25) · `GSD-QUICK-PROMPT-07-brush-groups.md` → Phase 64 (MED-26..31) · `GSD-QUICK-PROMPT-08-scattering.md` → Phase 64 (MED-32..38).

Both phases are **plan-backed**: `/gsd-plan-phase` produces the plans from these specs and `/gsd-execute-phase` runs them. The specs are not dispatched through `/gsd-quick` — a phase with zero plans fails `execute-phase`, and quicks never update this roadmap. Every medium-engine unit below is a **plan of Phase 64**, not a quick.

---

### ⏳ v2.3.0 Studio API/MCP (Planned)

**Milestone Goal:** Expose the shipped Studio model through an external API/MCP surface, designed against the model v2.2.0 finalises.

- [ ] **Phase 65: Studio API/MCP** - An external API/MCP surface drives the Studio from outside the app on the shipped model

---

## Phase Details

### Phase 63: Brush Tip Pipeline

**Goal**: An imported PNG or JPG becomes the actual brush tip — a real 512×512 mask in the machine-level user texture library that rebuilds on open and paints the same footprint live, baked and replayed. The `.mce` brush carrier, per-project mask assets and the three shipped built-ins were superseded by quick 261116-inu (UAT-approved 2026-11-16); the supersession is recorded in REQUIREMENTS.md.

**Depends on**: Nothing (first phase of v2.2.0; plan order follows spec order 01 → 02, with the second spec building on the first's decode path)

**Requirements**: TIP-01, TIP-02, TIP-03, TIP-04, TIP-05, TIP-06, TIP-07, TIP-08, TIP-09, TIP-10, TIP-11, TIP-12, TIP-13, TIP-14, TIP-15, TIP-16, TIP-17

**Success Criteria** (what must be TRUE):
  1. Importing a grayscale or transparent PNG/JPG visibly changes the stroke footprint to that image's texture instead of a round blob — alpha when the image carries meaningful transparency, otherwise luminance with polarity from mean luminance — a 4K import stays responsive, and a corrupt file with a valid PNG header is refused with the existing copy and no crash.
  2. A stroke painted with an imported tip survives save → quit → relaunch → open and replays with its texture from the machine-level library: the baked frame shows the footprint the live stroke did, and moving then renaming then deleting the original source image changes nothing. On a machine without that texture the stroke replays with the response tip and a warning (declared loss, approved 2026-11-16); importing the same texture there restores the look.
  3. Imported textures are the only source: a fresh install ships no built-in textures and the machine library is scanned at app start (supersedes the original three-built-ins criterion).
  4. A library texture that is missing, corrupt or not exactly 512×512 degrades to an unavailable tip with the neutral round fallback — never a crash and never blank paint; the standing aggregate warning line was dropped on request (2026-11-16). Deleting a library texture is confirm-gated and container-scoped.
  5. A roto script saved with an imported tip carries only the texture id and its per-stroke rotation (metadata-only), so applying it into a project paints that texture when the machine library has it; every recorded stroke snapshots its own rotation. The catalog is machine-scoped, not per-project, so no project-scoped ghost mask survives.

**Plans:** 17/17 plans executed

Plans:
**Wave 1**
- [x] 63-17-PLAN.md — Gap closure CR-03/WR-15: per-episode close acknowledgement and own-track withheld-content scope
- [x] 63-10-PLAN.md
- [x] 63-13-PLAN.md
- [x] 63-14-PLAN.md
- [x] 63-15-PLAN.md — Gap closure G-63-5: AQTL v3 carries engine.textureId through the per-track snapshot
- [x] 63-01-PLAN.md — Mask derivation law, registry and the one live/bake mapping
- [x] 63-02-PLAN.md — Rust brush-asset branch: encode, write, bound guard, batch read

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 63-16-PLAN.md
- [x] 63-11-PLAN.md
- [x] 63-12-PLAN.md
- [x] 63-03-PLAN.md — Three compile-time textured tips baked from the supplied art
- [x] 63-09-PLAN.md — Fresh-profile copy and project provisioning (runs in wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 63-04-PLAN.md — `.mce` brushPack carrier, catalog store and save staging

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 63-05-PLAN.md — Import pipeline and the cross-realm catalog boundary (producer + Studio receiver)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 63-06-PLAN.md — Sectioned brush library, per-tip previews, import row, one warning

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 63-07-PLAN.md — Project-open registration, per-tip degradation, replace/reset

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 63-08-PLAN.md — Roto script mask carrier: inline WebP data URL, session masks

**Specs**: `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-01-mask-wiring.md`, `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-02-embedded-tips.md`

**Spec provenance** (planner input, not an execution unit): spec 01 — mask derivation (192×192, two-branch alpha/luminance-polarity law, 64 MP pre-decode cap), `buildBrushForStroke` wiring from `CUSTOM_BASE`, brush-library-fed engine mask registry; spec 02 — `brushPack` in the `.mce` root with package-relative mask asset refs, three compile-time built-in masks, roto-script mask carrier, project-open catalog scoping. Spec 02 depends on spec 01's decode path, and spec 01 owns the one decode path. **Both specs are amended by `63-CONTEXT.md` §Requirement amendments — the amendments win.**

**Delivery law**: the `.mce` gains the `brushPack` root key and an entry asset-ref field, declared in BOTH the TypeScript model and the Rust struct under the field-diff pin (`app/src/lib/mceFieldContract.test.ts`) with a save → reopen byte-identical round-trip; masks are lossless WebP assets at `brushes/<sha256>.webp` inside the package, written and read only through Rust, with the `frames/` MEDIA lock never widened — **the D-23 "inline data, never a file reference" exception is retired**, no external path reference of any kind may exist for a tip, the source image is never copied into the project, and opening never re-derives the mask; save copies stored bytes and never re-encodes; decoded masks are registered inside the project-open await, before the first stroke replay of a loaded project, and a failing tip degrades rather than aborting the open; the three built-in masks are compile-time constants that must stay well inside the 2 MB chunk ceiling; no new runtime dependency.

**UI hint**: yes

### Phase 64: Medium Engine

**Goal**: Paint gains weight — one Viscosity global, five named Mediums, a real paint-thickness field lit as an emboss, an order term (`Body`), a scattering term and medium-grouped brushes let a stroke read denser, heavier and genuinely opaque, while a neutral watercolor stroke renders exactly as it did before.

**Depends on**: Phase 63 (milestone execution order; no shared file is a prerequisite — spec order chains internally: Viscosity → Medium records → thickness/emboss → order (`Body`) → scattering, with brush groups last)

**Requirements**: MED-01..MED-38 (viscosity 01-06 · mediums 07-13 · thickness/emboss 14-18 · order 19-25 · brush groups 26-31 · scattering 32-38)

**Success Criteria** (what must be TRUE):
  1. A Viscosity row joins the existing globals panel; at its neutral default an existing project's paint renders bit-identically after the milestone, and at maximum viscosity the stroke visibly hardens — paint stops moving almost immediately and the deposit reads denser — without redefining `flow`.
  2. The same stroke rasters identically live, on bake and on replay with the same viscosity value, and lowering Viscosity after a stroke has settled does not change the settled pigment.
  3. A fresh session selects `watercolor` with today's defaults; the five mediums (`watercolor`, `gouache`, `pastel`, `graphite`, `acrylic`) each apply their whole parameter set in one move and change the next stroke only — five strokes painted in five mediums replay with their own looks, a machine with different medium defaults replays a project identically, and a manual global tweak keeps the medium selected and reaches the next stroke.
  4. Heavy paint has visible body: strokes deposit a thickness through their own tip and superpose, the composite lights the thickness gradient with a lit side and a shadow side, and the light is a render parameter that changes the render — on live paint, a stroke re-render, a Play motion, an Apply Script and a vector edit — never the paint itself.
  5. A light pigment covers and lightens a dark one: `Body` high erases the settled pigment under the tip footprint (full at the core, partial at the edges, so the border blends) and scatters, `Body` 50 lightens without erasing, and at `Body` 0 no cover pass runs and an existing project renders bit-identically.
  6. The brush library groups the responses by medium in five sections; picking a brush applies its group's medium in one store write only when the group changes; the 15 existing responses are classified and the eight new ones ship.
  7. Export matches the screen on every `uMode` path, zooming produces no shimmer or crawl, and undo restores the eroded pigment and the eroded thickness exactly.

**Plans:** 24 of 28 executed — 17 executed (coverage-replacement addendum 64-13…64-17 planned 2026-11-18), 3 gap-closure plans added 2026-11-18 from `64-VERIFICATION.md`, 4 acrylic-bristle extension plans (64-21…64-24) planned 2026-11-19 from `64-CONTEXT.md` + Spike 002, and 4 re-review gap-closure plans (64-25…64-28) planned 2026-11-22 from `64-VERIFICATION.md` + `64-REVIEW.md`

Plans:
**Wave 1**
- [x] 64-01-PLAN.md — Tracer: the Viscosity term from the canonical bag through the one mapping into its two engine sites, plus the committed neutral pixel baseline and both comparator modes

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 64-02-PLAN.md — Five frozen medium records over the canonical set, the Viscosity row with its per-stroke snapshot, the one-write medium application and the Paint-tab dropdown

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 64-03-PLAN.md — The thickness field: relief target, footprint deposit, Lift erosion and the positional undo pairing

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 64-04-PLAN.md — The emboss composite, engine light state, the Emboss row and the two byte-identity gates

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 64-05-PLAN.md — The document light: optional additive member, fail-closed parser, one store mutation, the dual-language declaration and the Studio handoff
- [x] 64-06-PLAN.md — The Body cover pass: the single shared `bodyCurve` law, settle protection, tip-footprint erosion, the Body row and the Body 0 gate

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 64-07-PLAN.md — The light on every render path — live, Play bake, Apply bake — the content-signature term and the snapshot-controller contract
- [x] 64-08-PLAN.md — Scattering transport: `S` through `inkB.a`/`fixedB.a`, the settle carry and the white-gouache retirement

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 64-09-PLAN.md — The Paper & Light tab: three controlled rows below the paper grain pair, the renamed label and the panel wiring from the Studio's document read
- [x] 64-10-PLAN.md — The Kubelka-Munk composite, the scattering-free early-out, the calibration pins and the probe gate matrix

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 64-11-PLAN.md — Brush groups: the compile-time group tag, the classification, eight new responses and five always-expanded sections

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 64-12-PLAN.md — The group-to-medium pick seam: one live-bag write only when the group changes, and the source audit that keeps every response surface on it

**Wave 10** *(coverage addendum; blocked on the executed 64-06 + 64-10)*
- [x] 64-13-PLAN.md — Engine core: Spike 001's per-dab coverage composite (persistent one-channel coverage pair, `coverDeposit`/`coverMask`, mode-4 coverage alpha) and the deletion of the rev-4 `preInk`/`inkCover`/`coverDensity` seam

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 64-17-PLAN.md — Probe harness: digest the pigment sheet, commit the 1080² Body-0 identity law, turn Spike 001's criterion-1 numbers into standing invariants and re-specify the cover-over-wet scenario

**Wave 12** *(blocked on 64-13 + 64-17 completion)*
- [x] 64-14-PLAN.md — Coverage lifecycle: advect the channel with the ink, carry it through undo/redo and whole-document transport, and destroy it with Lift

**Wave 13** *(blocked on 64-13 + 64-14 completion)*
- [x] 64-15-PLAN.md — App wiring and deletion: carry the coverage alpha into the normal commit, and delete the rev-4 cover punch transaction and the round-1..4 display-swap/reset seams

**Wave 14** *(blocked on 64-13 + 64-14 + 64-15 + 64-17 completion)*
- [x] 64-16-PLAN.md — Acceptance: textured-tip coverage, the three Spike 001 tuning pins, and the UAT re-specification

**Gap closure** *(from `64-VERIFICATION.md` — 4 failed must-haves; planned 2026-11-18)*
- [x] 64-18-PLAN.md — Light gesture ledger: one drag becomes one document write path and one unified-ledger entry, with the live sheet still re-lighting during the drag (closes 64-07 truth 1 and 64-09 truth 5, CR-02)
- [x] 64-19-PLAN.md — Light reaches committed and cached frames: the canonical `lightSignature` in every frame-cache revision plus one bounded re-bake per light gesture (closes 64-07 truth 5, CR-01; blocked on 64-18)
- [x] 64-20-PLAN.md — Coverage/film coherence: coverage transports only where its own paint film leaves the paper-white line, so the Body-100 white-over-blue gate greens with every bar intact and no bar widened (closes 64-17 truth 4)

**Acrylic bristle extension** *(from `64-CONTEXT.md` + Spike 002 — planned 2026-11-19; strictly sequential)*
**Wave 15**
- [x] 64-21-PLAN.md — Record and reservoirs: pin the paper seed, generate the deterministic bristle set from `traceSeed`, and give every bristle its `1 × 256` reservoir pair with the carrier pass per dab — no visual law change, every identity gate byte-identical

**Wave 16** *(blocked on 64-21 completion)*
- [x] 64-22-PLAN.md — The gather and the mixing law: the 5-nearest ink-weighted carried coefficients, the RGB→coefficient law, `pickup`/`refill`/`wetSeconds` exposed, and Body composition through the coverage composite with the D-21 bristle-modulated cover for the two bristle responses only

**Wave 17** *(blocked on 64-22 completion)*
- [x] 64-23-PLAN.md — Traces and directional edges: `broken` (§4.3), the `grainHeight` trio (§4.4), rim contact (§5.3), landing (§5.4), `dryEdge` (§5.5) and the `wide`/`local` body (§4.5) — the acceptance capture for directional anti-aliased edges

**Wave 18** *(blocked on 64-23 completion)*
- [x] 64-24-PLAN.md — Acrylic water and wetness: the document-sized `R32F` last-touch ping-pong pair (D-24), the §3.4 `exp(−age / wetSeconds) · coverage` gate in the carrier, the D-25 acrylic record retune and the Wet/Dry acceptance capture

**Wave 19 — re-review gap closure** *(from `64-VERIFICATION.md` + `64-REVIEW.md`; planned 2026-11-22; criticals first per the artist's G-01 ruling; all four are independent of each other — no shared file)*
- [x] 64-25-PLAN.md — Coverage-composite merge: the real-compositor gate, the red-channel/cover-0/0.5-exponent property, and the committed alpha law stated and proven end to end (closes CR-04)
- [x] 64-26-PLAN.md — Last-touch carry and clock: the previous-dab-rect carry with its three invalidations and corrected docstring, the AGES whole-document boundary with a monotonic live base, and the dead `uAmount` retired (closes CR-03, WR-03, IN-04)
- [ ] 64-27-PLAN.md — Relight refusal: a blocked request parks and re-lights exactly once on the idle edge, with no retry loop while playback/draft/wireframe persists (closes WR-04)
- [ ] 64-28-PLAN.md — Digest and floor: the canonical whole-event sheet signature, and the pickup floor derived from the recorded baseline gap (closes IN-05, IN-07)

**Specs**: `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-03-viscosity.md`, `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-04-medium-profile.md`, `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-05-pigment-relief.md`, `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-06-coverage.md`, `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-07-brush-groups.md`, `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-08-scattering.md`

**Spec provenance** (planner input, not an execution unit — the `GSD-QUICK-PROMPT-*` filenames are historical names, not quick dispatches): spec 03 — Viscosity global (dissipation raises only, spread `0.12 × (1 − v·0.9)`, per-stroke snapshot like `lift`); spec 04 — five medium records over the canonical globals, one store write per switch; spec 05 — a real paint-thickness channel deposited through the tip, lit as an emboss with a document-level render light; spec 06 — `Body` order (a covering dab erodes the settled layer with the Lift program under its own tip, then deposits its own pigment); spec 07 — brush groups (compile-time `group` tag, five sections, group → medium in one write, 15 classified + 8 new responses); spec 08 — Kubelka-Munk scattering (`S` in `inkB.a`/`fixedB.a`, `Body`-driven, `S = 0` bit-identical).

**Delivery law — AMENDED 2026-11-18 (Spike 001):** the clauses "`Body` adds no target and no shader program (it reuses the Lift program), never touches water or mobile pigment" and "no alpha compositing" are superseded by the approved coverage composite. `Body` now ships ONE persistent one-channel coverage target pair plus three small programs (`coverDepositFS`, `coverMaskFS`, `advectCoverFS`), attenuates mobile pigment source-over in coefficient space, and the live/commit sheet carries a coverage-derived alpha. The rendered cost is bounded and replaces the per-stroke 17.8 MiB `preInk` snapshot and the app-level punch. Authority: `.planning/spikes/001-coverage-composite/VERDICT.md`; plans 64-13/64-14/64-15/64-17.

**Delivery law — AMENDED 2026-11-19 (Spike 002, acrylic bristle):** the clauses "no new render target, no texture allocation" are amended EXACTLY for the acrylic bristle deposit (D-29): the bristle responses add three `RGBA16F` `1 × 256` reservoir ping-pong pairs, one static `RGBA16F` `1 × 256` shape target re-seeded at every stroke start, three passes per dab (the `1 × 256` carrier, the gather over the dab rectangle — ink deposit, coverage write and Body mask, all three off one shared `BRISTLE_GATHER` snippet — and the touch refresh) and ONE document-sized `R32F` last-touch ping-pong pair on the coverage-lifecycle precedent (its cleared value is a sentinel one week old, and it is engine state only — frame cache 0 B, no project member). Nothing else is added; `wetSeconds` is the acrylic record's own paint-tack time and never redefines `dryTau()`, and no paint-derived number may reach a covering density or a pigment coefficient. Every non-bristle response and every identity baseline stays byte-identical. Authority: `.planning/phases/64-medium-engine/64-CONTEXT.md` (D-21…D-29) + `.claude/skills/spike-findings-efx-motion-editor/references/bristle-deposit.md`; plans 64-21/64-22/64-23/64-24.

**Delivery law**: Viscosity is additive to the existing globals — never a redefinition of `flow`, `water`, `load`, `bleed` or any deposit math — and is applied at exactly the two named engine sites; replay determinism (same stroke ⇒ same raster live, bake and replay) is the acceptance bar for every term; the persisted changes are the additive per-stroke `viscosity`, `body` and `emboss` keys inside the canonical params bag the engine slot carries (Rust holds that slot as an opaque `Value`, so the keys round-trip without a Rust mirror) plus the optional document `light` field, declared in BOTH TS and Rust under the field-diff pin; medium records are plain serializable data and the per-stroke params snapshot stays authoritative over the advisory medium id; thickness adds exactly ONE document-resolution half-float channel — no other render target, no texture allocation, no height texture asset — is captured in the engine snapshot and protected for undo; the light is never stored in paint and enters the cache content fingerprint, so a light change is a cache miss and a deterministic re-bake; `Body` adds no target and no shader program (it reuses the Lift program), never touches water or mobile pigment, and at 0 runs no cover pass; scattering reuses `inkB.a`/`fixedB.a` with no new pass and retires the white-gouache path, and `S = 0` must reproduce today's Beer-Lambert output exactly (pixel-buffer comparison); no alpha compositing, no second engine and no second module; no package/type/signal/`BRUSH_PACK_KIND` rename and no `.mce` schema break.

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 63. Brush Tip Pipeline | 17/17 | Complete | 2026-11-17 |
| 64. Medium Engine | 26/28 | In Progress | - |

---

**Execution Order:** 59 → 60 → 61 → 62 (v2.1.0) → 63 → 64 (v2.2.0) → 65 (v2.3.0). Global numbering continues; Phase 57 is retired and never reused.
