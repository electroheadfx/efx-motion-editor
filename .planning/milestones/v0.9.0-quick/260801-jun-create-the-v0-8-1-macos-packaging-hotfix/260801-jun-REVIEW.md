---
phase: 260801-jun-create-the-v0-8-1-macos-packaging-hotfix
reviewed: 2026-08-01T16:05:00Z
depth: quick
files_reviewed: 9
files_reviewed_list:
  - app/package.json
  - app/src-tauri/Cargo.lock
  - app/src-tauri/Cargo.toml
  - app/src-tauri/tauri.conf.json
  - app/src/releaseContract.test.ts
  - app/src/viteBuild.test.ts
  - app/vite.config.ts
  - docs/macos-developer-id-setup.md
  - docs/macos-signed-release.md
  - scripts/macos-release.sh
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 260801-jun: Code Review Report

**Reviewed:** 2026-08-01T16:05:00Z
**Depth:** quick (pattern scans plus focused reading of the Vite plugin hooks, the release script, and both test files per the stated review priorities)
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The hotfix is in good shape. No secrets, no dangerous-function usage, no debug artifacts, no empty catch blocks were found by pattern scan, and the docs contain only placeholder credential values. The fail-closed design intent is real: `validate_tauri_config`, the private-asset guards, the identity-count check, and the bundle guard all abort loudly rather than warn. The Vite `config` hook correctly runs as an `enforce: 'post'` plugin so it sees Motion Canvas's contributed `rollupOptions.input`, preserves every entry, and throws on any shape drift; the `esbuild` repair is correctly returned from the config hook (not `configResolved`) so it beats `vite:esbuild`'s snapshot timing.

Shell safety in `scripts/macos-release.sh` is solid: variables are quoted throughout, `set -euo pipefail` is on, system tools are pinned to absolute paths, `APPLE_API_KEY_PATH` is validated as absolute/readable/outside the repo (via `realpath`, so symlink escapes are caught), credential values are only passed as CLI args to `notarytool` and are never read or printed, and `set -x` is never enabled. The notarization design is coherent: Tauri auto-notarizes and staples the `.app` during `tauri build` when the `APPLE_*` env vars are present, which is why `stapler validate` on the app inside `verify_app` is expected to succeed, and the script separately notarizes/staples the DMG.

The findings below are all robustness/portability issues, not correctness bugs in the release path itself.

## Warnings

### WR-01: writeBundle silently skips the bundle guard when outDir is unresolved

**File:** `app/vite.config.ts:147-150`
**Issue:** The guard is documented as fail-closed ("fails the build whenever the emitted bundle is incomplete"), but the invocation is `const outDir = outputOptions.dir ?? resolvedOutDir; if (outDir) assertProductionBundle(outDir);`. If both are ever undefined (e.g., a future refactor stops `configResolved` from running, or Vite changes hook ordering), the guard silently no-ops and an incomplete bundle ships — the exact v0.8.0 failure mode this hotfix exists to prevent. A fail-closed guard must not have a silent bypass path.
**Fix:**
```ts
writeBundle(outputOptions) {
  const outDir = outputOptions.dir ?? resolvedOutDir;
  if (!outDir) {
    throw new Error('Production bundle guard: could not resolve output directory');
  }
  assertProductionBundle(outDir);
},
```

### WR-02: releaseContract test fails the whole suite on non-macOS machines

**File:** `app/src/releaseContract.test.ts:88-93`
**Issue:** The test `script prefixes system PATH on the Tauri build...` runs `execSync('PATH="..." command -v codesign', { shell: '/bin/bash' })`. On any non-macOS host (Linux CI, contributor machines) `codesign` does not exist, `execSync` throws, and the entire test file — including the platform-neutral version/icon contract tests — fails. Nothing in the file guards on `process.platform`. If CI for this repo is or becomes multi-platform, every run goes red for a macOS-only assertion.
**Fix:** Gate the live probe, e.g. `const itMac = process.platform === 'darwin' ? it : it.skip;` for that test (or split the execSync assertion into its own `it.runIf(process.platform === 'darwin')`), keeping the static regex assertions platform-neutral.

### WR-03: Bundle-guard asset filter is scheme-naive and can false-fail legitimate HTML

**File:** `app/vite.config.ts:50-65`
**Issue:** `assertProductionBundle` treats every `src=`/`href=` value that does not start with `http:`, `https:`, `data:`, `#`, or `//` as a local file that must exist and be non-empty. Non-HTTP schemes common in real HTML — `mailto:`, `tel:`, `blob:` — are not excluded, so adding e.g. a `mailto:` support link to `index.html` would make the production build fail with "referenced asset is missing or empty". Also, an empty-but-valid asset (a legitimately empty `.css` emitted by a plugin) would fail the build. Today's emitted HTML contains none of these, so this is latent, but the guard pins more than the v0.8.0 regression it targets.
**Fix:** Extend the exclusion list to cover known non-file schemes (`/^[a-z][a-z0-9+.-]*:/i` catches `mailto:`, `tel:`, `blob:`, etc. — only bare paths and `/`-rooted paths should be treated as local), and consider checking existence rather than non-emptiness for non-HTML assets.

## Info

### IN-01: `as any` casts on the Motion Canvas plugin import and filter

**File:** `app/vite.config.ts:13,81`
**Issue:** `(motionCanvasModule as any).default` and `...(motionCanvas(...) as any[])` discard type safety at the CJS-interop seam and the plugin-array filter.
**Fix:** Define a minimal structural type (`type MCPluginModule = ((opts: { project: string }) => { name?: string }[]) | { default: ... }`) and narrow with a type guard instead of `as any`.

### IN-02: Preflight error message misdescribes the private-asset check

**File:** `scripts/macos-release.sh:190`
**Issue:** The die message says "remove it from repository history before release", but `tracked_private_asset_exists` only inspects the current Git index (`git ls-files`); it does not scan history. An operator reading the message may embark on a history rewrite when an untrack/commit-removal is what the check actually demands.
**Fix:** Reword to "is tracked by Git" and mention history scrubbing only as a separate recommendation, or actually check history (`git log --all --name-only`) if that is the intent.

### IN-03: Release-artifact error message claims version scoping the find does not do

**File:** `scripts/macos-release.sh:353`
**Issue:** "Expected exactly one v$PRODUCT_VERSION $PRODUCT_NAME.app release artifact" — the `.app` find has no version filter (app bundle names carry no version); only the DMG find interpolates `PRODUCT_VERSION`. Cosmetic, but the message misleads when a stale second `.app` from another target triple trips the count check.
**Fix:** Drop "v$PRODUCT_VERSION" from the app-artifact message.

### IN-04: Test re-implements the guard's ref-extraction logic instead of sharing it

**File:** `app/src/viteBuild.test.ts:31-43`
**Issue:** `extractLocalRefs` duplicates the `src|href` regex and exclusion filter from `assertProductionBundle`. If the guard's filter changes (e.g., WR-03's fix), the test's copy silently drifts and the "corrupted copy" test keeps testing stale semantics.
**Fix:** Export the ref-extraction helper from `vite.config.ts` (alongside `assertProductionBundle`) and import it in the test.

---

_Reviewed: 2026-08-01T16:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
