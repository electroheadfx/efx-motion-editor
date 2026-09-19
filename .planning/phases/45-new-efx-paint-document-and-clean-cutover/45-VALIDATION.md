---
phase: 45
slug: new-efx-paint-document-and-clean-cutover
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-23
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | existing project vitest config (no new config — per project constraint) |
| **Quick run command** | `pnpm vitest run <changed-test-file>` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~60–120 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <changed-test-file>`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-T1..T3 | 45-01 | 1 | DOC-01, DOC-02 | T-45-01/02/03 | Fail-closed parse; duplicate/dangling identity; deterministic revisions | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintDocument.test.ts` | ✅ | ✅ green |
| 45-02-T1..T3 | 45-02 | 2 | DOC-04, DOC-05 | T-45-04/05/06/07 | F1 Rust+TS co-change round-trip; legacy struct deleted; cache re-point + traversal-proof prefix-lock; D-04 non-destruction | unit | `cargo test --manifest-path app/src-tauri/Cargo.toml` | ✅ | ✅ green |
| 45-03-T1..T2 | 45-03 | 2 | DOC-03 | T-45-08/09/10 | Pure scan gate; F2 structure-discriminated (fresh-v1 passes); fixed precedence; non-throwing on non-record | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintCleanBreak.test.ts` | ✅ | ✅ green |
| 45-04-T1..T3 | 45-04 | 3 | DOC-01, DOC-05 | T-45-11/12/13/14 | staging/commit two-resource; fail-closed load; path safety + FNV-1a; content-fingerprint dedup; rollback keeps prior generation | unit | `pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.test.ts src/lib/efxPaintPersistence.test.ts` | ✅ | ✅ green |
| 45-05-T1..T3 | 45-05 | 4 | DOC-01, DOC-02, DOC-03, DOC-05, DOC-06 | T-45-15/16/17/18 | Gate-before-mutation (no-recourse dialog); single save path; version 16; DOC-06 diff gate (no protected-file change) | unit + other | `pnpm --filter efx-motion-editor exec vitest run src/stores/projectStore.efxPaintCutover.test.ts` | ✅ | ✅ green |
| 45-06-T1..T4 | 45-06 | 4 | DOC-04, DOC-05 | T-45-19/20/21 | v1.0 session-file format + distinct legacy reject; launch carries document (fail-closed validator); engine save/load fail-closed; tree-wide v2-token sweep | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/bridge src/components/physic-paint/hooks src/components/physic-paint/PhysicsPaintStudio.test.ts` + `pnpm --filter @efxlab/efx-physic-paint exec vitest run` | ✅ | ✅ green |
| 45-07-T1..T2 | 45-07 | 5 | DOC-04, DOC-06 | T-45-22/23/24 | 11-token grep contract (comment-stripped, strict allowlist); legacy surface hard-deleted; carrier confined | unit + other | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/efxPaintCleanBreakContract.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing vitest infrastructure covers all phase requirements (per project constraint: `vitest run`, never watch mode; no one-off test configs) — no new config; TS suites run under the existing `app/vitest.config.ts`, Rust under `app/src-tauri/Cargo.toml`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Main-editor sequence timing and outer layer composition unchanged | DOC-06 (success criterion 5) | Visual/interaction UAT — user runs native UAT | D-10 UAT part 4: in a v1.0 project with ordinary content, verify sequence timing, outer layer composition, and inline EFX Paint layers behave as before | ✅ PASS (45-08) |
| Pre-v1.0 project rejection UX | DOC-03 / DOC-02 | User-facing error surface | D-10 UAT part 3: open a COPY of a real v0.9-era Physic Paint project; confirm the explicit no-recourse dialog, zero mutation, original byte-untouched | ✅ PASS (45-08) |
| Studio opens on a v1.0 document + stroke on default track | DOC-01 / DOC-02 | Live Studio window + canvas interaction | D-10 UAT part 1: new project + EFX Physic Paint layer → Studio opens on v1.0 document; paint a stroke on the default track | ✅ PASS (45-08) |
| Save/reopen identity + on-disk D-11 evidence | DOC-05 | On-disk `.mce` inspection with user | D-10 UAT part 2: save/quit/reopen; inspect `.mce` for `efx_paint_documents` (version 1, parentLayerId, documentRevision, activeTrackId, one Paint + Background track, transparent fallback), no legacy keys | ✅ PASS (45-08) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified — all DOC-01..DOC-06 requirements have automated verification (green) or human-confirmed native UAT evidence (45-08). No gaps found; `nyquist_compliant: true`.

---

## Validation Audit 2026-08-23
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Requirements COVERED (automated) | 4 of 6 (DOC-01..DOC-06; DOC-03/DOC-06 also have native UAT confirmation) |
| Requirements COVERED (automated + manual) | 6 of 6 |
| Automated gate verification | 59 TS + 79 Rust tests green at audit |
