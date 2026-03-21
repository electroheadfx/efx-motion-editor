---
phase: 14
slug: png-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `Application/vitest.config.ts` |
| **Quick run command** | `cd Application && pnpm vitest run --reporter=verbose` |
| **Full suite command** | `cd Application && pnpm vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd Application && pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `cd Application && pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | EXPORT-01 | unit | `cd Application && pnpm vitest run src/lib/exportRenderer.test.ts -x` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | EXPORT-02 | unit | `cd Application && pnpm vitest run src/lib/exportEngine.test.ts -x` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | EXPORT-03 | unit | `cd Application && pnpm vitest run src/lib/exportEngine.test.ts -x` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | EXPORT-04 | unit | `cd Application && pnpm vitest run src/lib/exportSidecar.test.ts -x` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | EXPORT-05 | manual-only | Requires FFmpeg binary + Rust backend | N/A | ⬜ pending |
| 14-03-01 | 03 | 2 | EXPORT-06 | manual-only | Requires full Tauri app context | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `Application/src/lib/exportRenderer.test.ts` — stubs for EXPORT-01 (pure compositing function tests)
- [ ] `Application/src/lib/exportEngine.test.ts` — stubs for EXPORT-02, EXPORT-03 (naming, cancel logic)
- [ ] `Application/src/lib/exportSidecar.test.ts` — stubs for EXPORT-04 (JSON schema validation)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FFmpeg command construction with correct codec flags | EXPORT-05 | Requires FFmpeg binary + Rust backend | 1. Trigger video export, 2. Check Rust logs for ffmpeg command args, 3. Verify output file is valid |
| Export dialog UI renders with correct format options | EXPORT-06 | Requires full Tauri app context | 1. Open export dialog (Cmd+Shift+E), 2. Verify PNG/Video tabs, 3. Verify resolution options, 4. Verify folder picker works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
