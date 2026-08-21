---
phase: 44-integrated-uat-signed-release
plan: 03
subsystem: release
tags: [tauri, macos, release, github, gh, publish, stop-conditions, verify-downloaded, dmg, latest]

# Dependency graph
requires:
  - phase: 44-02 (signed packaged-app UAT + credentialed release)
    provides: signed/notarized/stapled v0.9.0 DMG + 17/17 signed-app UAT pass + Phase 43 boundary verified
provides:
  - GitHub draft release v0.9.0 created with the DMG attached (draft-first protection)
  - downloaded-artifact evidence (44-VERIFY-DOWNLOADED.md) — DOWNLOADED ARTIFACT PASS + install/launch confirmed on a SEPARATE download (REL-03, D-05)
  - stop-condition hard-gate record (44-STOP-CONDITIONS.md) — all 15 "do not publish if" items NOT ACTIVE with evidence sources (D-07)
  - v0.9.0 published as GitHub Latest with DMG asset, v0.8.1 superseded (A4)
affects:
  - 44-VALIDATION, verify-work (REL-03 evidence sampling)
  - milestone close / gsd-complete-milestone (v0.9.0 published)

# Actuals (#2632) — pairs with the plan's estimate (20000 tokens) to calibrate future estimates.
actuals:
  tokens: 4300    # chars/4 over the realized diff (44-VERIFY-DOWNLOADED.md 4897B + 44-STOP-CONDITIONS.md 6652B + 44-03-SUMMARY.md ~6KB)
  tasks: 3        # tasks completed (draft+upload, verify-downloaded+install/launch, stop-condition checklist+publish)
  commits: 5      # commits made (e1e87bac, 228684b2, 63b9d00a, c9726c6c + final docs commit)

# Tech tracking
tech-stack:
  added: []       # zero packages installed this phase
  patterns:
    - "Draft-first publication: gh release create --draft -> verify-downloaded on a SEPARATE download -> install/launch -> stop-condition checklist -> gh release edit --latest (draft state protects against premature publication; D-06 ordering)"
    - "GitHub API /releases/latest is the canonical Latest probe when the installed gh version lacks the isLatest JSON field (verified tag_name == v0.9.0)"

key-files:
  created:
    - .planning/phases/44-integrated-uat-signed-release/44-VERIFY-DOWNLOADED.md
    - .planning/phases/44-integrated-uat-signed-release/44-STOP-CONDITIONS.md
  modified: []    # no functional source file changed (release/verification plan)

key-decisions:
  - "Publish v0.9.0 as GitHub Latest — explicit user decision ('publish') after all 15 stop conditions recorded NOT ACTIVE and DOWNLOADED ARTIFACT PASS (REL-03)"
  - "Publish sequence adjusted: gh release edit v0.9.0 --draft=false first, then --latest (GitHub API rejects make_latest on a draft with HTTP 422; the two-step flow reaches the identical plan acceptance criteria)"
  - "Latest verified via GitHub API /releases/latest -> v0.9.0 and gh release list v0.9.0 latest=true (installed gh 2.97.0 lacks the isLatest JSON field on release view)"

patterns-established:
  - "Stop-condition checklist is the audit trail, separate from the UAT pass: each 'do not publish if' item individually recorded NOT ACTIVE with its evidence source before the one-way publish (D-07)"

requirements-completed: [REL-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "GitHub draft release v0.9.0 created with the DMG attached — draft=true, asset EFX.Motion.Editor_0.9.0_aarch64.dmg (REL-03)"
    requirement: REL-03
    verification:
      - kind: manual_procedural
        ref: "gh release view v0.9.0 --json isDraft,assets -> {isDraft:true, assets:[EFX.Motion.Editor_0.9.0_aarch64.dmg]} (recorded in 44-VERIFY-DOWNLOADED.md)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Downloaded-artifact verification on a SEPARATE download (D-05): verify-downloaded -> DOWNLOADED ARTIFACT PASS + user install into Applications + NORMAL launch without Gatekeeper bypass (REL-03)"
    requirement: REL-03
    verification:
      - kind: manual_procedural
        ref: "bash scripts/macos-release.sh verify-downloaded <downloaded.dmg> -> DOWNLOADED ARTIFACT PASS (verbatim output in 44-VERIFY-DOWNLOADED.md §5.1)"
        status: pass
    human_judgment: true
    rationale: "The normal visible launch and icon verification are the user's oracle on the downloaded artifact (D-05); the agent runs the credential-free verify-downloaded and records the user's launch confirmation"
  - id: D3
    description: "Stop-condition hard-gate checklist (D-07): all 15 'do not publish if' items recorded NOT ACTIVE with evidence sources before publish (REL-03)"
    requirement: REL-03
    verification:
      - kind: manual_procedural
        ref: "grep -c 'NOT ACTIVE' .planning/phases/44-integrated-uat-signed-release/44-STOP-CONDITIONS.md -> 15 (every item recorded with evidence source)"
        status: pass
    human_judgment: true
    rationale: "The publish decision is the human's (REL-03 edge — the checklist is the audit trail, not an automated assert); the agent records each item NOT ACTIVE with its UAT/gate evidence source"
  - id: D4
    description: "v0.9.0 published as GitHub Latest with the DMG attached; v0.8.1 superseded (A4) — publish only after verify-downloaded + install/launch + zero-active checklist (D-06)"
    requirement: REL-03
    verification:
      - kind: manual_procedural
        ref: "gh api repos/electroheadfx/efx-motion-editor/releases/latest --jq .tag_name -> v0.9.0 AND gh release list --json isLatest -> v0.9.0 latest=true AND assets -> EFX.Motion.Editor_0.9.0_aarch64.dmg"
        status: pass
    human_judgment: true
    rationale: "Publication is public and one-way (REVERSIBILITY: one-way); the explicit user decision to publish is the trust-establishing step the one-way action requires"

# Metrics
duration: 40min
completed: 2026-08-21
status: complete
---

# Phase 44 Plan 3: Release + Publish Summary

**v0.9.0 published as GitHub Latest: draft release created with the DMG, downloaded-artifact verification PASS on a separate download (REL-03), normal install/launch confirmed without Gatekeeper bypass, all 15 stop conditions recorded NOT ACTIVE (D-07), then `gh release edit` published as Latest with the DMG attached and v0.8.1 superseded**

## Performance

- **Duration:** ~40 min across Tasks 1-3 (multi-session: draft + download verify + user publish decision)
- **Started:** 2026-08-21T11:55Z (Task 1 draft creation)
- **Completed:** 2026-08-21T13:44Z (publish + verification ledger)
- **Tasks:** 3 (draft+upload, verify-downloaded+install/launch, stop-condition checklist+publish)
- **Files modified:** 0 functional source files (release/verification plan); 2 evidence records created + 1 summary

## Accomplishments

- **GitHub draft release v0.9.0 with DMG (Task 1, tracer):** `gh release create v0.9.0 --draft --title "EFX Motion Editor v0.9.0"` with the signed/notarized/stapled DMG uploaded. Verified `isDraft: true` and asset `EFX.Motion.Editor_0.9.0_aarch64.dmg` attached before any download verification (draft state is the protection against premature publication).
- **Downloaded-artifact verification on a SEPARATE download (Task 2, REL-03, D-05):** the user downloaded the DMG from the draft release in a clean session (`/Volumes/T7/Téléchargements/EFX.Motion.Editor_0.9.0_aarch64.dmg`); the agent ran the credential-free `bash scripts/macos-release.sh verify-downloaded` → **DOWNLOADED ARTIFACT PASS** (DMG integrity/signature/ticket/Gatekeeper + contained-app signature/team/Hardened Runtime/ticket/Gatekeeper all validated). The user then installed the app into Applications and launched it **normally** (double-click, NO Gatekeeper bypass); the app ran visibly and the icon was confirmed on the downloaded surface — icon caches lie per D-05.
- **Stop-condition hard-gate checklist (Task 3, D-07):** all **15 "do not publish if"** items from spec Phase 5 (lines 611-629) individually recorded **NOT ACTIVE** with their evidence sources (44-UAT.md steps, 44-01 gates, releaseContract.test.ts, verify-downloaded PASS) — recorded BEFORE the publish decision. The checklist is separate from the UAT pass: a green UAT never substitutes for the explicit record.
- **v0.9.0 published as GitHub Latest (Task 3, D-06):** on the user's explicit "publish" decision, the release was lifted from draft (`--draft=false`) and marked Latest (`--latest`). Verified via the GitHub API `/releases/latest` → `v0.9.0`, `gh release list` → `v0.9.0 latest=true` (v0.8.1 `latest=false` — A4 supersede confirmed), `isDraft: false`, `isPrerelease: false`, and the DMG asset still attached. Publish URL: https://github.com/electroheadfx/efx-motion-editor/releases/tag/v0.9.0.
- **No functional source file changed** — this is a release/verification plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub draft release v0.9.0 and upload the signed DMG** - `e1e87bac` (docs: draft release + DMG + download evidence record)
2. **Task 2: Verify downloaded artifact + install + normal launch** - `228684b2` (docs: DOWNLOADED ARTIFACT PASS + install/launch confirmation)
3. **Task 3: Stop-condition checklist + publish v0.9.0 as GitHub Latest** - `63b9d00a` (docs: stop-condition checklist 15/15 NOT ACTIVE), `c9726c6c` (docs: publish confirmation + verification ledger)

**Plan metadata:** `pending final docs commit`

## Files Created/Modified

- `.planning/phases/44-integrated-uat-signed-release/44-VERIFY-DOWNLOADED.md` - downloaded-artifact evidence: draft release URL/asset, verify-downloaded contract, verbatim DOWNLOADED ARTIFACT PASS output, install/launch confirmation (new)
- `.planning/phases/44-integrated-uat-signed-release/44-STOP-CONDITIONS.md` - hard-gate checklist: 15 "do not publish if" items with evidence sources + verdict + publish confirmation + verification ledger (new)

## Decisions Made

- **Publish v0.9.0 as GitHub Latest** — the user's explicit decision ("publish") after DOWNLOADED ARTIFACT PASS, normal install/launch, and the zero-active stop-condition checklist. Completes the milestone on the 2026-08-31 target via the proven v0.8.1 flow.
- **Publish sequence adjusted to lift draft first** — `gh release edit v0.9.0 --latest` returned HTTP 422 ("Latest release cannot be draft or prerelease") while the release was still a draft. The same intent was reached with `gh release edit v0.9.0 --draft=false` then `--latest`; the resulting state matches the plan's acceptance criteria exactly (verified after every state change, T-44-12).
- **Latest verified via the GitHub API `/releases/latest` endpoint** — the installed gh CLI (2.97.0) does not expose an `isLatest` JSON field on `release view`. The API endpoint returned `v0.9.0` and `gh release list --json isLatest` returned `v0.9.0 latest=true`, which together are the canonical equivalent of the plan's `--json isLatest --jq .isLatest → true` probe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Publish command sequencing — draft must be lifted before marking Latest**
- **Found during:** Task 3 (publish action)
- **Issue:** The plan's literal command `gh release edit v0.9.0 --latest` was rejected by the GitHub API with `HTTP 422: Latest release cannot be draft or prerelease.` — GitHub only allows `make_latest` on a published (non-draft) release, and the release was still a draft from Task 1.
- **Fix:** Two-step documented flow: `gh release edit v0.9.0 --draft=false` (publish, verified `isDraft: false`) then `gh release edit v0.9.0 --latest` (mark Latest). The final state matches the plan's acceptance criteria exactly.
- **Files modified:** `.planning/phases/44-integrated-uat-signed-release/44-STOP-CONDITIONS.md` (sequencing note in the verification ledger)
- **Verification:** `gh api /releases/latest` → `v0.9.0`; `gh release list` → `v0.9.0 latest=true`; `isDraft: false`; `isPrerelease: false`; asset present.
- **Committed in:** `c9726c6c` (Task 3 publish confirmation)

**2. [Rule 3 - Blocking] Latest-state probe adapted to installed gh version**
- **Found during:** Task 3 (post-publish verification)
- **Issue:** `gh release view v0.9.0 --json isLatest` is not a supported JSON field in gh 2.97.0, so the plan's literal verify command could not run.
- **Fix:** Used the canonical GitHub API `/releases/latest` endpoint (`gh api .../releases/latest --jq .tag_name` → `v0.9.0`) plus `gh release list --json tagName,isLatest` (`v0.9.0 latest=true`) as the equivalent proof.
- **Files modified:** `.planning/phases/44-integrated-uat-signed-release/44-STOP-CONDITIONS.md` (verification ledger)
- **Verification:** Both probes confirm v0.9.0 is the GitHub Latest release.
- **Committed in:** `c9726c6c` (Task 3 publish confirmation)

---

**Total deviations:** 2 auto-fixed (2 blocking — both are CLI/API capability adjustments with no functional impact)
**Impact on plan:** Neither deviation changes scope or behavior; both adjust the exact CLI invocation to the installed tooling and GitHub API constraints while reaching the identical acceptance criteria. No scope creep.

## Issues Encountered

- **GitHub API constraint on draft→Latest (resolved):** `--latest` on a draft release returns HTTP 422. Resolved via the documented publish-then-mark sequence; verified `isDraft: false` before marking Latest (T-44-12 state verification).

## User Setup Required

None - no external service configuration required. The publish ran through the authenticated `gh` CLI (electroheadfx); Apple credentials never entered the repo or agent context (the credentialed release step ran user-owned in 44-02).

## Next Phase Readiness

- **Milestone v0.9.0 complete and published.** The signed/notarized/stapled v0.9.0 release is public as GitHub Latest with the DMG attached and v0.8.1 superseded (A4). All three phase requirements are now covered by SUMMARYs: REL-01 (44-01), REL-02 (44-02), REL-03 (44-03).
- Ready for phase verification (`/gsd-verify-work 44`), milestone closure (`/gsd-complete-milestone`), and the release announcement path.

---
*Phase: 44-integrated-uat-signed-release*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `.planning/phases/44-integrated-uat-signed-release/44-03-SUMMARY.md`
- FOUND: `.planning/phases/44-integrated-uat-signed-release/44-VERIFY-DOWNLOADED.md` (DOWNLOADED ARTIFACT PASS + install/launch)
- FOUND: `.planning/phases/44-integrated-uat-signed-release/44-STOP-CONDITIONS.md` (15/15 NOT ACTIVE + publish confirmation)
- FOUND: commit `e1e87bac` (draft release + DMG)
- FOUND: commit `228684b2` (DOWNLOADED ARTIFACT PASS)
- FOUND: commit `63b9d00a` (stop-condition checklist)
- FOUND: commit `c9726c6c` (publish confirmation + verification ledger)
- PASS: `gh api .../releases/latest` → `v0.9.0`; `gh release list` → `v0.9.0 latest=true`; DMG asset attached
