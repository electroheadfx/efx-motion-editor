---
phase: 45-new-efx-paint-document-and-clean-cutover
plan: 08
subsystem: testing/uat
tags: [efx-paint, native-uat, v1.0-document, D-10, D-11, D-12, DOC-01, DOC-02, DOC-03, DOC-05, DOC-06]

# Dependency graph
requires:
  - phase: 45-05
    provides: single v1.0 open/save funnel, parse-time rejection gate with blocking no-recourse dialog, layer-creation document registration, version 16 project files
  - phase: 45-06
    provides: full SerializedProject/isSerializedProject consumer sweep, v1.0 session-file/launch/engine format
  - phase: 45-07
    provides: DOC-04 mechanically proven (legacy surface hard-deleted, grep contract green), main-editor boundary byte-untouched (DOC-06)
provides:
  - "Human-confirmed 4-part D-10 native UAT: v1.0 document creation with stroke on the default track, save/reopen identity persistence + on-disk D-11 evidence, explicit no-recourse legacy rejection on a real v0.9 project copy, and main-editor parity — the user-facing acceptance bar for DOC-01/DOC-02/DOC-03/DOC-05/DOC-06"
affects: [45-verify, 45-seal, milestone v1.0.0 release (Phase 53)]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 3500
  tasks: 1
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-Rust-struct-serde-carrier, recents-registration-for-fresh-save, capability-scope-vs-cache-repoint-cochange]

key-files:
  created:
    - .planning/phases/45-new-efx-paint-document-and-clean-cutover/45-08-SUMMARY.md
  modified:
    - app/src-tauri/src/models/project.rs (via b6629984 in 45-06 fix)
    - app/src/stores/projectStore.ts (via 2c949f18 in 45-05 fix)
    - app/src-tauri/capabilities (via 10da700a in 45-02 fix)

key-decisions:
  - "A v1.0 native UAT failure is a hard stop: each D-10 part that regressed was fixed with a dedicated fix commit (and a regression test) and re-verified by the user before the part was recorded as PASS — never worked around"
  - "The on-disk saved .mce is the D-11 evidence surface (no throwaway Studio indicator UI), per the locked contract"

patterns-established:
  - "Shared-Rust-struct-launch-carrier: a field introduced only on the TS side of a Tauri launch payload must also be added to the Rust serde struct, or serde drops the carrier at the boundary and the child silently falls back to launchContext-null defaults"
  - "Recents-registration-for-fresh-saves: saveProjectAs must register Recents for a project with no prior filePath, not early-return (a fresh project is otherwise never listed in Recent Projects)"
  - "Capability-scope-vs-cache-repoint-fix: when the cache dir is re-pointed, the Tauri capability fs scope must be widened in lockstep or allow-mkdir for the new staging dir is forbidden"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-05, DOC-06]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
# This is a verification-only plan; each deliverable is a D-10 UAT part that only a native human run can prove.
coverage:
  - id: D1
    description: "UAT part 1 (document creation): new project + add EFX Physic Paint layer → Studio opens on a v1.0 document; user paints a stroke on the default track; full frame range from parent duration; project fps correct; background unchanged (D-10)"
    requirement: DOC-01
    verification:
      - kind: manual_procedural
        ref: "User native run — new project, EFX Physic Paint layer, Studio opens on v1.0 document, stroke painted on default track, frame range/fps/background confirmed"
        status: pass
    human_judgment: true
    rationale: "Only a native app run on the user's machine can prove Studio opens on the v1.0 document and the painted stroke lands on the default track; automation cannot observe the launched window."
  - id: D2
    description: "UAT part 2 (save/reopen + D-11 evidence): stroke persists across save/quit/reopen; on-disk .mce contains efx_paint_documents with version 1, parentLayerId matching the layer, documentRevision, activeTrackId = default track ID, one Paint track, one Background track with transparent fallback; no legacy keys; project listed in Recent Projects (D-10, D-11)"
    requirement: DOC-05
    verification:
      - kind: manual_procedural
        ref: "User save → quit → reopen: stroke present; Recent Projects lists the project"
        status: pass
      - kind: manual_procedural
        ref: "On-disk .mce inspected with the user: efx_paint_documents present with the full D-11 field list, no legacy keys"
        status: pass
    human_judgment: true
    rationale: "D-11 mandates the saved project file + observable behavior as evidence — no Studio indicator UI; the on-disk inspection and the reopen behavior require native confirmation."
  - id: D3
    description: "UAT part 3 (legacy rejection): opening a COPY of a real v0.9-era Physic Paint project shows the explicit no-recourse rejection dialog; nothing opens or mutates; the original file is byte-untouched (D-10, D-12, D-05)"
    requirement: DOC-03
    verification:
      - kind: manual_procedural
        ref: "User points at a real v0.9-era Physic Paint project; a copy is opened; explicit rejection dialog observed; original untouched"
        status: pass
    human_judgment: true
    rationale: "D-12 requires real-world pre-v1.0 data and a human to observe the blocking no-recourse dialog and confirm the original is never mutated; synthetic fixtures cannot prove it."
  - id: D4
    description: "UAT part 4 (main-editor parity): in a v1.0 project with ordinary content, main-editor sequence timing, outer layer composition, and inline EFX Paint layers behave exactly as before (D-10, DOC-06)"
    requirement: DOC-06
    verification:
      - kind: manual_procedural
        ref: "User native run: sequence timing, outer layers, inline EFX Paint layers unchanged"
        status: pass
    human_judgment: true
    rationale: "Only native comparison against prior behavior can prove the inline EFX Paint layer and main-editor composition are unchanged; complements 45-07's diff gate with human evidence."
  - id: D5
    description: "Save/reopen preserves full document/track/cache identity: version 1, parentLayerId, documentRevision, activeTrackId equal to the default track ID, one Paint track + one Background track with transparent fallback, no legacy keys written (D-10, D-11)"
    requirement: DOC-05
    verification:
      - kind: manual_procedural
        ref: "On-disk .mce field-by-field match per D-11 with the user"
        status: pass
    human_judgment: true
    rationale: "Document identity preservation across save/reopen is verified by inspecting the saved .mce with the user — a human-evidence check per the D-11 contract."

# Metrics
duration: 30min
completed: 2026-08-23
status: complete
---

# Phase 45: New EFX Paint Document and Clean Cutover — Plan 08 Summary

**Native 4-part D-10 UAT passed for the v1.0 EFX Paint document cutover — frame range, fps, background, save/reopen D-11 evidence, legacy rejection, main-editor parity all confirmed by the user**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-23T18:20:00Z
- **Completed:** 2026-08-23T18:50:00Z
- **Tasks:** 1
- **Files modified:** 1 created in this plan (production fixes were committed under their owning plans 45-02/45-05/45-06)

## Accomplishments

- **PART 1 (document creation): PASS** — New project + EFX Physic Paint layer opens Studio on a v1.0 document; a stroke painted on the default track renders with the full frame range from the parent duration; project fps correct; background unchanged. (Initially failed with regressions R1–R3; all auto-fixed — see Deviations.)
- **PART 2 (save/reopen + D-11 evidence): PASS** — Stroke persists across save/quit/reopen; the on-disk `.mce` contains `efx_paint_documents` with version 1, `parentLayerId` matching the layer, `documentRevision`, `activeTrackId` equal to the single default track's ID, exactly one Paint track, one Background track with transparent fallback, and **no legacy keys**; the project appears in Recent Projects. (Initially blocked by a save failure; auto-fixed — see Deviations.)
- **PART 3 (legacy rejection): PASS** — Opening a COPY of a real v0.9-era Physic Paint project shows the explicit no-recourse rejection dialog; nothing opens or mutates; the original file is byte-untouched (D-12 honored).
- **PART 4 (main-editor parity): PASS** — Sequence timing, outer layer composition, and inline EFX Paint layers behave exactly as before (DOC-06).
- **All automated gates green** at confirmation: vitest full suite (2710 tests), app typecheck, cargo test (39), and build — verifying the three fix commits.

## Task Commits

1. **Task 1: D-10 four-part native UAT (blocking checkpoint)** - fix commits landed during UAT: `b6629984` (Rust struct carrier), `2c949f18` (Recents), `10da700a` (capability scope) — see Deviations.

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified

- `.planning/phases/45-new-efx-paint-document-and-clean-cutover/45-08-SUMMARY.md` - created: 4-part native UAT pass record with D-10/D-11/D-12 evidence.
- (The three fix commits below modified production files under their owning plans' phases.)

## Decisions Made

- **Any D-10 part that regressed is a hard stop-signal, not a workaround**: R1/R2/R3 and R4 were each fixed with a dedicated fix commit + regression test and re-confirmed by the user before that part closed as PASS.
- **The on-disk `.mce` is the D-11 evidence surface**: no throwaway Studio indicator UI was built (per the locked D-11 contract); save/reopen identity was verified by inspecting the saved file plus observable behavior.
- **The rejection UAT uses a real v0.9-era project copy** (D-12): the original is never opened or mutated by the app or the tester.

## Deviations from Plan

Three native UAT parts (R1–R3) initially failed, each with a shared root cause, plus one save-flow regression (R4). All were auto-fixed via dedicated fix commits and verified by the full gate set (vitest 2710 + cargo 39 + typecheck + build).

### Auto-fixed Issues

**1. [Blocking] Rust `PhysicsPaintLaunchContext` struct lacked the v1.0 `document` field — child fell back to launchContext-null defaults (R1/R2/R3)**
- **Found during:** Task 1 (UAT part 1)
- **Issue:** R1 — Studio frame capacity collapsed to frame 0; R2 — Studio fps fell back to 12; R3 — Studio background texture changed. Shared root cause: commit `e55e7797` added the `document` field only on the TypeScript side of the Tauri bridge, but the Rust `PhysicsPaintLaunchContext` struct did not carry it, so serde dropped the carrier at the boundary and the child stayed on the launchContext-null fallbacks.
- **Fix:** Added `document: Option<Value>` to the Rust struct plus a regression test (commit `b6629984`, under 45-06).
- **Files modified:** `app/src-tauri/src/models/` (launch-context struct)
- **Verification:** vitest + cargo test green; user re-confirmed part 1 PASS (capacity, fps 25, background unchanged).
- **Committed in:** `b6629984`

**2. [Blocking - save flow] `saveProjectAs` never registered Recents for a fresh project (R4)**
- **Cause:** The new save path early-returns when there is no prior filePath, so a fresh project's first save never registered Recents — the project was not listed in Recent Projects (part 2 evidence).
- **Fix:** `saveProjectAs` now registers Recents for a fresh project (`2c949f18`, under 45-05).
- **Files modified:** `app/src/lib/` (project save flow)
- **Verification:** user re-confirmed part 2 PASS (Recents lists the project).
- **Committed in:** `2c949f18`

**3. [Blocking - capability scope] Save-blocking: Tauri fs capability still allowed only legacy cache/physic-paint paths**
- **Cause:** The 45-02 cache re-point renamed the cache to `cache/efx-paint` and staging to `.efx-paint-staging-`, but the Tauri capability fs scope still allowed only the legacy `cache/physic-paint` paths, so `allow-mkdir` for the new staging directory was forbidden and the save was blocked.
- **Fix:** Widened the Tauri capability fs scope to the v1.0 efx-paint cache/staging paths (`10da700a`, under 45-02).
- **Files modified:** `app/src-tauri/capabilities/`
- **Verification:** `cargo test` + build green; save/reopen re-confirmed PASS.
- **Committed in:** `10da700a`

---

**Total deviations:** 3 auto-fixed (1 shared root cause across R1–R3, 1 save-flow, 1 capability-scope)
**Impact on plan:** All fixes were necessary for the v1.0 cutover to be correct — they complete the document-carrier, Recents, and cache-path cutover. No scope creep; the D-10 protocol and deliverables are unchanged.

## Issues Encountered

- The three R1/R2/R3 regressions shared a single root cause that was non-obvious at runtime (silent launchContext-null fallback): the serde drop at the Tauri boundary. It was diagnosed by correlating all three symptoms to the missing Rust struct field rather than treating each as independent.
- R4 (Recents) and the save-blocking capability scope were two distinct save-flow failures that surfaced sequentially during part 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 45 is fully verified** : all 8 plans complete, all DOC-01..DOC-06 requirements confirmed (DOC-04 by 45-07's grep contract, the rest by this 4-part native UAT).
- The phase is ready for the post-waves aggregate step, code review, phase-goal verify, and final seal.
- Phase 45-08 closes the last blocking checkpoint; Phase 46 (track-local state) is unblocked, as are the post-phase roadmap updates.

---
*Phase: 45-new-efx-paint-document-and-clean-cutover*
*Completed: 2026-08-23*
