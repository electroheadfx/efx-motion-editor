---
phase: "54"
slug: "preact-11-update"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-02"
---

# Phase 54 — Validation Strategy

> Retroactive Nyquist audit (2026-11-02) over the completed phase. Two standing
> pins were added to close the RUN-03 and RUN-04 automation gaps; RUN-01 and
> RUN-06 remain manual-only by design (throwaway probe, live UAT).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (package `efx-motion-editor`) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run src/preactSingleCopyContract.test.ts src/preactToolchainContract.test.ts src/preactJsxNamespaceContract.test.ts src/paintVersionDisciplineContract.test.ts` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor run typecheck` |
| **Estimated runtime** | ~5s targeted / ~60s full suite + typecheck |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 1 | RUN-01 | T-54-01 | N/A | historical probe (deleted by D-02) | — (pre-bump state cannot be reproduced) | n/a | manual-only |
| 54-01-02 | 01 | 1 | RUN-01 | T-54-02 | N/A | filesystem assertion | `test ! -e scripts/preact11-probe` | ✅ | ✅ green |
| 54-02-01 | 02 | 2 | RUN-02, RUN-03 | T-54-SC | N/A | human registry confirmation | — (one-time human gate) | n/a | manual-only |
| 54-03-01 | 03 | 3 | RUN-02 | T-54-03 | N/A | contract pin | `pnpm --filter efx-motion-editor exec vitest run src/preactSingleCopyContract.test.ts` | ✅ | ✅ green (6 tests) |
| 54-03-02 | 03 | 3 | RUN-02 | — | N/A | contract pin + measurement | same command + `pnpm -r why preact` | ✅ | ✅ green |
| 54-03-03 | 03 | 3 | RUN-03 | T-54-04 | N/A | contract pin | `pnpm --filter efx-motion-editor exec vitest run src/preactToolchainContract.test.ts` | ✅ | ✅ green (7 tests) |
| 54-04-01 | 04 | 4 | RUN-04 | T-54-05 | N/A | typecheck + contract pin | `pnpm --filter efx-motion-editor run typecheck` + `pnpm --filter efx-motion-editor exec vitest run src/preactJsxNamespaceContract.test.ts` | ✅ | ✅ green (9 tests) |
| 54-04-02 | 04 | 4 | RUN-04 | T-54-06 | N/A | full suite | `pnpm --filter efx-motion-editor exec vitest run` | ✅ | ✅ green |
| 54-05-01 | 05 | 5 | RUN-05 | T-54-09 | N/A | contract pin | `pnpm --filter efx-motion-editor exec vitest run src/paintVersionDisciplineContract.test.ts` | ✅ | ✅ green (5 tests) |
| 54-05-02 | 05 | 5 | RUN-06 | T-54-10 | N/A | live UAT | — (A1–A5 human judgment) | n/a | manual-only (PASS 2026-10-14) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new fixtures or framework
install were needed; the two gap-closure pins ride `app/vitest.config.ts` unchanged.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pre-bump `@preact/signals` ↔ Preact 11 probe (pattern + pairing legs) | RUN-01 | The probe was a throwaway directory deliberately deleted once both legs were green (D-02). The pre-bump state no longer exists, so the experiment is not reproducible. | None — historical evidence recorded in `54-01-SUMMARY.md` (both legs green; stop-if-red never triggered). |
| Registry legitimacy of the four bumped packages | RUN-02, RUN-03 | A human confirmed the exact target versions exist on npm before install (T-54-SC). Publisher legitimacy is human judgment, not an assertion. | None — one-time gate recorded in `54-02-SUMMARY.md`. |
| Live reactivity UAT rows A1–A5 | RUN-06 | Live reactivity paths (paint commit, undo/redo, track switch, Studio dispose, standalone `./preact` mount) require human observation. | The five rows in `54-05-SUMMARY.md`; all user-asserted PASS on 2026-10-14. |

---

## Automated Gap Closure (2026-11-02)

| Requirement | Gap before audit | Pin added | Result |
|-------------|------------------|-----------|--------|
| RUN-03 / D-10, D-13 | No standing pin on `lucide-preact` (peer floor for Preact 11) or the aligned `@preact/preset-vite` target | `app/src/preactToolchainContract.test.ts` — scans root, app and `packages/*/package.json`; requires `lucide-preact` ≥ 1.57.0 and every declared `@preact/preset-vite` pin exactly `2.10.6`; checks preact only at major 11 | ✅ 7/7 |
| RUN-04 / D-07 | Typecheck verified the migration once; no standing guard against re-introducing the removed `JSX.CSSProperties` / `JSX.Targeted*` names | `app/src/preactJsxNamespaceContract.test.ts` — three D-07 files use bare named type imports from `'preact'`, keep `JSX.Element`, avoid the `preact.JSX.*` form; tree-wide zero forbidden references | ✅ 9/9 |

Combined command: `pnpm --filter efx-motion-editor exec vitest run src/preactToolchainContract.test.ts src/preactJsxNamespaceContract.test.ts` — 2 files, 16 tests, all passing.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-02 (retroactive audit; gaps filled)
