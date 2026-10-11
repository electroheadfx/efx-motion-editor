---
phase: "53"
slug: "integrated-v1-0-0-acceptance"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-10"
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (node environment, no jsdom — existing convention) |
| **Config file** | app/vitest config (pnpm workspace) |
| **Quick run command** | `pnpm --dir app exec vitest run <file.test.ts>` |
| **Full suite command** | `pnpm --dir app exec vitest run` |
| **Estimated runtime** | ~90 seconds (baseline at validation: 260 test files / 0 failed) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app exec vitest run <touched test file>`
- **After every plan wave:** Run `pnpm --dir app exec vitest run` (+ `tsc --noEmit`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 53-01-01 | 01 | 1 | ACC-01 | T-53-01 | five-surface bump pinned by single-source contract | unit | `pnpm --dir app exec vitest run src/releaseContract.test.ts` | ✅ | ✅ green (11 passed) |
| 53-01-02 | 01 | 1 | ACC-01 | T-53-02 | fresh per-gate exit captures; archive-never-delete | other | node GATES_RECORD_OK structure check over 53-GATES.md | ✅ | ✅ green (six REL-01 lines, exit 0 ×6) |
| 53-02-01 | 02 | 1 | ACC-02 | T-53-03 | worksheet machinery (state key, META, export) | other | node WORKSHEET_T1_OK over 53-UAT.html | ✅ | ✅ green |
| 53-02-02 | 02 | 1 | ACC-02 | T-53-03 | full 42-row inventory consistency gate | other | node WORKSHEET_T2_OK (cards=42, carried markers, SPEC STEP 1-16) | ✅ | ✅ green |
| 53-03-01 | 03 | 2 | ACC-02 | T-53-05 | freshness by inner-binary mtime; D-22 credential boundary | other | node UAT_HEADER_OK over 53-UAT.md | ✅ | ✅ green (user-run wrapper, agent D-22-clean) |
| 53-03-02 | 03 | 2 | ACC-02 | T-53-05 | one verdict per row, no dropped carried rows | other | node UAT_ARCHIVE_OK (rows=42, carried markers, JSON 42/42) | ✅ | ✅ green (36 pass / 6 na / 0 fail, user-approved) |
| 53-04-01 | 04 | 3 | ACC-03 | T-53-06 | tag verified read-only against 1.0.0 (stale-tag lesson) | cli | `git show v1.0.0:app/package.json` greps 1.0.0 | ✅ | ✅ green (tag → bump commit) |
| 53-04-02 | 04 | 3 | ACC-03 | T-53-06 | draft-only create; publish withheld to 53-05 | cli | `gh release view v1.0.0 --json isDraft/assets` gate | ✅ | ✅ green (TASK2_GATE_PASS) |
| 53-04-03 | 04 | 3 | ACC-03 | T-53-06 | downloaded bytes verified independent of local build | other | node VD_OK over 53-VERIFY-DOWNLOADED.md | ✅ | ✅ green (DOWNLOADED ARTIFACT PASS, D-06 smoke 5/5) |
| 53-04-R | 04 | 3 | ACC-03 | T-53-05 | D-06 covering-smoke defect fix `6f60951f` pinned | unit | `pnpm --dir app exec vitest run src/components/timeline/TimelineRenderer.hexExpand.test.ts` | ✅ | ✅ green (4/4 — Nyquist gap filled 2026-10-11) |
| 53-05-01 | 05 | 4 | ACC-03 | T-53-07 | empty evidence cell = ACTIVE; 14 verbatim rows | other | node STOP_14_OK over 53-STOP-CONDITIONS.md | ✅ | ✅ green (ZERO active verdict) |
| 53-05-02 | 05 | 4 | ACC-03 | T-53-07/T-53-08 | verdict-before-publish ordering; two-step publish | other | node PUBLISH_LEDGER_OK over 53-RELEASE.md | ✅ | ✅ green (published, 4/4 post-publish verifications) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Ride-along fix coverage:** `2075e873` (paintStore/projectStore module-cycle, WINDOWS.md #90) — covered by full-suite import health (a cycle regression fails the suite at module init) plus the live UAT ride-along acceptance-3 recorded in 53-UAT.md. `6f60951f` (theme-hex) — dedicated regression test added above (Nyquist fill).

---

## Wave 0 Requirements

- [x] Fix or route the RED vitest suite `PhysicsPaintStudioView.test.ts` (`_setPaintMarkDirtyCallback is not a function`, circular init — WINDOWS.md #90) — RESOLVED: user-approved D-21 scoped fix `2075e873`, merged `0dc40f8b`; precondition run green (259 passed / 2 skipped) before any gate ran (53-01-SUMMARY).

*Existing infrastructure covers all phase requirements (automated or recorded manual-only below).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | State |
|----------|-------------|------------|-------------------|-------|
| Native UAT — 42-row comprehensive pass (document init, legacy rejection, track CRUD, Background loops, fallback, Reveal, save/reopen, main-editor parity + all carried rows) | ACC-02 | Native macOS app + WKWebView; vitest is blind to live surfaces | 53-UAT.html worksheet executed against the signed bundle; archived as 53-UAT.md + 53-UAT.json | ✅ executed 2026-10-11 (36 pass / 6 na / 0 fail, user-approved) |
| Signed/notarized downloaded-artifact verification + install/smoke | ACC-03 | Requires credentials, network, GitHub publish | `scripts/macos-release.sh verify-downloaded` on the browser-downloaded DMG; install + D-06 covering smoke | ✅ executed 2026-10-11 (PASS, smoke 5/5) |
| Publish decision (one-way) + post-publish verification | ACC-03 | Human decision gate; credentials/network | 53-STOP-CONDITIONS.md ZERO-active verdict → two-step `gh release edit` → 4/4 verifications in 53-RELEASE.md | ✅ executed 2026-10-11 (published, Latest) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated — 12/12 task rows green, 1 gap found and filled (theme-hex regression test), 3 behaviors recorded manual-only (native/credential/publish by design).

## Validation Audit 2026-10-11

| Metric | Count |
|---|---|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |
