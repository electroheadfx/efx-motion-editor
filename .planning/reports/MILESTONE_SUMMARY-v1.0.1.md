# Milestone v1.0.1 — Project Summary

**Generated:** 2026-10-14
**Purpose:** Team onboarding and project review
**Milestone:** v1.0.1 Debt Patch Release

---

## 1. Project Overview

**EFX-Motion Editor** is a native macOS stop-motion-to-cinema editor. Users import key photographs, arrange them into timed sequences with FX layers, preview in real time, and export PNG image sequences (optionally muxed to a container with audio). The core value proposition for this milestone was not new features — it was **making the v1.0.0 pipeline trustworthy**: every persisted value must survive save → close → reopen, every export must be frame-accurate, and the release itself must be signed, notarized, and verified.

v1.0.1 is a **quicks-first PATCH milestone** (semver ladder locked 2026-10-12: PATCH for debt, MINOR for features). It delivered 6 debt quicks + 1 inserted phase (53.1 frame-model fix) + a signed GitHub Latest release. There are no multi-phase waves and no `*-VERIFICATION.md` files — release evidence is the user's live UAT verdicts on the signed build, recorded in each quick's SUMMARY and in `53.1-UAT.md`.

**Result:** 13/13 v1 requirements approved. Published as GitHub Latest (tag `v1.0.1` → `ffde6e6a`, signed/notarized DMG SHA256 `b6fcd11f…3058d`, downloaded-artifact verification PASS, stop-conditions 13/13 NOT ACTIVE).

## 2. Architecture & Technical Decisions

- **Dual-language `.mce` law (Quick 2, 261012-d6q):** a `.mce` field must be declared in BOTH the TS interface and the Rust struct.
  - **Why:** `open_project` deserializes through serde, which silently drops any key the Rust struct does not name. TS round-trip tests mock `ipcProjectSave`, so they never cross this boundary. A field declared in one language only is lost on every save → close → reopen.
  - **Phase:** Quick 261012-d6q (video disk-reference law) — discovered while fixing video asset persistence.
  - **Enforcement:** `app/src/lib/mceFieldContract.test.ts` (Quick 261013-fdh) parses both declaration surfaces (Rust `pub struct` fields with `#[serde(rename)]` awareness; TS `export interface` fields) and diffs wire keys per `.mce` member in both directions. One allowlisted asymmetry: `MceSequence.fps` (Rust-only, `#[serde(default)]`, TS retired it in 53.1-01).

- **Video disk-reference law (VID-01..03):** imported video is referenced by absolute `source_path`, never copied into the package; `videos/` provisioning retired.
  - **Why:** an NLE-style package would bloat the project file and violate the user's storage model. Heavy media lives on disk.
  - **Phase:** Quick 261012-d6q.

- **Frame-model fix (Phase 53.1):** bounded physical-frame timing cutover — Law-1..4 / I-1..5, 6 plans.
  - **Why:** the pre-53 frame model leaked logical/physical timing mismatches into playback and export.
  - **Phase:** 53.1-frame-model-fix (inserted phase).

- **Round-trip pin pattern:** every persistence fix carries two pins — the Rust `save→open` round-trip (the serde boundary) and the TS `buildMceProject→hydrateFromMce` round-trip (the emit+hydrate boundary). Together they cover save → serde → hydrate.
  - **Why:** a fix that only patches one side can still lose the value at the other boundary.
  - **Phase:** Quick 261013-fdh (established as standing pattern).

- **Schema bugs close on deterministic pins, not live UAT theater.** A field-drop-hole has a deterministic round-trip proof; no human judgment is needed to observe it.
  - **Why:** live UAT is reserved for cases where only human judgment can render a verdict.
  - **Phase:** Quick 261013-fdh.

- **Release hard rules 10 + 11** (`.claude/skills/efx-motion-release/SKILL.md`):
  - **Why:** the first v1.0.1 publish went out before the audit, which then found a LOOP-persistence blocker; follow-up fixes broke save and introduced a Preact signal cycle. The published Latest was known-broken and had to be deleted. Rule 10 forbids publishing before every fix is landed, UAT'd, and audited. Rule 11 covers delete-and-rerun when a broken release does go out.
  - **Phase:** Release (261012-hw3 + 261013-fdh incident lesson).

- **Stack:** Tauri + Rust backend (`app/src-tauri`), Preact + @preact/signals frontend (`app/src`), vitest (collects `src/**/*.test.ts` only), cargo test --lib, pnpm monorepo. Never React patterns — `efx-preact-reactivity` skill is mandatory for any signal work.

## 3. Phases Delivered

| Unit | Name | Status | One-Liner |
|------|------|--------|-----------|
| Quick 261012-c9a | Display-class save token (SAVE-01..03) | Complete, UAT 2026-10-12 | Display-only background/photo-ref edits persist across save → close → reopen |
| Quick 261012-d6q | Video disk-reference law (VID-01..03) | Complete, UAT 2026-10-12 | Videos referenced by absolute `source_path`; `videos/` provisioning retired; dual-language law discovered |
| Quick 261012-exn | Document-sound decode readiness (SND-01..02) | Complete, UAT 2026-10-12 | Playback/export never silently skip an undecodable clip |
| Quick 261012-kxg | Export video readiness (VID-04) | Complete, UAT 2026-10-13 | Exported frames never bake the video loading placeholder |
| Quick 261013-ctd | Export mux duration law (EXP-01) | Complete, UAT 2026-10-13 | Container audio and video streams share the same (shorter) duration |
| Phase 53.1 | Frame-model fix (Law-1..4 / I-1..5) | Complete, UAT 5/5 2026-10-13 | Bounded physical-frame timing cutover; 6 plans |
| Quick 261013-fdh | Field-drop-hole closure (N1-N4) + TS↔Rust contract | Complete, pinned 2026-10-13 | Four `.mce` drop-holes closed + mechanical dual-language enforcement |
| Quick 261012-hw3 | Release REL-01/REL-02 | Complete, published 2026-10-13 | Version single-source (5 surfaces) + signed/notarized DMG as GitHub Latest |

## 4. Requirements Coverage

All 13 v1 requirements approved (13/13).

- ✅ **SAVE-01**: Display-only background edits (transform/lock) persist across save → close → reopen
- ✅ **SAVE-02**: Display-only photo-reference edits (visible/opacity/transform/lock) persist across save → close → reopen
- ✅ **SAVE-03**: Regression test saves twice (the first save masks the missing token) and fails against the pre-fix token builder
- ✅ **VID-01**: Imported video is referenced by absolute `source_path`, never copied into the package
- ✅ **VID-02**: `.mce` manifest records video assets (`video_assets` on `MceProject`) and reopens from the source path
- ✅ **VID-03**: `videos/` package provisioning retired — no video directory is written
- ✅ **VID-04**: Exported frames never bake the video loading placeholder; video layers await loadeddata and seeked, or the export stops naming the clip
- ✅ **SND-01**: Playback never silently skips a clip whose buffer failed to decode — awaits the decode or refuses with a visible error
- ✅ **SND-02**: Export mix never silently drops a clip — an undecodable clip surfaces a diagnostic instead of a bare `continue`
- ✅ **EXP-01**: The exported container's audio and video streams have the same duration (the shorter one)
- ✅ **MBL-01**: Motion-blur prefs (`enabled`, `shutter_angle`, `preview_quality`, `export_sub_frames`) persist across save → close → reopen (deterministic pin, no UAT gate)
- ✅ **REL-01**: v1.0.1 version single-source across all five surfaces
- ✅ **REL-02**: Signed/notarized DMG published as GitHub Latest via `efx-motion-release` (republished 2026-10-13 after the first publish was deleted as known-broken)

**Audit verdict (run 2, 2026-10-13):** initial status `gaps_found` — 12/12 requirements satisfied but two new blockers of the dual-language drop-hole class (N1 `video_asset_id`, N2 `motion_blur`) plus warnings N3 (`source_overrides`) and N4 (`Sequence.visible`). All four closed by Quick 261013-fdh with round-trip pins; the systemic gap (no field-diff contract) closed by `app/src/lib/mceFieldContract.test.ts`. No gaps remain.

## 5. Key Decisions Log

| ID | Decision | Phase | Rationale |
|----|----------|-------|-----------|
| D-01 | Dual-language declaration law: a `.mce` key exists in the TS interface AND the Rust struct | 261012-d6q | serde silently drops undeclared keys on open; TS mocks never cross the boundary |
| D-02 | Video = disk reference (`source_path`), never in-package | 261012-d6q | heavy media stays on disk; the package is not an NLE container |
| D-03 | Retire `videos/` package provisioning entirely | 261012-d6q | no directory should be written if nothing is stored there |
| D-04 | Physical-frame timing cutover (bounded) | 53.1 | logical/physical timing mismatches leaked into playback and export |
| D-05 | One FIX commit for all four drop-holes (N1-N4) | 261013-fdh | they share one root cause and one fix shape (declare the missing key) |
| D-06 | Contract diffs TS *interfaces* vs Rust *structs*, not call sites | 261013-fdh | the interface IS the emit contract (buildMceProject returns `MceProject`); catches declared-but-not-emitted too |
| D-07 | `MceSequence.fps` is the single allowlisted one-language field | 261013-fdh | Rust keeps `#[serde(default)]` for pre-53.1 manifests; TS retired per-sequence fps |
| D-08 | N4 = TS-side omission, fixed by emitting AND hydrating `Sequence.visible` | 261013-fdh | `visible != null` guard preserves the absent = visible law |
| D-09 | Green tests = done for schema bugs; no live UAT gate | 261013-fdh | deterministic round-trip proof; live UAT is for human-judgment cases only |
| D-10 | Release hard rule 10: never publish before the milestone's fix work is finished, UAT'd, and audited | release skill | v1.0.1 incident: tag/DMG went out before the audit; the published Latest was known-broken and deleted |
| D-11 | Release hard rule 11: a known-broken release gets deleted and the whole sequence re-runs | release skill | no patch-forward on a published artifact; `Latest` reverts until the new publish |

## 6. Tech Debt & Deferred Items

**Closed during the milestone:**
- N1 `video_asset_id` drop-hole → declared on Rust `MceLayerSource` (261013-fdh)
- N2 `motion_blur` drop-hole → declared on Rust `MceProject` + `MceMotionBlur` in both languages (261013-fdh)
- N3 `source_overrides` drop-hole → declared on Rust `MceKeyframeValues` (261013-fdh)
- N4 `Sequence.visible` TS-side omission → emitted and hydrated in `projectStore` (261013-fdh)
- Systemic dual-language enforcement → `app/src/lib/mceFieldContract.test.ts` (261013-fdh)

**Deferred / noted (not release blockers):**
- **Nyquist coverage TODO:** `workflow.nyquist_validation=true` and the validate-phase step hook are active, but no `*-VALIDATION.md` exists for 53.1. Classification: MISSING (coverage TODO — `/gsd-validate-phase 53.1` parked by user decision). Not a compliance failure.
- **No `*-VERIFICATION.md` files** (quicks-first milestone). Evidence lives in quick SUMMARYs + user UAT verdicts + REQUIREMENTS.md approvals. The audit's phase-VERIFICATION.md cross-reference source is structurally absent — a process note, not a product gap.
- **Audit order (house rule):** the first audit ran after tag/publish. Rule 10 now forbids that order for future milestones.
- **v2 backlog:** FEAT-01 (v1.1.0 phases 54-57: Preact 11 bump, `efx-paint-host`, `efx-watercolor`, `efx-spectral`), paper pack, paint-krita / engine-1 spectral (v1.2.0), AI features (v1.3.0). Any `.mce` schema evolution is out of scope for PATCH releases.

## 7. Getting Started

- **Run the project:** `pnpm --dir app install && pnpm --dir app tauri dev` (the user runs the server themselves — never start it unprompted).
- **Tests:** `pnpm --dir app vitest run` (never watch mode) and `cargo test --lib` in `app/src-tauri`.
- **Key directories:**
  - `app/src/` — Preact frontend (stores in `app/src/stores/`, types in `app/src/types/`)
  - `app/src-tauri/` — Rust backend (`models/project.rs` is the `.mce` serde surface, `services/project_io.rs` is save/open)
  - `app/src/lib/mceFieldContract.test.ts` — the TS↔Rust field-diff contract (start here to understand the `.mce` format law)
  - `.claude/skills/efx-motion-release/SKILL.md` — release sequence + hard rules
- **Where to look first:**
  - `app/src/stores/projectStore.ts` — `buildMceProject` (emit) and `hydrateFromMce` (hydrate) are the two halves of every persistence path
  - `app/src-tauri/src/models/project.rs` — every Rust `Mce*` struct; a key missing here is dropped on open
  - `.planning/REQUIREMENTS.md` — the 13 v1 requirements and their traceability

---

## Stats

- **Timeline:** 2026-10-11 → 2026-10-13 (3 days)
- **Units delivered:** 8/8 (7 quicks + phase 53.1)
- **Requirements:** 13/13 approved
- **Commits:** 100 (v1.0.0..v1.0.1)
- **Files changed:** 700 (+15,893 / −1,548)
- **Contributors:** Laurent Marques
- **Gates (final):** vitest 4915 passed / 269 files · cargo 68/68 · typecheck · build · bash -n · preflight · releaseContract 11/11
- **Release:** GitHub Latest `v1.0.1` → `ffde6e6a`, signed/notarized DMG SHA256 `b6fcd11f…3058d`, downloaded-artifact PASS
