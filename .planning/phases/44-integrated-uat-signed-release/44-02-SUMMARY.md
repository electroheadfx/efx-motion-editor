---
phase: 44-integrated-uat-signed-release
plan: 02
subsystem: release
tags: [tauri, macos, release, uat, notarization, apple, signed-artifact, gatekeeper]

# Dependency graph
requires:
  - phase: 44-01 (v0.9.0 pre-release gates)
    provides: five 0.9.0 version surfaces, stale v0.8.1 bundles archived, six REL-01 gates green, recorded divergences
provides:
  - user-reported RELEASE PASS ledger (44-RELEASE.md) — app/DMG notarization Accepted, stapler PASS
  - signed-app UAT evidence (44-UAT.md) — all 17 spec steps PASS + Phase 43 signed-artifact boundary + two recorded divergences
  - freshness evidence by inner-binary mtime (D-05, Pitfall 3)
affects:
  - 44-03 (release + publish consumes the signed artifact and the UAT pass)
  - 44-VALIDATION, verify-work (UAT evidence sampling)

# Actuals (#2632) — pairs with the plan's estimate (25000 tokens) to calibrate future estimates.
actuals:
  tokens: 4300    # chars/4 over the realized diff (44-RELEASE.md 5288B + 44-UAT.md 5924B + 44-02-SUMMARY.md ~6KB)
  tasks: 2        # tasks completed (both checkpoints, user-run)
  commits: 4      # commits made (c3c41328, 8288d2d7, d92a3ebd + final docs commit)

# Tech tracking
tech-stack:
  added: []       # zero packages installed this phase
  patterns:
    - "Credential-isolated release handoff: the ONE credentialed step runs through the user-owned efx-release-efx-motion wrapper (mode 700, trap-unset); credentials never enter the repo or agent context (D-04)"
    - "Freshness by inner-binary mtime: the signed artifact is judged by bundle/macos/*.app + Contents/MacOS/efx-motion-editor timestamps, never bundle/dmg/ (D-05, Pitfall 3)"

key-files:
  created:
    - .planning/phases/44-integrated-uat-signed-release/44-RELEASE.md
    - .planning/phases/44-integrated-uat-signed-release/44-UAT.md
  modified: []    # no functional source file changed (D-09)

key-decisions:
  - "Truncation label judged against the shipped English copy in the signed-app UAT; French spec label recorded as known divergence, no code change (D-09)"
  - "Chunk budget judged against the shipped 1120 budget; spec-1100 recorded as known divergence (Pitfall 6)"
  - "Phase 43 signed-artifact boundary covered as first-class UAT step 17 — valid linked-loop preview/export parity AND unresolved-loop export block (D-02, never dropped)"
  - "Freshness judged by inner-binary mtime, never bundle/dmg/ timestamps (D-05, Pitfall 3)"

patterns-established:
  - "User-reported release ledger: RELEASE PASS + notarization Accepted + stapler PASS recorded verbatim from the wrapper output, then agent-verified freshness/notarization evidence appended"
  - "One comprehensive UAT pass (D-01): all 17 spec steps walked in sequence in the packaged app; a failing step is re-runnable in isolation"

requirements-completed: [REL-01, REL-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "User-run credentialed signed release (D-04 wrapper) — RELEASE PASS ledger, app/DMG notarization Accepted, stapler PASS, freshness by inner-binary mtime"
    requirement: REL-02
    verification: []
    human_judgment: true
    rationale: "The credentialed release run is user-owned by design (D-04); the ledger is user-reported and the freshness/notarization evidence is agent-verified, but the release itself cannot be automated from the agent session"
  - id: D2
    description: "Comprehensive signed packaged-app UAT — all 17 spec steps pass in the packaged v0.9.0 app in one pass (D-01)"
    requirement: REL-02
    verification: []
    human_judgment: true
    rationale: "Native packaged-app UAT is the user's oracle; visual/functional acceptance of the signed artifact requires human judgment"
  - id: D3
    description: "Phase 43 signed-artifact boundary (step 17) — valid linked-loop preview/export parity AND unresolved-loop export block verified on the signed artifact (D-02, never dropped)"
    requirement: REL-02
    verification: []
    human_judgment: true
    rationale: "Preview/export parity and the unresolved-loop export block are visual/functional behaviors judged in the packaged app per 43-UAT.md §16/§11"
  - id: D4
    description: "Two spec-vs-implementation divergences recorded in 44-UAT.md, not fixed (D-09) — truncation label French-vs-English, chunk budget 1100-vs-1120"
    verification:
      - kind: manual_procedural
        ref: "grep -E '^\\| [12] \\| (Truncation label|Chunk budget)' .planning/phases/44-integrated-uat-signed-release/44-UAT.md -> 2 recorded divergence rows (lines 61-62)"
        status: pass
    human_judgment: false

# Metrics
duration: 50min
completed: 2026-08-21
status: complete
---

# Phase 44 Plan 2: Signed Packaged-App UAT + Credentialed Release Summary

**User-run credentialed v0.9.0 release (RELEASE PASS, notarization Accepted, stapler PASS) and comprehensive signed packaged-app UAT — all 17 spec steps pass in the packaged app, including the Phase 43 signed-artifact boundary, with the two spec divergences recorded, not fixed**

## Performance

- **Duration:** 50 min
- **Started:** 2026-08-21T10:07:08Z (Task 1 preconditions recorded)
- **Completed:** 2026-08-21T10:50:43Z
- **Tasks:** 2 (both checkpoints — user-run release + user-approved UAT)
- **Files modified:** 0 functional source files (D-09); 2 evidence records created

## Accomplishments

- **Credentialed signed release (D-04):** the user ran `~/.config/efx/scripts/efx-release-efx-motion` from a terminal at the repo root; the wrapper sourced the trusted Apple environment file, validated the four credential vars, ran `bash scripts/macos-release.sh release`, and trap-unset every variable. User-reported ledger recorded in 44-RELEASE.md: **RELEASE PASS**, app notarization **Accepted** (`source=Notarized Developer ID`), DMG notarization **Accepted**, app stapler **PASS**, DMG stapler **PASS**. Credentials never entered the repo, project files, or agent context.
- **Freshness evidence (D-05, Pitfall 3):** inner binary `Contents/MacOS/efx-motion-editor` mtime **Aug 21 12:30:58 2026** and `.app` dir mtime **Aug 21 12:30:57 2026** both postdate the release run; exactly one `EFX Motion Editor_0.9.0_aarch64.dmg` (15.7 MB); notarization evidence `Accepted` under `bundle/dmg/notarization-evidence/` (`dmg-log.json` statusCode 0, `dmg-submit.json` id `2b2a37f1-108f-4daa-8be6-02322fe63d61`).
- **Comprehensive signed packaged-app UAT (REL-02, D-01):** all **17 spec steps PASS** in the packaged v0.9.0 app in one comprehensive pass (user-approved). Step 12 asserts the shipped English label `Loop shortened by next clip`; step 17 covers the **Phase 43 signed-artifact boundary (D-02, never dropped)** — (a) valid linked-loop preview/export parity per 43-UAT.md §16 (export frame count/order matches preview, deterministic Progressive/Static/Hold cadence, Infinity stops at parent end, truncation stops at canonical next boundary, no blank/unresolved exported frame, durable assets proportional to source cycles) AND (b) the unresolved-loop export block per 43-UAT.md §11 (`Loop source missing` marks preview, export fails before partial output with actionable copy, unrepaired save/reopen preserves the record verbatim).
- **Two spec-vs-implementation divergences recorded, not fixed (D-09):** truncation label French-spec `Boucle raccourcie par le clip suivant` vs shipped English `Loop shortened by next clip`; chunk budget spec-1100 vs shipped-1120 (`viteBuild.test.ts:138`). Both recorded in 44-UAT.md and judged against the shipped values.
- **No functional source file changed** — this is a release/verification plan (D-09).

## Task Commits

Each task was committed atomically:

1. **Task 1 (checkpoint:human-action): Credentialed signed release via efx-release-efx-motion (user-run) + freshness evidence** - `c3c41328` (docs: pre-release preconditions), `8288d2d7` (docs: user-reported RELEASE PASS ledger + freshness/notarization evidence)
2. **Task 2 (checkpoint:human-verify): Comprehensive signed packaged-app UAT — spec steps 1-17 + Phase 43 signed-artifact boundary** - `d92a3ebd` (docs: signed packaged-app UAT pass matrix 17/17 + divergences)

**Plan metadata:** `pending final docs commit`

## Files Created/Modified

- `.planning/phases/44-integrated-uat-signed-release/44-RELEASE.md` - user-reported release ledger: preconditions, RELEASE PASS, notarization Accepted, stapler PASS, freshness evidence, notarization evidence (new)
- `.planning/phases/44-integrated-uat-signed-release/44-UAT.md` - signed-app UAT evidence: 17-step pass/fail matrix, step 12 divergence, step 17 Phase 43 boundary, two recorded divergences, user approval (new)

## Decisions Made

- **Truncation label judged against the shipped English copy** in the signed-app UAT; the French spec label is a recorded divergence, not a regression (D-09, Pitfall 5). No code change.
- **Chunk budget judged against the shipped 1120** (`viteBuild.test.ts:138`); spec-1100 recorded as known divergence (Pitfall 6). No code change.
- **Phase 43 signed-artifact boundary is a first-class UAT step (17)** — both valid linked-loop preview/export parity AND the unresolved-loop export block verified on the signed artifact (D-02, never silently dropped).
- **Freshness judged by inner-binary mtime** (D-05, Pitfall 3) — never by `bundle/dmg/` timestamps, which can hold stale DMGs.

## Deviations from Plan

None - plan executed exactly as written. Both tasks were user-run checkpoints (release + UAT) that completed with the user's approval; the agent recorded the evidence and verified freshness/notarization facts.

## Issues Encountered

- **Path discrepancy (noted, not a defect):** the plan and RESEARCH.md state the notarization evidence lives at `app/src-tauri/target/dmg/notarization-evidence/`; the actual evidence is at `app/src-tauri/target/release/bundle/dmg/notarization-evidence/` (the release script writes it beside the built DMG). The evidence exists and is complete — only the documented path differs. Recorded in 44-RELEASE.md.

## User Setup Required

None - no external service configuration required. The credentialed release ran through the user-owned `efx-release-efx-motion` wrapper (D-04); credentials never entered the repo or agent context.

## Next Phase Readiness

- **Plan 03 (release + publish):** the signed/notarized/stapled v0.9.0 artifact exists and is fresh by inner-binary mtime; the comprehensive packaged-app UAT passed all 17 steps; the Phase 43 signed-artifact boundary is verified on the signed artifact. Ready to draft the release, verify the downloaded artifact, install/launch, run the stop-condition checklist, and publish as GitHub Latest.
- REL-01 is shared with plan 01; both SUMMARYs now exist, so the shared-ID gate clears and REL-01/REL-02 can mark complete.

---
*Phase: 44-integrated-uat-signed-release*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `.planning/phases/44-integrated-uat-signed-release/44-02-SUMMARY.md`
- FOUND: `.planning/phases/44-integrated-uat-signed-release/44-UAT.md` (17-step pass matrix + divergences)
- FOUND: `.planning/phases/44-integrated-uat-signed-release/44-RELEASE.md` (RELEASE PASS ledger + freshness evidence)
- FOUND: commit `c3c41328` (pre-release preconditions)
- FOUND: commit `8288d2d7` (RELEASE PASS ledger + freshness/notarization evidence)
- FOUND: commit `d92a3ebd` (UAT pass matrix 17/17 + divergences)
- FOUND: divergence table rows 1-2 in 44-UAT.md (lines 61-62)
