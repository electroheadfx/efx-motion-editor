# Quick Task 260801-jun: v0.8.1 macOS packaging hotfix - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Task Boundary

Create the v0.8.1 macOS packaging hotfix for EFX Motion Editor:

- Fix Vite production build so `app/dist/index.html` and its referenced assets are emitted while preserving the Motion Canvas `src/project.ts?project` entry; add a production bundle guard that fails the build otherwise.
- Generate and configure the real EFX application icon set from `SPECS/efxmotioneditor-icon.png` (1024x1024 RGBA PNG) via `pnpm --dir app tauri icon src-tauri/app-icon.png`; configure the exact 5-file desktop `bundle.icon` array in `tauri.conf.json`.
- Bump product-owned version surfaces to 0.8.1 only: `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, only the `efx-motion-editor` entry in `Cargo.lock`, `PRODUCT_VERSION` in `scripts/macos-release.sh`.
- Harden `scripts/macos-release.sh`: single `PRODUCT_VERSION` source, no `_0.8.0_` literals, extended credential-free preflight (version agreement, beforeBuildCommand/frontendDist contract, bundle.icon, generated icons, ICNS signature, canonical 1024x1024 PNG, codesign PATH), PATH prefix `/usr/bin:/bin:/usr/sbin:/sbin` for the Tauri build, extended `verify_app()` metadata checks (CFBundleShortVersionString, CFBundleVersion, CFBundleIconFile, ICNS presence/non-empty/signature) applied to both local release and verify-downloaded.
- Add failing-first regression tests: `app/src/viteBuild.test.ts` (Rollup input contains both entries; build emits index.html + referenced assets + project-*.js) and `app/src/releaseContract.test.ts` (version consistency, icon contract, ICNS signature, no hardcoded `_0.8.0_`, PATH ordering).
- Update `docs/macos-signed-release.md` and `docs/macos-developer-id-setup.md` truthfully about the v0.8.0 failure and the v0.8.1 hotfix.
- Atomic commits: (1) fix(build) frontend, (2) fix(macOS) icons, (3) fix(release) script+versions+tests, (4) docs(release).

Out of scope (user-owned): Apple credentials/certificates, credentialed signing/notarization, tag creation, GitHub release operations, download verification, visible native UAT, dev server, Vitest watch mode. The v0.8.0 tag must stay pinned to 9dd274d7d32e88d1b2eb24a589adcfa278907cbf.

</domain>

<decisions>
## Implementation Decisions

### Mobile icon output
- Track desktop icon files only. After `tauri icon` generation, do not track `icons/ios` and `icons/android` output (gitignore or delete). Keep only the files referenced by the `bundle.icon` array plus the canonical source.

### Test build side effects
- `viteBuild.test.ts` overrides the build outDir to a temp directory inside the test. Real production build, but hermetic — does not clobber `app/dist` and can run alongside dev artifacts.

### Codesign PATH check
- Preflight uses simulated resolution: `PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign` must print `/usr/bin/codesign`, otherwise preflight rejects. This proves actual runtime resolution, not just string ordering.

### Docs shape
- Append a "v0.8.1 packaging hotfix" section to both docs describing what failed (missing frontend entry, placeholder icon, codesign wrapper resolution) and what the pipeline now validates. Keep existing flow text.

### Claude's Discretion
- Exact test file internals, guard implementation detail (writeBundle vs equivalent), preflight error message wording, commit message body details — all within the boundaries above and the brief's stated requirements.

</decisions>

<specifics>
## Specific Ideas

- Bundle guard must make `pnpm --dir app build` fail before Tauri compilation/signing/packaging can start: reject when index.html missing/empty, no local module script referenced, or a referenced local JS/CSS asset is missing.
- Do not modify `app/index.html` unless a failing test proves it necessary.
- Do not remove `motion-canvas:project`; reuse the existing local plugin with `enforce: "post"`, preserve every Motion Canvas input, add an `app` entry with the absolute `app/index.html` path, fail loudly if the contributed input shape changes unexpectedly.
- Version bump must NOT globally replace `0.8.0` in Cargo.lock (dependencies legitimately use it) and must not touch historical milestone artifacts.

</specifics>

<canonical_refs>
## Canonical References

- User brief (this quick task invocation) — locked requirements, verification commands, commit shape, and handoff checklist.
- v0.8.0 tag must continue resolving to commit 9dd274d7d32e88d1b2eb24a589adcfa278907cbf.

</canonical_refs>
