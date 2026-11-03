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
- ◆ **v2.0.1 Rail Editing & v7 Timeline Rails (PATCH)** — Phase 58 + in-milestone v7 quick (in progress)

## Phases

### Phase 58: Rail editing regressions

**Goal**: A normal Key Rail becomes a Standard cycle through the existing Edit Rail flow, and a single key on a Motion/Static/Reveal rail can be dragged to choose its spacing — without silently relaxing linked-cycle ownership.
**Depends on**: Nothing (first phase of v2.0.1)
**Requirements**: RAIL-01, RAIL-02, RAIL-03, RAIL-04, RAIL-05, RAIL-06, RAIL-07
**Success Criteria** (what must be TRUE):
  1. Selecting (or double-clicking) a normal Key Rail exposes the sidebar's Edit Rail action; the modal shows only the cycle count and the Infinity checkbox, prefilled at 1.
  2. Confirming converts the Key Rail segment into a provenance-free Standard loop clip (`sourceKeyIds` = the segment's keys in frame order, `placementStart` = the first key, no `scriptId`/`railKind`/`motion`); the rail presents as a Standard cycle via the existing `.rail-kind-standard` gray pill, and the existing Edit Rail dialog owns Repeat/Infinity afterwards. (Per D-10, per-frame cells, cycle grays, and the rail colour dot belong to the v7 quick, not Phase 58.)
  3. Cancel performs zero writes; the conversion is exactly one undo step (Undo restores the Key Rail, Redo re-applies it).
  4. A single-key drag moves the key on Motion/Static/Reveal rails under Law A (chosen at discuss-phase, D-12: exactly one referencing loop = independent cycle; shared linked cycles keep D-11 and the locked rigid-group copy). A key referenced by more than one loop never moves silently.
  5. No `.mce` schema field is added or changed; resolver, undo and existing D-11 guard tests are green (or deliberately updated to the chosen law).

**Discuss-phase gate**: choose the drag law A / B / C before planning — A preferred (independent single-reference cycle); B = unlink + whole-cycle Force Spacing; C = propagate the retime to every linked loop.

**Code anchors**: `roto/physicsPaintRotoPhysicalResolver.ts` (~4463-4467, the D-11 `countLoopsReferencingSourceKey` guard and `buildMoveCandidate`); `view/PhysicsPaintScriptsPanel.tsx` + `PhysicsPaintStudio.tsx` `handleOpenRotoLoopEdit` + `physicsPaintRotoPlayScriptController.ts` `openLoopEdit` (today loop-clip only); `roto/physicsPaintRotoRunScriptStacking.ts` `isStandardMergedLoopClip` / `buildStandardStackedLoopClip` (provenance-free Standard shape); `view/PhysicsPaintWorkflowStrip.tsx` (Create rail / key-rail segment).

**Plans:** 5 plans
**Wave 1**
- [ ] 58-01-PLAN.md — Law A: relax the single-key move guard to exactly one referencing loop
- [ ] 58-02-PLAN.md — Key Rail segment to Standard cycle conversion (record shape, gaps, publication, undo)
- [ ] 58-03-PLAN.md — Selected Key Rail inspector, Edit Rail action, double-click/Enter entry surfaces

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 58-04-PLAN.md — Reduced conversion dialog (Cycle + Infinity only, Create Cycle / Update Rail)
- [ ] 58-05-PLAN.md — Studio wiring: stable inspector projection, Edit Rail/double-click handlers, right-panel memo

### v7 timeline rails (in-milestone quick)

**Goal**: Apply the approved v7 rail interface to the real Studio timeline without motion channels.
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06, VIS-07, VIS-08
**Build prompt**: `SPECS/v2.0.1-timeline-rails/GSD-QUICK-PROMPT.md` (locked README + `TIMELINE-RAILS.tsx` + `timeline-rails.css`; all 8 README §7 defaults).
**Delivery**: `/gsd-quick` inside v2.0.1 — never a standalone quick. Motion channels stay in v2.1.0.
**Plans**: quick (pending)

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 58. Rail editing regressions | 0/5 | Pending | — |
| v7 timeline rails (in-milestone quick) | — | Pending | — |

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

See milestones/v1.0.0-ROADMAP.md for full phase details.

</details>

<details>
<summary>✅ v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity (Phases 39-44) — SHIPPED 2026-08-21</summary>

See milestones/v0.9.0-ROADMAP.md for full phase details.

</details>

<details>
<summary>✅ v0.8.0 Standalone Physics Paint (Phases 34-38.1) — SHIPPED 2026-08-01</summary>

See milestones/v0.8.0-ROADMAP.md for full phase details.

</details>

---

## Next Milestone

**v2.0.1 is active.** Execution order: Phase 58 (rail-editing regressions) → the in-milestone v7 timeline-rails quick → release through `efx-motion-release` (audit BEFORE tag/publish). Global phase numbering continues at Phase 58; Phase 57 was retired (spectral shipped inside Phase 56) and is never reused.
