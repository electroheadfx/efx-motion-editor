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
- 🚧 **v2.1.0 Rail Motion, Timeline Zoom, Vector Painting & Curve Editing (MINOR)** — Phases 59-62 (in progress)

## Phases

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

### 🚧 v2.1.0 Rail Motion, Timeline Zoom, Vector Painting & Curve Editing (In Progress)

**Milestone Goal:** Turn every rail into an animatable object — independent Motion keys driving a compositor-level transform — then add frame-density timeline zoom, a vector painting tool, and painted-stroke curve editing.

- [x] **Phase 59: Rail Motion Channels & v7 Interface** - Any rail animates through independent Motion keys applied at the compositor, with the v7 channel lanes (completed 2026-11-08)
- [x] **Phase 60: Studio Timeline Horizontal Zoom** - Frame density zooms 0.25×-4× from one pitch authority with all vertical geometry fixed (completed 2026-11-09)
- [ ] **Phase 61: Vector Painting Tool** - Pen-drawn vector strokes with per-vertex width, per-stroke style, wireframe preview, persistence, and export
- [ ] **Phase 62: Painted-Stroke Curve Editing** - A selected painted stroke reshapes as a curve and re-bakes from its pre-script base across every loop occurrence

---

## Phase Details

### Phase 59: Rail Motion Channels & v7 Interface

**Goal**: Every rail — Standard, Motion, Static, Reveal, or a bare Key Rail — can be animated by Motion keys that are independent of its drawing keys, and the transform is applied once at the compositor so edit view, Play, and export show the same frame.

**Depends on**: Nothing (first phase of v2.1.0; builds on the shipped v2.0.1 rail surface)

**Requirements**: MOTN-01, MOTN-02, MOTN-03, MOTN-04, MOTN-05, MOTN-06, MOTN-07, MOTN-08, MOTN-09, MOTN-10, MOTN-11, MOTN-12, MUI-01, MUI-02, MUI-03, MUI-04, MUI-05, MUI-06, REL-01, REL-02, REL-03, REL-04

**Success Criteria** (what must be TRUE):
  1. A Motion key can be added on any rail — Standard, Motion, Static, Reveal, or a bare Key Rail — with no cycle value, no conversion, and no drawing key created or altered, and that rail then animates.
  2. Position (grouped whole-position or split X + Y), Scale, Rotation, and Opacity each animate with their own keys; channels open on demand one at a time; a track with motion shows the coloured chevron (right collapsed, down expanded) and a track without motion shows the grey minus.
  3. Rail motion is applied at the compositor: one content raster per track per frame, content cycles while motion continues, nothing re-bakes; a Motion edit invalidates the composite and the flattened memo does not grow per drag step.
  4. A rail carrying motion on the active track renders the identical frame in edit view, Play, and export, and motion-blur export still contains paint on every frame (integer content raster with a fractional transform).
  5. Motion survives save → close → reopen; rotation is unbounded and values hold outside the keyed range; rail / drawing-key / motion-key selection scopes work independently with Ease, Wiggle (seeded, deterministic at export), and Hold on Motion keys only; every key operation is one undo/redo step; and the v7 chrome matches its contract (18px lanes, header cluster with previous/diamond/next, 16×18 cells, 6×6 keys with the lighter type rim, rounded selected-rail outline wrapping the rail row plus its expanded channels, one open block at a time, header and lanes aligned while scrolling).

**Plans:** 25/25 planned (21 executed, 4 gap-closure plans pending)

Plans:
**Wave 1**
- [x] 59-01-PLAN.md — Gates A–D ratification + TS↔Rust `railKind` canonical parity tracer and golden fixture

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 59-02-PLAN.md — Rail-motion model: types, value domains, fail-closed parser, rail-id mint, pure edit reducer

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 59-03-PLAN.md — Persistence: document allowlist, conditional canonical term, one revision authority, save→reopen pin
- [x] 59-05-PLAN.md — Pure evaluator: endpoint hold, Hold/Ease, unbounded rotation, seeded wiggle, lane curve path

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 59-04-PLAN.md — Rust `canonical_rail_motions` mirror + fail-closed validation + cross-language motion fixture
- [x] 59-06-PLAN.md — Gate B durable rail identity: bindings, reconciliation, orphans, split/merge/delete transitions

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 59-07-PLAN.md — Store/apply/bridge/undo wiring + canonical-vs-raster revision split (no re-bake on motion drags)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 59-08-PLAN.md — Compositor `trackTransforms` at both draw sites + motion key term + memoized rail-space pivot
- [x] 59-10-PLAN.md — v7 lane surface: 18px lanes, header cluster, cells, evaluator curve, 6×6 keys, block outline

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 59-09-PLAN.md — Sub-frame export law: integer content frame, fractional transform, flattened-memo bypass
- [x] 59-11-PLAN.md — Timeline integration: chevron toggle over session-only expansion (collapsed after Animate), mirrored headers, measured layout, block-aware reorder

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 59-12-PLAN.md — Animate (seed at the rail-local playhead) + motion commands, Hold/Ease/Wiggle, honest availability, three selection scopes

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 59-13-PLAN.md — Rail-motion gizmo: session draft, one commit per drag, the D-08 auto-key gate, additive Studio mount

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 59-15-PLAN.md — Gate B wiring at the real edit operations (reconciler at the bridge commit point) + copy/paste motion-follow law
- [x] 59-16-PLAN.md — Inspector numeric fields via one projection: grouped Position with independent values, unbounded rotation, opacity

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 59-14-PLAN.md — REL-01/REL-02 gates, full-surface gates, 22-row traceability table and live UAT rows

**Gap closure** *(verification gaps G1-G4; starts after Wave 11; the shared-file chain runs serially, and 59-21 runs beside 59-18 because it touches no shared file)*
- [x] 59-17-PLAN.md — G1/CR-03: add-channel command with availability, a reachable add-channel row, and an overlay menu that paints over the following rows (wave 1)
- [x] 59-18-PLAN.md — G3/CR-01 + MOTN-05: rail-set Copy and Duplicate carry the rails' motion and hash it (wave 2)
- [x] 59-21-PLAN.md — G1/IN-02: absent Motion channels render disabled and described, never as fake-editable fields (wave 2, depends on 59-17)
- [x] 59-19-PLAN.md — G2/CR-04: an infinite Loop Clip's motion view spans its full resolved duration (wave 3)
- [x] 59-20-PLAN.md — G4/CR-02 + WR-04: merge-drop reporting and honest publication, plus reveal delete/resize/bake motion reconciliation (wave 4)

**Review gap closure** *(59-REVIEW.md findings; wave 1 first, then wave 2)*
- [x] 59-22-PLAN.md — CR-01 + WR-06: reveal bake reconciles against the clip it is creating, and both copy paths segment with the document's real ownership (wave 1)
- [x] 59-23-PLAN.md — WR-01: the add-channel row always renders and is gated by the one availability authority; the strip measures it from the lane count alone (wave 1)
- [x] 59-24-PLAN.md — WR-02 + WR-05: cut/clear stop reporting an unread merge drop, and both canonical encoders order ids by byte value (wave 2, depends on 59-22)
- [x] 59-25-PLAN.md — WR-03 + WR-04: grouped Position easing/Wiggle reaches both axes, and the lane curve is seeded with the rail's id (wave 2, depends on 59-23)

**Build order (research §12)**:
  1. 59.1 — durable model + guard + parser + TS encoder + Rust mirror + byte-parity fixture (blocks everything)
  2. 59.2 — pure evaluator + curve-path builder
  3. 59.3 — store projection, actions, revision wiring
  4. 59.4 — compositor `trackTransforms` at both draw sites (before the UI, so UAT sees a real transform)
  5. 59.5 — timeline UI: channels, headers, toggle, outline, nav cluster, measured row offsets
  6. 59.6 — UAT: independent Motion keys, compositor render, three scopes, active-track parity, motion-blur export

**Gates (answer in the phase plan before 59.1)**: A — one active rail per track; B — durable identity for a motion-bearing bare Key Rail (any-rail animation is locked; the `railId` mint / split / merge / delete-first-key / copy-paste truth table is the planning work); C — rail-local time and repeat semantics (hold vs fit-to-span); D — quality at scale, with measured frame time and peak memory; plus an explicit sub-frame law for motion-blur export.

**Delivery law**: REL-01 (no new runtime dependencies) is enforced first here and holds for all of Phases 59-62. REL-02 (byte-identical save → reopen, pinned by a test) covers every new `.mce` field and is re-enforced on Phase 61's vector fields. REL-03 (motion joins the canonical document revision; sampled values never enter the flattened cache key) belongs to Phase 59 alone. REL-04 (motion-blur export keeps paint on every frame) is Phase 59's export-parity law.

**UI hint**: yes

### Phase 60: Studio Timeline Horizontal Zoom

**Goal**: Users can change the Studio timeline's frame density from 0.25× to 4× without moving a single vertical dimension, and every frame→pixel consumer reads the same pitch authority.

**Depends on**: Phase 59 (zoom rebases on the same frame→pixel expressions the motion lanes touch, so it runs second)

**Requirements**: ZOOM-01, ZOOM-02, ZOOM-03, ZOOM-04, ZOOM-05

**Success Criteria** (what must be TRUE):
  1. Cmd/Ctrl+wheel zooms the timeline frame density and keeps the frame under the cursor fixed, while a plain wheel keeps today's vertical-wheel-as-horizontal-scroll behavior.
  2. The zoom pill offers minus / percent / plus / Fit; presets are 0.25×, 0.5×, 0.75×, 1×, 1.5×, 2×, 3×, 4×; 100% equals the base 18px pitch; pill and Fit keep the playhead frame fixed, falling back to the viewport centre, and Fit clamps into range.
  3. The zoom matrix holds at 0.25×, 0.5×, 1×, 2×, and 4× across every gesture: playhead, ruler ticks, hit-testing, drag, scrub, selection, paste, sound stains, scroll-to-frame, and rail geometry all agree at each level.
  4. Row, lane, and cell heights stay fixed at every zoom level — only horizontal frame density scales — and no frame→pixel consumer multiplies a local `18`.
  5. Zoom is session-only: it resets when the Studio closes and changes no document, `.mce`, schema, persistence, or export output.

**Plans:** 6/6 plans complete

Plans:
**Wave 1**
- [x] 60-01-PLAN.md — the pitch authority module, the strip wiring (wheel, ruler, playhead, lanes) and the zoom pill

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 60-02-PLAN.md — event-time projections, ghosts and previews onto the live pitch

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 60-03-PLAN.md — sound leaves, viewport getter, open/reveal positioning and the scaled rail gap

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 60-04-PLAN.md — track rows and motion lanes onto required pitch/gap props

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 60-05-PLAN.md — retire the last local pitch default and land the zero-literal authority audit

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 60-06-PLAN.md — the five-level zoom acceptance matrix, written after the audit is green

**Prerequisite**: the literal-`18` audit reaches zero before the zoom matrix test is written. The v2.0.1 VIS-02 30-vs-31 row-height drift is not part of this phase.

**Delivery law**: REL-01 holds (no new runtime dependencies). This phase adds no `.mce` field, so REL-02 and REL-03 do not apply; REL-04 is untouched.

**UI hint**: yes

### Phase 61: Vector Painting Tool

**Goal**: Users can draw and edit resolution-independent vector strokes whose paint properties vary per vertex, that persist, export, and replay deterministically.

**Depends on**: Phase 60 (ordering only — the vector surface shares the Studio editor files with Phases 59-60; no data dependency)

**Requirements**: VEC-01, VEC-02, VEC-03, VEC-04, VEC-05, VEC-06, VEC-07

**Success Criteria** (what must be TRUE):
  1. The pen tool draws a vector stroke with corner and smooth points, and the spline pointer edits it — anchors, coupled handles, handle break, insert, delete, and multi-select — inside the existing Move/Edit surface.
  2. Stroke width varies per vertex, and brush type and colour are per stroke; the shipped data model expresses exactly the properties the phase committed to (no per-vertex brush type).
  3. A wireframe preview toggle shows strokes and paths without render and is the drag-time performance mode; vertex editing stays responsive at the measured reference stroke count.
  4. A vector stroke persists in `.mce` (declared in both TS and Rust), survives reopen, and exports exactly as previewed while keeping hide/solo, ordering, opacity, and background behavior.
  5. Deterministic replay: the same vector stroke produces the same raster across runs, undo/redo, and reopen, and undo/redo covers each vector operation.

**Plans:** 16/20 plans executed (14 executed + 6 gap-closure)

Plans:
**Wave 1**
- [x] 61-01-PLAN.md — Wave 0 spike: seam strategy, sampling density, stroke-count cost and the 1.8x width channel, as a probe verdict

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 61-02-PLAN.md — Vector spine math: derived Bezier handles, arc-length sampling, sparse width profile, determinism scan entry
- [x] 61-08-PLAN.md — Vector pen entry: the rail's fifth tool row, the V shortcut and the session store

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 61-03-PLAN.md — Payload model: anchor and render-mode types in the opaque engine slot, projection and codec validation
- [x] 61-04-PLAN.md — Engine width channel: per-sample width scale through scriptBegin/scriptMove and the adapter, measured at 1.8x

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 61-05-PLAN.md — AQTL v2: vector flags, anchor block and render-mode byte in SNAP v5, fail-closed v1 refusal, lossless restore
- [x] 61-06-PLAN.md — Declaration pair: matching TS and Rust members pinned by the field contract test, no new one-language exception
- [x] 61-07-PLAN.md — Simple ribbon: crisp render mode in the engine, the brush preset and its crisp thumb, mode-aware script begin

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 61-09-PLAN.md — Draw path: spine and anchor overlay, click/Alt/Enter/Escape gesture, one recorded stroke per path

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 61-10-PLAN.md — Edit path: anchor and handle drag, promotion, coupling, insert/delete, multi-select width, anchors travel with the stroke

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 61-11-PLAN.md — Sheet controls: the Edit path header button and the Anchor width stepper with an honest effective readout

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 61-12-PLAN.md — Render row and Advanced wet globals: two-segment mode control plus the simple-ribbon disclosure, one batch edit

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 61-13-PLAN.md — Wireframe: session-only latch generalising Draft, every stroke's construction geometry, no bake while on

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 61-14-PLAN.md — Close-out proofs: save/reopen bake-input parity, both render modes, undo/redo byte identity, cache-key behaviour

**Gap closure** *(from 61-VERIFICATION.md; waves are relative to this set — 61-15, 61-16 and 61-17 own disjoint files, 61-18, 61-19 and 61-20 follow on the Studio)*
- [x] 61-15-PLAN.md — Bake seam: the draw commit and the path-edit commit re-bake the live sheet, and a Script-Off draw is refused (G-1, G-2) — wave 1; the ledger entry it enables is 61-20
- [x] 61-16-PLAN.md — Gesture surface: pointer capture on the path-edit drag, the vector keys yield to a focused text field, and the two false history titles are corrected (G-3, G-4, G-8 test truth) — wave 1
- [ ] 61-17-PLAN.md — Input-surface law: entering Select or the picker releases the pen and the open path edit, through a dependency-free latch leaf (G-6) — wave 1
- [ ] 61-18-PLAN.md — Wireframe capture law: Draft cannot leave and the Draft settle refuses while wireframe is on, and Select states why it is inert (G-7) — wave 2, after 61-15
- [ ] 61-19-PLAN.md — Anchor width target: the width commit writes the path the open edit names or refuses, with an inert reason in the dialog (G-5, G-8) — wave 3, after 61-15
- [ ] 61-20-PLAN.md — Vector path-edit ledger: one undo entry per completed edit on both success routes, none on failure, and no second writer (G-8) — wave 4, after 61-15


**Spike before the data model is locked**: per-vertex watercolour feasibility (segment runs vs payload extension), the sampling law, seam quality, stroke-count cost, and the determinism pin. The renderer, not the pen tool, is the scope risk.

**Delivery law**: REL-01 holds (no new runtime dependencies). REL-02 applies to every new vector field in both TS and Rust. REL-03 (the motion revision term) is not involved; REL-04 is untouched.

**UI hint**: yes

### Phase 62: Painted-Stroke Curve Editing

**Goal**: Users can reshape an already-painted stroke as a curve, and the change re-bakes correctly everywhere that stroke appears.

**Depends on**: Phase 61 (curve mode reuses the vector editing surface and hit-testing)

**Requirements**: CRV-01, CRV-02, CRV-03, CRV-04

**Success Criteria** (what must be TRUE):
  1. Selecting a painted stroke and entering curve mode fits anchors on entry and edits them with the same surface as the vector tool — no forked editor for "script" versus "vector" strokes.
  2. Committing an anchor or handle edit is one ledger entry and re-bakes from the recovered pre-script base rather than deforming cached pixels — erased regions stay erased and the texture is not re-rolled.
  3. Every loop occurrence of the edited stroke is invalidated together; no stale occurrence keeps the pre-edit pixels.
  4. Undo cancels or settles an in-flight bake and leaves the stroke at its exact pre-edit state.

**Plans**: TBD

**Scope gate**: do not persist Bézier anchors in v1 unless the measured round-trip deviation is visibly unacceptable — that would be a declared schema change, not a detail.

**Delivery law**: REL-01 holds (no new runtime dependencies). No new `.mce` field in the default scope (curve edits are script mutations), so REL-02 applies only if the scope gate opens; REL-04 is untouched.

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 59. Rail Motion Channels & v7 Interface | 25/25 | Complete    | 2026-11-08 |
| 60. Studio Timeline Horizontal Zoom | 6/6 | Complete    | 2026-11-09 |
| 61. Vector Painting Tool | 16/20 | In Progress | - |
| 62. Painted-Stroke Curve Editing | 0/TBD | Not started | - |

**Execution Order:** 59 → 60 → 61 → 62 (global numbering continues; Phase 57 is retired and never reused)
