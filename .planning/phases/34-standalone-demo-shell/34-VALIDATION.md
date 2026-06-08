---
phase: 34
slug: standalone-demo-shell
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-08
updated: 2026-06-08
---

# Phase 34 — Validation Strategy

Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler + Node static assertions + Vite build smoke; package has no package-local Vitest config. |
| **Config file** | `packages/efx-physic-paint/tsconfig.json`, `packages/efx-physic-paint/tsconfig.build.json`, `packages/efx-physic-paint/demo/vite.config.ts` after Plan 34-02. |
| **Quick run command** | `pnpm --filter @efxlab/efx-physic-paint check` |
| **Full suite command** | `pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter @efxlab/efx-physic-paint demo:build` |
| **Estimated runtime** | Quick: under 60s; Full: under 120s on a warm workspace. |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` Node/static assertion and `pnpm --filter @efxlab/efx-physic-paint check` when TypeScript/TSX/package metadata changed.
- **After every plan wave:** Run `pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter @efxlab/efx-physic-paint demo:build` once `demo:build` exists after Plan 34-01/34-02.
- **Before `/gsd-verify-work`:** Full suite must be green and the manual UAT row must be completed by the user because Claude must not run servers.
- **Max feedback latency:** under 120s for automated full-suite feedback after demo scripts exist.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 34-01 | 1 | RUN-01 | T-34-01 | Root script delegates only to package demo command; no `cd` shell routing. | static | `node -e "const p=require('./package.json'); if (p.scripts['dev:paint'] !== 'pnpm --filter @efxlab/efx-physic-paint demo:dev') throw new Error('root dev:paint must delegate to package demo:dev');"` | Yes: `package.json` | pending |
| 34-01-02 | 34-01 | 1 | RUN-01, RUN-02 | T-34-02, T-34-SC | Package scripts keep demo launch/build separate from `tsup` library build and do not export/publish demo files. | static + typecheck | Plan 34-01 Task 2 Node assertion, then `pnpm --filter @efxlab/efx-physic-paint check` | Yes: `packages/efx-physic-paint/package.json`, `pnpm-lock.yaml` | pending |
| 34-02-01 | 34-02 | 2 | RUN-02 | T-34-03, T-34-05 | Demo Vite config aliases public Preact subpath to source and excludes app/Tauri/Tailwind/Motion Canvas. | static | Plan 34-02 Task 1 Node assertion | Created by task: `packages/efx-physic-paint/demo/vite.config.ts`, `packages/efx-physic-paint/demo/index.html` | pending |
| 34-02-02 | 34-02 | 2 | RUN-02 | T-34-03, T-34-04, T-34-05, T-34-06 | Demo shell uses static JSX strings, public Preact wrapper, `papers={[]}`, no editor/runtime imports, and visible errors for missing root or canvas wrapper readiness failure. | static + build | Plan 34-02 Task 2 Node assertion, then `pnpm --filter @efxlab/efx-physic-paint demo:build` | Created by task: `packages/efx-physic-paint/demo/src/main.tsx`, `packages/efx-physic-paint/demo/src/styles.css` | pending |
| 34-02-03 | 34-02 | 2 | RUN-01, RUN-02 | T-34-05 | User confirms browser runtime and HMR without Claude starting the dev server. | manual UAT with automated precheck | `pnpm --filter @efxlab/efx-physic-paint demo:build` | Yes after 34-02-01/02 | pending |
| 34-03-01 | 34-03 | 3 | RUN-03 | T-34-10 | README Preact example uses current public wrapper props and removes stale `paperPath`/`onEngine`. | static | Plan 34-03 Task 1 Node assertion | Yes: `packages/efx-physic-paint/README.md` | pending |
| 34-03-02 | 34-03 | 3 | RUN-01, RUN-02, RUN-03 | T-34-07, T-34-08, T-34-09 | README command docs match actual scripts and distinguish app Vite, Tauri desktop, and standalone browser demo workflows. | static | Plan 34-03 Task 2 Node assertion | Yes: `packages/efx-physic-paint/README.md` | pending |
| 34-03-03 | 34-03 | 3 | RUN-01, RUN-02, RUN-03 | T-34-08, T-34-SC | README, scripts, package exports/files, tsup entries, package check/build, and demo build all agree. | static + typecheck + build | Plan 34-03 Task 3 Node assertion, then `pnpm --filter @efxlab/efx-physic-paint check`, `pnpm --filter @efxlab/efx-physic-paint build`, `pnpm --filter @efxlab/efx-physic-paint demo:build` | Yes after prior plans | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all Phase 34 requirements:

- `packages/efx-physic-paint/package.json#scripts.check` already exists as `tsc --noEmit`.
- `packages/efx-physic-paint/package.json#scripts.build` already exists as `tsup`.
- No new test framework installation is required before execution.
- Missing demo artifacts are created by Plan 34-02 and are verified by source assertions before any `demo:build` smoke command depends on them.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Standalone browser demo launches through repo-root `pnpm dev:paint` and HMR updates demo files. | RUN-01, RUN-02 | Project `CLAUDE.md` says Claude must not run the server; Vite dev-server/browser behavior requires user-run runtime confirmation. | 1. From repository root, run `pnpm dev:paint`. 2. Open the Vite URL printed by the command. 3. Confirm the page header is `@efxlab/efx-physic-paint standalone demo`. 4. Confirm the status line is exactly `Vite demo / public Preact API / no editor runtime`. 5. Confirm the physics paint canvas appears and no EFX Motion Editor/Tauri shell UI appears. 6. Edit `packages/efx-physic-paint/demo/src/main.tsx` or `packages/efx-physic-paint/demo/src/styles.css` and confirm browser HMR updates without running `tsup --watch`. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or an explicit manual UAT row after automated precheck.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing test infrastructure references; no separate Wave 0 scaffolding is required.
- [x] No watch-mode flags are used in automated verification.
- [x] Feedback latency target is under 120s for the full automated suite after demo scripts exist.
- [x] `nyquist_compliant: true` set in frontmatter.
- [x] `wave_0_complete: true` set in frontmatter because all verification infrastructure exists or is created before dependent commands run.

**Approval:** approved for execution 2026-06-08
