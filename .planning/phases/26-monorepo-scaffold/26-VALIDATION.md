---
phase: 26
slug: monorepo-scaffold
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via `app/vitest.config.ts`, ~30 test files) |
| **Config file** | `app/vitest.config.ts` (after rename from `Application/vitest.config.ts`) |
| **Quick run command** | `cd app && pnpm vitest run --reporter=verbose` |
| **Full suite command** | `cd app && pnpm vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick validation relevant to the task (e.g., git history check after rename, pnpm install after workspace config)
- **After every plan wave:** Run full validation script (all success criteria)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | MONO-02 | smoke | `git log --follow --oneline app/src/stores/paintStore.ts \| head -5` | ✅ | ⬜ pending |
| 26-01-02 | 01 | 1 | MONO-01 | smoke | `test -f pnpm-workspace.yaml && test -f package.json && test -f pnpm-lock.yaml` | ✅ | ⬜ pending |
| 26-02-01 | 02 | 1 | MONO-03 | smoke | `test -f packages/efx-physic-paint/package.json && test -d packages/efx-physic-paint/src` | ✅ | ⬜ pending |
| 26-02-02 | 02 | 1 | MONO-03 | smoke | `test ! -d packages/efx-physic-paint/.planning && test ! -f packages/efx-physic-paint/vite.config.ts` | ✅ | ⬜ pending |
| 26-03-01 | 03 | 2 | MONO-04 | smoke | `ls -la app/node_modules/@efxlab/efx-physic-paint` | ✅ | ⬜ pending |
| 26-03-02 | 03 | 2 | MONO-04 | smoke | `pnpm --filter @efxlab/efx-physic-paint build` | ✅ | ⬜ pending |
| 26-04-01 | 04 | 2 | MONO-05 | smoke | `timeout 15 pnpm dev 2>&1 \| grep -q "Local:"` | ✅ | ⬜ pending |
| 26-04-02 | 04 | 2 | MONO-05 | unit | `cd app && pnpm vitest run` | ✅ | ⬜ pending |
| 26-05-01 | 05 | 2 | MONO-06 | smoke | `node -e "const p=require('./package.json'); console.log(!!p.pnpm?.overrides)"` | ✅ | ⬜ pending |
| 26-05-02 | 05 | 2 | MONO-06 | smoke | `grep -q 'efx-physic-paint' app/vite.config.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — this is an infrastructure phase validated by smoke/integration checks via shell commands.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tauri build produces .app | MONO-05 | Build takes several minutes, requires macOS | Run `pnpm --filter efx-motion-editor build`, check `app/src-tauri/target/release/bundle/` |
| Dev server renders correctly | MONO-05 | Visual verification needed | Run `pnpm dev`, open browser, verify editor loads identically to v0.6.0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
