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

**v2.0.1 is shipped** — GitHub Latest on 2026-11-05, tag `v2.0.1` → `49b5f7e57`, signed/notarized DMG with downloaded-artifact verification PASS. The next milestone is not yet opened. **v2.1.0 (Motion channels)** is the planned shape per `SPECS/v2.1.0-motion-channels/` — Position/Rotation/Opacity lanes, curves, nav cluster, and the selected-rail rounded outline on top of the v7 rail surface shipped here; it is a Phase 59 candidate, not yet inserted. Global phase numbering continues at Phase 59; Phase 57 was retired (spectral shipped inside Phase 56) and is never reused.
