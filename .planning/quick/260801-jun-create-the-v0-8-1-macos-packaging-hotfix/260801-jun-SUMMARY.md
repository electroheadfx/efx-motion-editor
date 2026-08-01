---
phase: quick-260801-jun
plan: 01
subsystem: infra
tags: [vite, tauri, macos, release-pipeline, packaging, codesign, icons]

requires:
  - phase: v0.8.0
    provides: the broken release this hotfix repairs (missing dist/index.html, placeholder icon)
provides:
  - Production Vite build that emits dist/index.html + all referenced assets + the Motion Canvas project bundle
  - Fail-closed writeBundle bundle guard (build dies before Tauri packaging on a broken frontend)
  - Real EFX icon set (5 desktop files) configured via tauri.conf.json bundle.icon
  - All product-owned version surfaces at 0.8.1 with single-source PRODUCT_VERSION
  - Hardened macos-release.sh: dynamic version compare, tracked-generated-icon contract (no SPECS/source-PNG dependency; fresh-clone safe), simulated codesign resolution, system-first PATH on the Tauri build, extended verify_app Info.plist/icon checks
  - Regression tests: app/src/viteBuild.test.ts, app/src/releaseContract.test.ts
affects: [v0.8.1 release, macos-signed-release, future release pipeline work]

actuals:
  tokens: 9131
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Post-plugin config-hook merge: read motion-canvas:project's contributed rollupOptions.input, spread verbatim, add the app HTML entry; fail loudly on unexpected input shape"
    - "esbuild repair via config-hook return (vite:esbuild snapshots config.esbuild at plugin-creation time; configResolved mutation is a no-op)"
    - "Fail-closed writeBundle bundle guard exported for direct test exercise"
    - "Simulated runtime resolution check (PATH prefix + command -v must print /usr/bin/codesign) instead of string-ordering assertions"

key-files:
  created:
    - app/src/viteBuild.test.ts
    - app/src/releaseContract.test.ts
    - app/src-tauri/icons/32x32.png
    - app/src-tauri/icons/128x128.png
    - app/src-tauri/icons/128x128@2x.png
    - app/src-tauri/icons/icon.icns
    - app/src-tauri/icons/icon.ico
  modified:
    - app/vite.config.ts
    - app/src-tauri/tauri.conf.json
    - app/package.json
    - app/src-tauri/Cargo.toml
    - app/src-tauri/Cargo.lock
    - scripts/macos-release.sh
    - docs/macos-signed-release.md
    - docs/macos-developer-id-setup.md

key-decisions:
  - "Both the rollup-input merge and the esbuild jsxImportSource repair returned from the same post plugin's config hook (input-only fix provably fails on the latent jsx-runtime resolution error)"
  - "Desktop-only icon tracking: deleted ios/android/64x64/StoreLogo/Square* outputs and the old placeholder icon.png rather than adding a .gitignore"
  - "SPECS icon PNG copied from the main checkout into the worktree (gitignored; not copied by the worktree runtime)"

patterns-established:
  - "Bundle guard as exported pure function (assertProductionBundle) exercised by tests against fixture dirs plus a real hermetic production build"

requirements-completed: [QUICK-260801-jun]

coverage:
  - id: D1
    description: "Production build emits a complete frontend (index.html + assets + project bundle) and the guard fails broken bundles"
    requirement: QUICK-260801-jun
    verification:
      - kind: integration
        ref: "app/src/viteBuild.test.ts (7 tests, real hermetic production build)"
        status: pass
      - kind: integration
        ref: "pnpm build (workspace) + dist contract node check (3 refs resolve, project-*.js present)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Real EFX icon set generated and configured via exact 5-file bundle.icon array"
    requirement: QUICK-260801-jun
    verification:
      - kind: unit
        ref: "app/src/releaseContract.test.ts > bundle.icon contract (array, presence, icns magic)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Release script hardening: version agreement, icon contract, codesign PATH, verify_app metadata"
    requirement: QUICK-260801-jun
    verification:
      - kind: unit
        ref: "app/src/releaseContract.test.ts (version/script/PATH contract)"
        status: pass
      - kind: integration
        ref: "bash scripts/macos-release.sh preflight (credential-free PREFLIGHT PASS)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Credentialed v0.8.1 release: signing, notarization, tag creation, GitHub release, native UAT"
    verification: []
    human_judgment: true
    rationale: "Hard boundary — Apple credentials, notarization services, tags, pushes, and visible native UAT are user-owned; the executor only prepares the credential-free contract"

duration: 22min
completed: 2026-08-01
status: complete
---

# Phase quick-260801-jun Plan 01: v0.8.1 macOS Packaging Hotfix Summary

**Production Vite entry restored with a fail-closed bundle guard, real EFX icons generated and enforced, version surfaces bumped to 0.8.1, and the macOS release script hardened end-to-end — the v0.8.0 silent-broken-bundle failure mode can no longer pass the pipeline.**

## Performance

- **Duration:** 22 min
- **Tasks:** 3/3 complete
- **Commits:** 4 atomic commits in plan order

## Commits

| Commit | Message |
|--------|---------|
| 07b1b62a | fix(build): preserve editor HTML in production bundles |
| f7653857 | fix(macOS): generate and configure EFX application icons |
| 631845d7 | fix(release): harden the v0.8.1 macOS release contract |
| 28a23dd0 | docs(release): document the v0.8.1 packaging hotfix |

## Failing-First Evidence (TDD)

**app/src/viteBuild.test.ts — RED against the old config (7 failed):**
- Test A red: `expected undefined to be '.../app/index.html'` (input had only the MC `src/project` entry)
- Test B red: `index.html must be emitted: expected false to be true`
- Guard tests red: `TypeError: assertProductionBundle is not a function`
- GREEN after the config fix: 7/7 pass (real hermetic production build, ~4s)

**app/src/releaseContract.test.ts — RED against the 0.8.0-pinned script:**
- Test F red: script matched `/_\d+\.\d+\.\d+_[^"]*\.dmg/` (the `*_0.8.0_*.dmg` literal) and hardcoded `config.version !== '0.8.0'`
- Test G red: no system-first PATH prefix on the Tauri build invocation / no simulated codesign check
- Test D red mid-sequence (per plan ordering — after bumping the four product surfaces, before bumping the script): `PRODUCT_VERSION in scripts/macos-release.sh: expected '0.8.0' to be '0.8.1'`
- GREEN after script bump + hardening: 4/4 pass

## Final Verification Battery

| # | Check | Result |
|---|-------|--------|
| 1 | Focused vitest (viteBuild + releaseContract) | PASS — 11/11 |
| 2 | Full vitest run | PASS — 96 files, 1006 passed, 3 files/1 test skipped (pre-existing skips), 101 todo |
| 3 | `pnpm --dir app run typecheck` | PASS |
| 4 | `pnpm build` (workspace) + dist contract | PASS — app/dist/index.html non-empty, 3/3 referenced local assets exist, `dist/src/project-Che8Jrrs.js` present |
| 5 | `cargo test --manifest-path app/src-tauri/Cargo.toml` | FAIL — **pre-existing at base** (stale `project_io.rs` tests vs renamed roto struct fields; empty diff vs base under `app/src-tauri/src/`). Logged to deferred-items.md, not fixed (scope boundary) |
| 6 | `bash -n scripts/macos-release.sh` | PASS |
| 7 | `bash scripts/macos-release.sh preflight` | PASS — PREFLIGHT PASS (credential-free; includes tracked-generated-icon contract, simulated codesign resolution) |
| 8 | v0.8.0 tag pin | PASS — resolves to 9dd274d7d32e88d1b2eb24a589adcfa278907cbf |
| 9 | Commit order | PASS — fix(build), fix(macOS), fix(release), docs(release), plus post-execution canonical-icon amendment (user decision) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Guarded optional `optimizeDeps.exclude` for tsc**
- **Found during:** Task 1 GREEN (`pnpm build` runs `tsc --noEmit` first)
- **Issue:** Pre-existing TS18048 errors (`'exclude' is possibly 'undefined'`) in vite.config.ts — verified present at base commit via `git stash` + typecheck with the workspace package built. The typecheck gate is mandated by this plan's verification and the failing lines sat inside the code region this task relocated.
- **Fix:** Wrapped the splice repair in `if (exclude)`; runtime behavior unchanged.
- **Files modified:** app/vite.config.ts
- **Commit:** 07b1b62a

**2. [Rule 1 - Bug] Fixed self-inflicted `$schema` URL typo before commit**
- **Found during:** Task 3 pre-commit diff review
- **Issue:** My tauri.conf.json rewrite typo'd the `$schema` URL (`tauri-cli/schema.json` path segment). Caught by diff inspection; corrected to the original URL before staging. No commit ever contained the typo.
- **Files modified:** app/src-tauri/tauri.conf.json
- **Commit:** 631845d7 (clean one-line version diff)

### Environment / setup notes (not plan deviations)

- Worktree had no `node_modules`: ran `pnpm install --frozen-lockfile` (lockfile-only, no new packages).
- `SPECS/efxmotioneditor-icon.png` was absent from the worktree (gitignored, not copied by the runtime): copied from the main checkout after verifying presence/shape there (1024x1024 RGBA PNG). Required by Task 2's `tauri icon` generation step.

### Post-execution contract change (user decision, 2026-08-01)

- The user decided the release must NOT depend on the gitignored SPECS source PNG and must NOT track the 1.8MB `app-icon.png` scratch copy. The five tracked generated icons referenced by `bundle.icon` are the canonical release inputs. Amendment commit `71baed70` removed the sips/SPECS preflight block and updated both release docs; preflight now passes from a fresh clone.
- Workspace package `@efxlab/efx-physic-paint` built before app typecheck/build (root `pnpm build` ordering).
- `app/dist` is untracked in git — Commit 1 staged only source files, per plan.

### Deferred (out of scope)

- **Pre-existing `cargo test` lib-test compile failure** (8 errors, E0560/E0609): `app/src-tauri/src/services/project_io.rs` tests reference `McePhysicPaintOutput.roto_cache_metadata` / `roto_interpolation_settings` / `roto_background`, renamed away by the Phase 36.14 physical-frame cutover. Reproduces identically at base 9dd274d7; this task changed nothing under `app/src-tauri/src/`. Logged in `.planning/quick/260801-jun-create-the-v0-8-1-macos-packaging-hotfix/deferred-items.md` with a recommendation for a follow-up quick task. Verification battery item 5 is red for this reason only.
- `build.target: 'safari13'` silently overridden by MC's `'modules'` — pre-existing, documented in a code comment.

## Authentication Gates

None encountered. All execution was credential-free by design; preflight explicitly does not touch Apple credentials.

## Known Stubs

None. All artifacts are fully wired: the guard runs inside every production build, preflight enforces every new contract, and both regression suites are green.

## Threat Mitigations Applied

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-jun-01 (codesign PATH tampering) | System-first PATH prefix on Tauri build + simulated-resolution preflight check | Implemented, preflight-verified |
| T-jun-02 (placeholder icon in signed bundle) | ICNS magic + non-empty checks in preflight `validate_tauri_config` and `verify_app()` | Implemented, contract-tested |
| T-jun-03 (silent broken frontend) | Fail-closed `writeBundle` bundle guard | Implemented, build-verified |

## Handoff (user-owned)

The following remain user-owned and were NOT touched: credentialed signing/notarization
(`release`, `verify-downloaded`), Apple credential files, tag creation (v0.8.1),
git pushes, GitHub releases, and visible native UAT of the packaged app. The v0.8.0
tag remains pinned to 9dd274d7d32e88d1b2eb24a589adcfa278907cbf.

## Self-Check: PASSED

All 12 claimed files exist on disk; all 4 commits (07b1b62a, f7653857, 631845d7, 28a23dd0) exist in git history.
