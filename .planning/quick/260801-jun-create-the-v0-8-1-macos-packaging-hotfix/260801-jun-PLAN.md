---
phase: quick-260801-jun
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/vite.config.ts
  - app/src/viteBuild.test.ts
  - app/src/releaseContract.test.ts
  - app/src-tauri/tauri.conf.json
  - app/src-tauri/icons/32x32.png
  - app/src-tauri/icons/128x128.png
  - app/src-tauri/icons/128x128@2x.png
  - app/src-tauri/icons/icon.icns
  - app/src-tauri/icons/icon.ico
  - app/package.json
  - app/src-tauri/Cargo.toml
  - app/src-tauri/Cargo.lock
  - scripts/macos-release.sh
  - docs/macos-signed-release.md
  - docs/macos-developer-id-setup.md
autonomous: true
requirements:
  - QUICK-260801-jun

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "pnpm --dir app build emits app/dist/index.html plus every asset it references and a project-*.js bundle, while preserving the Motion Canvas project entry"
    - "pnpm --dir app build fails (before any Tauri step) when index.html is missing/empty, references no local module script, or references a missing local asset"
    - "The real EFX icon set exists under app/src-tauri/icons and tauri.conf.json bundle.icon names exactly the 5 desktop files"
    - "All product-owned version surfaces read 0.8.1 and no other Cargo.lock entry changed"
    - "bash scripts/macos-release.sh preflight passes credential-free and rejects version/icon/codesign-PATH drift"
    - "The v0.8.0 tag still resolves to 9dd274d7d32e88d1b2eb24a589adcfa278907cbf"
  artifacts:
    - app/vite.config.ts (post plugin merges rollup input + returns esbuild jsxImportSource; writeBundle guard)
    - app/dist/index.html (real production build output)
    - app/src/viteBuild.test.ts
    - app/src/releaseContract.test.ts
    - app/src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.icns,icon.ico}
    - app/src-tauri/tauri.conf.json (version 0.8.1 + bundle.icon array)
    - scripts/macos-release.sh (PRODUCT_VERSION 0.8.1, hardened preflight/verify_app)
    - docs/macos-signed-release.md and docs/macos-developer-id-setup.md (hotfix section)
  key_links:
    - "post plugin config-hook return -> merged rollupOptions.input (MC entries + app/index.html) AND esbuild.jsxImportSource 'preact' (both halves required; input-only fix provably fails per RESEARCH)"
    - "writeBundle guard -> vite build failure -> beforeBuildCommand failure -> Tauri build never starts"
    - "tauri.conf.json bundle.icon array <-> generated files on disk <-> preflight icon checks"
    - "PRODUCT_VERSION in macos-release.sh <-> tauri.conf.json version check (dynamic, no hardcoded version literal) <-> DMG glob interpolation"
---

<objective>
Ship the v0.8.1 macOS packaging hotfix: repair the Vite production entry (both the rollup-input merge and the esbuild jsxImportSource repair relocated into the post plugin's config-hook return, per RESEARCH — the input-only fix provably fails), add a fail-closed bundle guard, generate/configure the real EFX icon set, bump product version surfaces to 0.8.1, harden scripts/macos-release.sh, add failing-first regression tests, and document the hotfix.

Purpose: v0.8.0 packaged an app with no frontend entry (missing dist/index.html) and a placeholder icon; this hotfix makes the packaging contract fail-closed so it cannot recur silently.
Output: 4 atomic commits — (1) fix(build): preserve editor HTML in production bundles, (2) fix(macOS): generate and configure EFX application icons, (3) fix(release): harden the v0.8.1 macOS release contract, (4) docs(release): document the v0.8.1 packaging hotfix.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260801-jun-create-the-v0-8-1-macos-packaging-hotfix/260801-jun-CONTEXT.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260801-jun-create-the-v0-8-1-macos-packaging-hotfix/260801-jun-RESEARCH.md
@/Users/lmarques/Dev/efx-motion-editor/app/vite.config.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/tauri.conf.json
@/Users/lmarques/Dev/efx-motion-editor/scripts/macos-release.sh
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix Vite production entry + fail-closed bundle guard (failing-first test)</name>
  <files>app/vite.config.ts, app/src/viteBuild.test.ts</files>
  <behavior>
    - Test A (RED first): a real production `build()` from vite with the app config and a hermetic temp outDir produces an input shape containing BOTH the Motion Canvas entry (key `src/project`, value `./src/project.ts?project`) and an `app` entry pointing at the absolute app/index.html path. Capture the input by injecting a capture plugin (enforce 'post') that records `config.build.rollupOptions.input` in its `configResolved`. Against current config this fails: input has only the MC entry.
    - Test B (RED first): the same build emits a non-empty index.html in the temp outDir, every local `src=`/`href=` reference in that HTML resolves to an existing non-empty file under the outDir, at least one `<script type="module">` ref exists, and a `project-*.js` bundle exists somewhere under the outDir (glob `**/project-*.js` — the slash in the input key relocates it under `src/`). Against current config this fails: no index.html is emitted.
    - Test C: the writeBundle guard rejects a broken bundle — after a successful build, delete or corrupt a referenced asset (or empty index.html) in a copied outDir, invoke the guard logic against it, expect an error. (Guard exported or factored so the test can exercise it without a second full build; implementation detail is discretion.)
    - Timeout: real cold production build takes ~60-90s — set explicit per-test timeout of at least 180_000 ms.
    - Hermeticity (CONTEXT-locked): test overrides `build.outDir` to `mkdtempSync(join(tmpdir(), 'efx-build-'))` with `emptyOutDir: true`; it must never touch app/dist.
  </behavior>
  <action>
    RED FIRST: write app/src/viteBuild.test.ts per the behavior block (conventions: `import { describe, expect, it } from 'vitest'`, tests in app/src/*.test.ts, no vitest config file). Run `pnpm --dir app exec vitest run src/viteBuild.test.ts` and capture the expected failures (Tests A and B must fail against the current config). Do not proceed until the failure output is observed.

    GREEN: modify app/vite.config.ts:
    1. Extend the existing `fix-preact-optimize-conflict` post plugin (or add a sibling post plugin — discretion) so its `config` hook does BOTH of the following (RESEARCH: both halves are required; the input merge alone surfaces a latent jsx-runtime resolution failure):
       a. Read `config.build?.rollupOptions?.input` as contributed by `motion-canvas:project`; throw a descriptive error if it is absent, not a plain object, is an array, or any entry value is not a string ("fail loudly on unexpected input shape" per CONTEXT). Return `build.rollupOptions.input` as `{ ...input, app: fileURLToPath(new URL('./index.html', import.meta.url)) }` — preserving every MC entry verbatim. Do NOT remove `motion-canvas:project`; do NOT modify app/index.html unless a failing test proves it necessary.
       b. Return `esbuild: { jsx: 'automatic', jsxImportSource: 'preact' }` from the SAME config hook. Vite's vite:esbuild plugin snapshots `config.esbuild` at plugin-creation time, so the existing `configResolved` mutation at lines 52-55 is a no-op — delete that dead mutation (and fix its misleading comment). Post-plugin config-hook returns merge after MC's normal plugin, so this value wins; scene files keep MC's runtime via their per-file pragmas. Keep the existing optimizeDeps exclude repair (config-hook return + configResolved splice) unchanged.
    2. Add a `writeBundle(outputOptions)` hook on the same (or sibling) post plugin implementing the fail-closed bundle guard: resolve the outDir (from `outputOptions.dir`, else configResolved-captured `config.build.outDir` + `config.root`); fail via `this.error(...)`/throw when index.html is missing or empty, when the HTML references no local `<script type="module" src=...>`, or when any referenced local `src=`/`href=` asset (skip `http:`/`data:`/`#`, strip leading `/`) does not resolve to an existing non-empty file under the outDir. Targeted regex extraction is sufficient (RESEARCH Don't-Hand-Roll). The guard runs inside the same build, never as a post-build script against possibly-stale app/dist.
    3. Optional code comment noting MC's `build.target: 'modules'` silently overrides the user `target: 'safari13'` (pre-existing, out of scope — do not change behavior).

    Run `pnpm --dir app exec vitest run src/viteBuild.test.ts` to green, then run a real `pnpm --dir app build` and confirm app/dist/index.html exists, is non-empty, references hashed local assets that all exist, and `dist/src/project-*.js` (or `dist/**/project-*.js`) exists.

    COMMIT 1: stage app/vite.config.ts, app/src/viteBuild.test.ts, and the regenerated app/dist output ONLY if dist is tracked (check `git ls-files app/dist` first; if untracked/ignored, do not force-add). Commit message: `fix(build): preserve editor HTML in production bundles`.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/viteBuild.test.ts && pnpm --dir app build && test -s app/dist/index.html && node -e "const fs=require('fs'),p=require('path');const html=fs.readFileSync('app/dist/index.html','utf8');if(!/type=\"module\"/.test(html))process.exit(1);const refs=[...html.matchAll(/(?:src|href)=\"(\/[^\"]+)\"/g)].map(m=>m[1].slice(1));if(refs.length===0)process.exit(1);for(const r of refs){const f=p.join('app/dist',r);if(!fs.existsSync(f)||fs.statSync(f).size===0){console.error('missing',r);process.exit(1)}}console.log('dist contract OK',refs.length,'refs')" && ls app/dist/src/project-*.js >/dev/null</automated>
  </verify>
  <done>
    Failing-first evidence captured (Tests A/B red against the old config, green after). vitest run on the new file passes; real `pnpm --dir app build` emits non-empty app/dist/index.html whose every referenced local asset exists on disk, plus a project-*.js bundle; guard fails the build when the bundle is broken. Commit 1 created with only the intended files.
  </done>
</task>

<task type="auto">
  <name>Task 2: Generate and configure the real EFX Tauri icon set</name>
  <files>app/src-tauri/icons/32x32.png, app/src-tauri/icons/128x128.png, app/src-tauri/icons/128x128@2x.png, app/src-tauri/icons/icon.icns, app/src-tauri/icons/icon.ico, app/src-tauri/tauri.conf.json</files>
  <precondition>SPECS/efxmotioneditor-icon.png exists (1024x1024 RGBA PNG, gitignored) and @tauri-apps/cli is installed in app/.</precondition>
  <action>
    1. Copy SPECS/efxmotioneditor-icon.png to app/src-tauri/app-icon.png (untracked scratch input, per RESEARCH A3 — do not commit it).
    2. Run `pnpm --dir app tauri icon src-tauri/app-icon.png` (generates into app/src-tauri/icons/, overwriting the 559-byte placeholder icon.png).
    3. Desktop-only tracking (CONTEXT-locked): delete the non-referenced outputs — icons/ios/, icons/android/, icons/64x64.png, icons/StoreLogo.png, icons/Square*Logo.png, and the placeholder icons/icon.png (it is not in the 5-file contract). No .gitignore file exists and deletion is the chosen path — do not create one.
    4. Edit app/src-tauri/tauri.conf.json: add to `bundle` the exact 5-file array (template convention; Tauri v2 schema default is an empty array, so it must be explicit):
       "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
    5. Sanity: each of the 5 files exists and is non-empty; icon.icns starts with the 4 bytes `icns` (check with `head -c 4 app/src-tauri/icons/icon.icns`).
    COMMIT 2: stage the 5 icon files + tauri.conf.json. Commit message: `fix(macOS): generate and configure EFX application icons`. Do not stage app-icon.png, ios/, or android/ output.
  </action>
  <verify>
    <automated>test -s app/src-tauri/icons/32x32.png && test -s app/src-tauri/icons/128x128.png && test -s 'app/src-tauri/icons/128x128@2x.png' && test -s app/src-tauri/icons/icon.icns && test -s app/src-tauri/icons/icon.ico && head -c 4 app/src-tauri/icons/icon.icns | grep -q icns && node -e "const c=require('/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/tauri.conf.json');const want=['icons/32x32.png','icons/128x128.png','icons/128x128@2x.png','icons/icon.icns','icons/icon.ico'];if(JSON.stringify(c.bundle.icon)!==JSON.stringify(want)){console.error(c.bundle.icon);process.exit(1)}console.log('icon contract OK')" && test ! -d app/src-tauri/icons/ios && test ! -d app/src-tauri/icons/android</automated>
  </verify>
  <done>
    The 5 desktop icon files are real generated EFX icons (ICNS magic verified), tauri.conf.json bundle.icon names exactly those 5 in order, ios/android/64x64/StoreLogo/Square*/placeholder outputs are absent, and Commit 2 contains only the 5 icons + tauri.conf.json.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Harden release script + bump versions to 0.8.1 (failing-first contract test) + docs</name>
  <files>app/src/releaseContract.test.ts, scripts/macos-release.sh, app/package.json, app/src-tauri/tauri.conf.json, app/src-tauri/Cargo.toml, app/src-tauri/Cargo.lock, docs/macos-signed-release.md, docs/macos-developer-id-setup.md</files>
  <behavior>
    - Test D (RED first): version consistency — app/package.json version, tauri.conf.json version, the efx-motion-editor package version in app/src-tauri/Cargo.toml, the efx-motion-editor entry version in app/src-tauri/Cargo.lock, and PRODUCT_VERSION extracted from scripts/macos-release.sh all equal the version declared in app/package.json (single-source assertion, not a hardcoded string). RED against current state after the script/conf bumps... note ordering: write the test first; it is red now (script still on the old version while package surfaces change — see action ordering) and green at the end.
    - Test E (RED first): icon contract — tauri.conf.json bundle.icon equals the exact 5-file array; each referenced file exists non-empty under app/src-tauri; icon.icns has `icns` magic. Green already after Task 2 (that is fine — it guards regression).
    - Test F (RED first): script text contains no version-flanked DMG glob literal pinning the previous release version (i.e. the glob must interpolate PRODUCT_VERSION), and `validate_tauri_config` does not hardcode a version string (it must compare against the passed PRODUCT_VERSION). RED against the current script.
    - Test G: PATH ordering — the script prefixes `/usr/bin:/bin:/usr/sbin:/sbin` on the Tauri build invocation AND preflight contains the simulated codesign resolution check; simulated check passes on this machine: `PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign` prints `/usr/bin/codesign`.
    - Test file is pure fs/JSON/text assertions (no build) — fast, no special timeout needed.
  </behavior>
  <action>
    RED FIRST: write app/src/releaseContract.test.ts per the behavior block. Run `pnpm --dir app exec vitest run src/releaseContract.test.ts` and capture expected failures (Tests D and F must fail against the current 0.8.0-pinned script).

    GREEN — version bumps (CONTEXT-locked surfaces ONLY):
    1. app/package.json: version -> 0.8.1.
    2. app/src-tauri/tauri.conf.json: version -> 0.8.1.
    3. app/src-tauri/Cargo.toml: package version -> 0.8.1.
    4. app/src-tauri/Cargo.lock: change ONLY the version field inside the `name = "efx-motion-editor"` block (around lines 971-972). NEVER a global replace of the old version string — dependencies legitimately contain it. Prefer a targeted edit or `cargo update -p efx-motion-editor --precise 0.8.1`-style tooling-free manual edit; verify with `git diff app/src-tauri/Cargo.lock` that exactly one version line changed.
    5. scripts/macos-release.sh line 10: PRODUCT_VERSION -> "0.8.1" (single source).

    GREEN — script hardening (all in scripts/macos-release.sh, preserving existing fail-loud style and the private-asset guards untouched):
    6. `validate_tauri_config` (lines 93-123): pass `"$PRODUCT_VERSION"` as an argv to the node heredoc and compare `config.version` dynamically — remove the hardcoded version string. Extend the same node script to also require: `build.beforeBuildCommand === 'pnpm build'`; `build.frontendDist === '../dist'`; `bundle.icon` deep-equals the exact 5-file array; each referenced icon file exists under TAURI_DIR and is non-empty; icon.icns begins with the `icns` magic bytes. Add a shell-level check that SPECS/efxmotioneditor-icon.png exists and is 1024x1024 RGBA (use `sips -g pixelWidth -g pixelHeight -g hasAlpha` — dependency-free on macOS).
    7. `run_preflight` (after executable probes): add the CONTEXT-locked simulated codesign resolution check — `PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign` must print exactly `/usr/bin/codesign`, otherwise die. This proves runtime resolution, not string ordering.
    8. Tauri build invocation in `run_release` (line 345): prefix the environment so Tauri's internal codesign calls resolve system binaries first: `PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" "$PNPM_BIN" --dir "$REPO_ROOT/app" tauri build --bundles app,dmg --ci`.
    9. DMG glob in `find_release_artifacts` (line 294): replace the version-flanked literal with `"*_${PRODUCT_VERSION}_*.dmg"` interpolation.
    10. `verify_app()` (lines 258-272): extend with Info.plist metadata checks — extract `CFBundleShortVersionString` via `$PLUTIL -extract CFBundleShortVersionString raw -o - "$app_path/Contents/Info.plist"` and require it equals `$PRODUCT_VERSION`; require `CFBundleVersion` and `CFBundleIconFile` are present; then require `Contents/Resources/<CFBundleIconFile>` exists, is non-empty, and has `icns` magic. One edit covers both run_release and run_verify_downloaded call sites.

    Validate: `bash -n scripts/macos-release.sh`, then `bash scripts/macos-release.sh preflight` must PASS credential-free (it does not touch Apple credentials — that is a hard boundary; never run `release` or `verify-downloaded`).

    DOCS (CONTEXT-locked shape): append a "v0.8.1 packaging hotfix" section to BOTH docs/macos-signed-release.md and docs/macos-developer-id-setup.md. Describe truthfully what failed in v0.8.0 (missing frontend entry — no dist/index.html emitted; placeholder icon; codesign wrapper resolution via PATH) and what the pipeline now validates (bundle guard, icon contract, version agreement, simulated codesign resolution, extended verify_app metadata). Keep all existing flow text intact; do not edit historical milestone artifacts elsewhere.

    COMMITS 3 and 4: Commit 3 — `fix(release): harden the v0.8.1 macOS release contract` staging scripts/macos-release.sh, the four version-bump files, and app/src/releaseContract.test.ts. Commit 4 — `docs(release): document the v0.8.1 packaging hotfix` staging the two docs files. Never create tags, never push, never touch GitHub releases.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/releaseContract.test.ts && bash -n scripts/macos-release.sh && bash scripts/macos-release.sh preflight && git diff --stat v0.8.0 -- app/src-tauri/Cargo.lock | grep -q 'Cargo.lock' && test "$(git rev-parse 'v0.8.0^{commit}')" = "9dd274d7d32e88d1b2eb24a589adcfa278907cbf"</automated>
  </verify>
  <done>
    Failing-first evidence captured (Tests D/F red, then green). All five version surfaces read 0.8.1; Cargo.lock diff shows exactly one changed version line; the script has no hardcoded prior-version literal (version check is dynamic, DMG glob interpolates PRODUCT_VERSION); preflight passes and enforces the icon contract, config contract, and simulated codesign resolution; verify_app checks plist metadata + icon file; both docs carry the hotfix section with existing text intact; Commits 3 and 4 created; v0.8.0 tag still resolves to 9dd274d7d32e88d1b2eb24a589adcfa278907cbf.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| PATH → Tauri/codesign | Tauri build shells out to codesign/security; a shadowed PATH could substitute malicious binaries |
| Generated icons → signed bundle | A placeholder or corrupted icon ships inside a signed, notarized artifact |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-jun-01 | Tampering | codesign resolution during Tauri build | high | mitigate | PATH prefix `/usr/bin:/bin:/usr/sbin:/sbin` on the Tauri build invocation + simulated-resolution preflight check requiring `/usr/bin/codesign` (Task 3, items 7-8) |
| T-jun-02 | Tampering/Repudiation | icon set in signed bundle | medium | mitigate | ICNS magic-byte + non-empty checks in preflight validate_tauri_config and in verify_app() against the packaged app (Task 3, items 6 and 10) |
| T-jun-03 | Tampering | silent broken frontend in release | critical | mitigate | fail-closed writeBundle guard inside vite build — release cannot start with missing/empty index.html or dangling asset refs (Task 1) |
</threat_model>

<verification>
Final battery (run in order, all must pass):

1. `pnpm --dir app exec vitest run src/viteBuild.test.ts src/releaseContract.test.ts`
2. `pnpm --dir app exec vitest run` (full suite incl. existing main.test.ts)
3. `pnpm --dir app run typecheck`
4. `pnpm build` (workspace build) and confirm `app/dist/index.html` non-empty + all referenced local assets exist + `app/dist/**/project-*.js` exists
5. `cargo test --manifest-path app/src-tauri/Cargo.toml`
6. `bash -n scripts/macos-release.sh`
7. `bash scripts/macos-release.sh preflight` (credential-free — must print PREFLIGHT PASS)
8. `test "$(git rev-parse 'v0.8.0^{commit}')" = "9dd274d7d32e88d1b2eb24a589adcfa278907cbf"`
9. `git log --oneline -4` shows the four atomic commits in order: fix(build), fix(macOS), fix(release), docs(release)

Hard boundaries re-check: no Apple credential files accessed, no `release`/`verify-downloaded` run, no tags created, no pushes, no dev server started, no Vitest watch mode, no global version replace in Cargo.lock, no historical milestone artifacts edited.
</verification>

<success_criteria>
- Production build emits a complete frontend (index.html + assets + project bundle) and the guard makes any regression fail the build before Tauri packaging.
- Real EFX icons are generated, configured, and enforced by preflight.
- All version surfaces read 0.8.1 with a single-source PRODUCT_VERSION and a Cargo.lock diff of exactly one line.
- Both regression test files exist, were red before the fixes, and are green now; full gates (tests, typecheck, workspace build, cargo test, bash -n, preflight) pass.
- Four atomic commits exist in the specified order; v0.8.0 tag remains pinned to 9dd274d7.
</success_criteria>

<output>
Create `.planning/quick/260801-jun-create-the-v0-8-1-macos-packaging-hotfix/260801-jun-SUMMARY.md` when done, including: failing-first evidence (red outputs), the four commit hashes, final verification battery results, and the handoff note that credentialed signing/notarization, tag creation, and native UAT remain user-owned.
</output>
