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

**Milestone Goal:** Make the brush tip a real stamp — an imported image becomes the 192×192 mask, travels inside the `.mce`, and survives reopen with three textured tips shipped by default — then give paint a named Medium so it can read denser and heavier than a wash.

**Source of truth:** `SPECS/v2.2.0-brush-tips/` (specs 01-02) and `SPECS/v2.2.0-medium-engine/` (specs 03-05). No research phase: the five specs carry the exact file anchors, laws and UAT rows.

- [ ] **Phase 63: Brush Tip Pipeline** - An imported PNG/JPG becomes the real 192×192 tip mask, stored inside the project and rebuilt on open, with three textured tips shipped by default
- [ ] **Phase 64: Medium Engine** - A Viscosity global and named Medium profiles make paint read denser and heavier, with heavy pigment gaining visible body from its own density

**Spec provenance** (planner input, not an execution unit): `GSD-QUICK-PROMPT-01-mask-wiring.md` → Phase 63 (TIP-01..06, TIP-10 import caps) · `GSD-QUICK-PROMPT-02-embedded-tips.md` → Phase 63 (TIP-07..09, TIP-11..17, TIP-10 stored-mask caps) · `GSD-QUICK-PROMPT-03-viscosity.md` → Phase 64 (MED-01..06) · `GSD-QUICK-PROMPT-04-medium-profile.md` → Phase 64 (MED-07..13) · `GSD-QUICK-PROMPT-05-pigment-relief.md` → Phase 64 (MED-14..18).

Both phases are **plan-backed**: `/gsd-plan-phase` produces the plans from these specs and `/gsd-execute-phase` runs them. The specs are not dispatched through `/gsd-quick` — a phase with zero plans fails `execute-phase`, and quicks never update this roadmap.

---

### ⏳ v2.3.0 Studio API/MCP (Planned)

**Milestone Goal:** Expose the shipped Studio model through an external API/MCP surface, designed against the model v2.2.0 finalises.

- [ ] **Phase 65: Studio API/MCP** - An external API/MCP surface drives the Studio from outside the app on the shipped model

---

## Phase Details

### Phase 63: Brush Tip Pipeline

**Goal**: An imported PNG or JPG becomes the actual brush tip — a real 192×192 mask that travels inside the `.mce`, rebuilds on open, and paints the same footprint live, baked and replayed, with three textured tips available on every install.

**Depends on**: Nothing (first phase of v2.2.0; plan order follows spec order 01 → 02, with the second spec building on the first's decode path)

**Requirements**: TIP-01, TIP-02, TIP-03, TIP-04, TIP-05, TIP-06, TIP-07, TIP-08, TIP-09, TIP-10, TIP-11, TIP-12, TIP-13, TIP-14, TIP-15, TIP-16, TIP-17

**Success Criteria** (what must be TRUE):
  1. Importing a grayscale or transparent PNG/JPG visibly changes the stroke footprint to that image's texture instead of a round blob — alpha when the image carries meaningful transparency, otherwise luminance with polarity from mean luminance — a 4K import stays responsive, and a corrupt file with a valid PNG header is refused with the existing copy and no crash.
  2. A stroke painted with an imported tip survives save → quit → relaunch → open and replays with its texture from the `.mce` alone: the baked frame shows the footprint the live stroke did, moving then renaming then deleting the original source image changes nothing, copying the project alone to a fresh profile reproduces identical strokes and an identical brush library listing, and an untouched save/reopen is byte-identical.
  3. A fresh install with no import already lists and paints three textured tips — Bristle fan, Chalk grain, Sponge — which are app-owned and never written into a project.
  4. A stored mask that is missing, corrupt or not exactly 192×192 degrades to an unavailable tip with the neutral round fallback and exactly one aggregate named warning — never a crash, never blank paint, never an aborted open — and closing the project or starting a New Project resets the catalog and mask registry so no ghost mask survives.
  5. A roto script saved with an imported tip paints that texture when applied into a project that never imported it, and opening a project replaces — never appends to — the tip catalog and mask registry with that project's entries plus the three built-ins, so a tip imported in project A does not exist in project B.

**Plans:** 14/15 plans executed

Plans:
- [x] 63-10-PLAN.md
- [x] 63-11-PLAN.md
- [x] 63-12-PLAN.md
- [x] 63-13-PLAN.md
- [x] 63-14-PLAN.md
- [ ] 63-15-PLAN.md — Gap closure G-63-5: AQTL v3 carries engine.textureId through the per-track snapshot

**Wave 1**
- [x] 63-01-PLAN.md — Mask derivation law, registry and the one live/bake mapping
- [x] 63-02-PLAN.md — Rust brush-asset branch: encode, write, bound guard, batch read

**Wave 2** *(blocked on Wave 1 completion)*
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

**Goal**: Paint gains weight — one Viscosity global, three named Mediums and a pigment-relief term let a stroke read denser and heavier than a wash, while a neutral watercolor stroke renders exactly as it did before.

**Depends on**: Phase 63 (milestone execution order; no shared file is a prerequisite — spec order chains internally: Viscosity → Medium records → relief strength)

**Requirements**: MED-01, MED-02, MED-03, MED-04, MED-05, MED-06, MED-07, MED-08, MED-09, MED-10, MED-11, MED-12, MED-13, MED-14, MED-15, MED-16, MED-17, MED-18

**Success Criteria** (what must be TRUE):
  1. A Viscosity row joins the existing globals panel; at its neutral default an existing project's paint renders bit-identically after the milestone, and at maximum viscosity the stroke visibly hardens — paint stops moving almost immediately and the deposit reads denser — without redefining `flow`.
  2. The same stroke rasters identically live, on bake and on replay with the same viscosity value, and lowering Viscosity after a stroke has settled does not change the settled pigment.
  3. A fresh session selects `watercolor` with today's defaults; switching to `dry` or `opaque` applies its whole parameter set in one move and changes the next stroke only — three strokes painted in three mediums replay with their own looks, a machine with different medium defaults replays a project identically, and a manual global tweak keeps the medium selected and reaches the next stroke.
  4. Heavy pigment reads with visible body: `opaque` shows a lit relief instead of a flat stain, overpainting a wet area follows the merged density rather than stamping a hard edge, and `watercolor` at relief strength 0 renders byte-identically — additive relief only, with no new slider.
  5. Export matches the screen on both `uMode` paths, and zooming in or out produces no shimmer or crawl.

**Plans**: TBD

**Specs**: `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-03-viscosity.md`, `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-04-medium-profile.md`, `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-05-pigment-relief.md`

**Spec provenance** (planner input, not an execution unit): spec 03 — Viscosity global (dissipation raises only, spread `0.12 × (1 − v·0.9)`, per-stroke snapshot like `lift`); spec 04 — medium records (`watercolor` / `dry` / `opaque` derived from the existing nine globals, one store write per switch); spec 05 — density-gradient relief carried as a per-medium scalar, additive to the paper relief.

**Delivery law**: Viscosity is additive to the existing globals — never a redefinition of `flow`, `water`, `load`, `bleed` or any deposit math — and is applied at exactly the two named engine sites; replay determinism (same stroke ⇒ same raster live, bake and replay) is the acceptance bar; the only persisted change is the additive per-stroke `viscosity` key, declared in BOTH TS and Rust; medium records are plain serializable data and the per-stroke params snapshot stays authoritative over the advisory medium id; relief is additive to the existing paper relief — no paint height field, no extra render target, no new texture allocation, no new global slider — and `watercolor` at strength 0 stays byte-identical; no package/type/signal/`BRUSH_PACK_KIND` rename and no format break.

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 63. Brush Tip Pipeline | 14/14 | In Progress | - |
| 64. Medium Engine | 0 plans | Not started | - |

---

**Execution Order:** 59 → 60 → 61 → 62 (v2.1.0) → 63 → 64 (v2.2.0) → 65 (v2.3.0). Global numbering continues; Phase 57 is retired and never reused.
