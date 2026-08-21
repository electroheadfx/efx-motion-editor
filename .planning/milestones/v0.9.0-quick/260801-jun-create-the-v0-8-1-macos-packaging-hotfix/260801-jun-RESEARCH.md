# Quick Task 260801-jun: v0.8.1 macOS Packaging Hotfix - Research

**Researched:** 2026-08-01
**Domain:** Vite 5 production build (Motion Canvas plugin interplay), Tauri v2 bundling/icons, bash release-pipeline hardening, Vitest source-contract tests
**Confidence:** HIGH (core fix empirically validated by a real production build this session)

## Summary

The v0.8.0 root cause is confirmed in source: `motion-canvas:project` (in `@efxlab/motion-canvas-vite-plugin@4.0.0`) contributes `build.rollupOptions.input` as an object via its `config` hook. When `rollupOptions.input` is set, Vite skips its default `resolve("index.html")` input (vite/dist `build.ts`), so `app/dist/` contains only the project bundle and assets — no `index.html`. Current `app/dist/` on disk confirms this (only `img/` and `src/`).

The fix is **empirically validated**: an `enforce: "post"` plugin whose `config` hook reads the contributed input `{"src/project":"./src/project.ts?project"}`, spreads it, and adds `app: <abs path>/app/index.html` produces `dist/index.html` (763 bytes) with hashed module-script refs, plus `dist/src/project-*.js` and all assets. The probe build this session wrote exactly that to a temp outDir.

**However, the naive input fix alone is not sufficient.** Adding the HTML entry surfaces a second, latent failure: `Rollup failed to resolve import "@efxlab/motion-canvas-2d/lib/jsx-runtime" from "packages/efx-physic-paint/src/preact.tsx"`. The JSX-runtime repair in `app/vite.config.ts` (mutating `config.esbuild.jsxImportSource` in `configResolved`, lines 52-55) is a **no-op**: Vite's `vite:esbuild` plugin destructures `config.esbuild` at plugin-creation time (vite/dist dep chunk, `esbuildPlugin` line ~19265), which happens *before* any user `configResolved` hook runs. The repair must instead be **returned from the post plugin's `config` hook** (`esbuild: { jsx: 'automatic', jsxImportSource: 'preact' }`) — post plugin config hooks run after MC's normal plugin, so the value wins. Validated: with both changes the full production build completes with only benign dynamic-import warnings.

**Primary recommendation:** Extend the existing `fix-preact-optimize-conflict` post plugin (or a sibling post plugin) to (a) return merged `rollupOptions.input` preserving every MC entry plus `app` → absolute `app/index.html`, failing loudly on unexpected input shape, and (b) return `esbuild: { jsx: 'automatic', jsxImportSource: 'preact' }` from the same `config` hook, replacing the ineffective `configResolved` mutation. Add a `writeBundle` bundle guard that fails the build when `index.html` is missing/empty, references no local module script, or references a missing local asset.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Track desktop icon files only; after `tauri icon` generation do not track `icons/ios` and `icons/android` (gitignore or delete). Keep only files referenced by `bundle.icon` plus the canonical source.
- `viteBuild.test.ts` overrides build outDir to a temp directory (hermetic; must not clobber `app/dist`).
- Codesign preflight check uses simulated resolution: `PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign` must print `/usr/bin/codesign`.
- Docs: append a "v0.8.1 packaging hotfix" section to both docs; keep existing flow text.
- Atomic commits: (1) fix(build) frontend, (2) fix(macOS) icons, (3) fix(release) script+versions+tests, (4) docs(release).
- Version bump touches ONLY: `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, the `efx-motion-editor` entry in `Cargo.lock`, `PRODUCT_VERSION` in `scripts/macos-release.sh`. No global `0.8.0` replacement in Cargo.lock.
- Do not modify `app/index.html` unless a failing test proves it necessary. Do not remove `motion-canvas:project`. Preserve every MC input; add `app` entry with absolute path; fail loudly on unexpected input shape.
- Out of scope: Apple credentials, credentialed signing/notarization, tags, GitHub releases, download verification, native UAT, dev server, Vitest watch mode. v0.8.0 tag stays pinned to 9dd274d7d32e88d1b2eb24a589adcfa278907cbf.

### Claude's Discretion
- Exact test internals, guard hook choice (writeBundle vs equivalent), preflight error wording, commit message bodies.

### Deferred Ideas (OUT OF SCOPE)
- None stated beyond the exclusions above.
</user_constraints>

## Motion Canvas Plugin Interplay (the core finding)

### What `motion-canvas:project` actually contributes

[VERIFIED: app/node_modules/@efxlab/motion-canvas-vite-plugin/lib/partials/projects.js:60-85] The plugin uses a **`config` hook** (not `configResolved`) and returns:

```js
// verbatim from partials/projects.js config() return:
build: {
  target: buildForEditor ? 'esnext' : 'modules',
  assetsDir: './',
  rollupOptions: {
    preserveEntrySignatures: 'strict',
    input: Object.fromEntries(projects.map(project => [
      project.name,
      project.filePath + '?project',
    ])),
  },
},
esbuild: { jsx: 'automatic', jsxImportSource: '@efxlab/motion-canvas-2d/lib' },
optimizeDeps: { entries: ..., exclude: ['preact', 'preact/*', '@preact/signals'] },
```

Input key derivation [VERIFIED: lib/utils.js:16-33]: `name = metaData?.name ?? url` where `url = path.posix.join(dir, name)`. `app/src/project.meta` has **no `name` field** (read this session), so the key is the path-like string `"src/project"` (contains a slash — this is why the project bundle emits at `dist/src/project-*.js`). Value is the **relative, query-suffixed** string `./src/project.ts?project`.

Empirically confirmed by probe (`configResolved` log): contributed input shape is exactly `{"src/project":"./src/project.ts?project"}`; resolved `assetsDir` is `"./"`; `preserveEntrySignatures` is `strict`.

### Vite merge semantics that govern the fix

[VERIFIED: app/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js]

- `runConfigHook` (line 66998-67011): `conf = mergeConfig(conf, res)` — plugin `config`-hook returns are the **overrides**, so plugin-returned config wins over the user config file on scalar conflicts, and post plugins win over normal plugins. Consequences:
  - MC's `build.target: 'modules'` silently overrides the user config's `target: 'safari13'` (probe resolved target: `['es2020','edge88','firefox78','chrome87','safari14']`). Pre-existing behavior; **out of scope** but worth a code comment.
  - A post plugin returning `esbuild.jsxImportSource: 'preact'` correctly overrides MC's `'@efxlab/motion-canvas-2d/lib'`.
- Default input skip (line 65526): `options.rollupOptions?.input || resolve("index.html")` — setting `input` anywhere removes the HTML entry. Root cause of the missing `dist/index.html`.
- `esbuildPlugin` (line 19264-19266): `const options = config.esbuild; const { jsxInject, include, exclude, ...rest } = options;` — **destructured at plugin-creation time**, before user `configResolved` hooks run. Mutating `config.esbuild` in `configResolved` (current vite.config.ts lines 52-55) therefore has **no effect** on transforms.

### The second (latent) failure the planner must know about

With only the input fix, the build fails: `Rollup failed to resolve import "@efxlab/motion-canvas-2d/lib/jsx-runtime" from ".../packages/efx-physic-paint/src/preact.tsx"`. Root cause chain:

1. MC's `jsxImportSource: '@efxlab/motion-canvas-2d/lib'` wins in the merged esbuild config (see above).
2. Every `.tsx` without a pragma gets `import { jsx } from '@efxlab/motion-canvas-2d/lib/jsx-runtime'` injected — including workspace files like `packages/efx-physic-paint/src/preact.tsx` (no pragma; verified by grep).
3. pnpm strict layout: `@efxlab/motion-canvas-2d` exists only under `app/node_modules` (app's dependency) and the hidden hoist `node_modules/.pnpm/node_modules` — **not** reachable by upward `node_modules` walk from `packages/efx-physic-paint/` (its own node_modules contains only preact/tsup/typescript/vite; its package.json does not depend on MC). Rollup build resolution fails; dev resolution survives via the pnpm hidden hoist. [VERIFIED: filesystem inspection this session]

Fix (validated): return `esbuild: { jsx: 'automatic', jsxImportSource: 'preact' }` from the post plugin's `config` hook. Scene files keep MC's runtime via their existing per-file pragmas — [VERIFIED: app/src/scenes/testScene.tsx:1 and previewScene.tsx:1 both start with `/** @jsxImportSource @efxlab/motion-canvas-2d/lib */`], and esbuild per-file pragmas override config. `mergeConfig` preserves `@preact/preset-vite`'s other esbuild keys (e.g. `jsxInject`) since only the two returned keys are overridden.

### Validated output shape (probe build, temp outDir)

```
dist/index.html                      763 bytes
dist/index-hK7g08tz.js               <- module script ref'd as src="/index-*.js"
dist/index-CExzPZlb.js
dist/_commonjsHelpers-BEKB6BXw.js    <- modulepreload ref
dist/index-Dgsx0_Gh.css              <- link ref
dist/src/project-Che8Jrrs.js         <- MC project bundle (slash in input key)
dist/PhysicsPaintStudio-*.js/.css, dist/strokeAnimation-*.js
dist/img/paper_*.jpg                 <- assetsDir './' puts assets at outDir root
```

Notes for tests:
- Project bundle assertion must glob `**/project-*.js` (it lands under `src/`, not outDir root).
- Emitted `index.html` references assets with **absolute** paths (`/index-*.js`) because `base` is unset — matches the create-tauri-app v2 template default (no `base`); Tauri v2 serves `frontendDist` at the protocol root. Loading in the packaged app is user-owned native UAT.
- HTML output location is derived from the input file path relative to root, not the input key; `app` as key is fine.
- `preserveEntrySignatures: 'strict'` coexists fine with the HTML facade entry (probe built clean).
- When a test overrides `outDir` to a path **outside** the project root, set `emptyOutDir: true` explicitly (Vite only defaults it for in-root outDirs).

## Production Bundle Guard

**Recommended hook: `writeBundle`.** Rationale:

- `writeBundle` runs after all files are on disk — fs checks (`existsSync`, non-empty, parse HTML for `<script type="module" src=...>` and `<link rel="stylesheet" href=...>`, verify each referenced local file exists under outDir) are trivially correct.
- `generateBundle` would also work for the HTML content itself: user post plugins run **after** `vite:build-html` in Vite's plugin order (build core plugins precede post user plugins), and `vite:build-html` emits the final hashed-ref HTML asset in its own `generateBundle` — so a post plugin's `generateBundle` sees final HTML. But asset-on-disk verification still needs `writeBundle`.
- `closeBundle` is too late and watch-mode-flavored; avoid.

Implementation shape: in the same (or a sibling) post plugin, `writeBundle(outputOptions)` → resolve `outDir` (from `outputOptions.dir` or `configResolved`-captured `config.build.outDir` + `config.root`), check `index.html` exists and is non-empty, extract local `src=`/`href=` refs (skip `http:`, `data:`, `#`), strip leading `/`, assert each resolves to an existing non-empty file under outDir, and `this.error(...)` (or throw) on any violation — this fails `vite build`, hence `pnpm --dir app build`, hence `beforeBuildCommand`, before any Tauri compilation/signing. Also assert at least one `type="module"` script ref exists. [ASSUMED: exact regex/parsing detail — implementation discretion]

## Tauri Icon Behavior

Empirically generated this session: `app/node_modules/.bin/tauri icon SPECS/efxmotioneditor-icon.png -o <tmpdir>` (Tauri CLI from `@tauri-apps/cli@^2.10.0`, binary run, no build). Generated tree:

- Desktop-relevant: `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, `icon.png`, `StoreLogo.png`, `Square*Logo.png` (9 Windows Store logos)
- `ios/` — 18 AppIcon PNGs
- `android/` — mipmap PNGs + XML
- Default output (no `-o`): `icons/` next to `tauri.conf.json` → `app/src-tauri/icons/`, **overwriting** the tracked placeholder `icon.png` (currently a 559-byte 128x128 PNG dated 2026-04-03). [VERIFIED: fs + CLI help output]

**ICNS signature:** generated `icon.icns` begins with bytes `69 63 6e 73` = ASCII `"icns"`. [VERIFIED: od dump this session] Shell check: `head -c 4 file | grep -q icns` or `od`.

**bundle.icon array (exact 5 files):** [CITED: github.com/tauri-apps/create-tauri-app `templates/_base_/src-tauri/%(v2)%tauri.conf.json.lte`, fetched raw this session]

```json
"icon": [
  "icons/32x32.png",
  "icons/128x128.png",
  "icons/128x128@2x.png",
  "icons/icon.icns",
  "icons/icon.ico"
]
```

Note: Tauri v2's config-schema default for `bundle.icon` is `[]` [CITED: v2.tauri.app/reference/config/#icon] — the 5-file array is template convention and must be set explicitly. `64x64.png`, `StoreLogo.png`, `Square*`, `ios/`, `android/` are **not** referenced → delete after generation (CONTEXT decision: track only the 5 + canonical source). Neither `app/.gitignore` nor `app/src-tauri/.gitignore` exists; if deletion is preferred over gitignore, no gitignore edit is needed. Canonical source `SPECS/efxmotioneditor-icon.png` is 1024x1024 RGBA PNG and SPECS is gitignored (root `.gitignore:36`) — both verified. `tauri icon src-tauri/app-icon.png` implies copying the SPECS PNG to `app/src-tauri/app-icon.png` first (untracked scratch input).

## Vitest Production-Build Test Pattern

Validated approach (the probe used exactly this):

```ts
import { build } from 'vite'; // vite 5.4.21 is an app devDependency
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = mkdtempSync(join(tmpdir(), 'efx-build-'));
await build({
  root: APP_DIR,                        // absolute path to app/
  configFile: join(APP_DIR, 'vite.config.ts'),
  logLevel: 'silent',
  build: { outDir, emptyOutDir: true }, // hermetic; never touches app/dist
});
```

- To assert "Rollup input contains both entries", inject a capture plugin into the inline `plugins` array (post enforce) and record `config.build.rollupOptions.input` in its `configResolved`.
- **Timeout:** a full production build here takes tens of seconds (probe: ~60-90 s cold). Vitest's default 5 s `testTimeout` will kill it — set an explicit timeout (e.g. `it('...', { timeout: 180_000 }, ...)` or file-level `describe` config).
- Existing conventions [VERIFIED: app/src/main.test.ts]: `import { describe, expect, it, vi } from 'vitest'`, tests live in `app/src/*.test.ts`, no vitest config file (Vitest reads `vite.config.ts`; no `test` field). Run with `pnpm --dir app vitest run` (CLAUDE.md: never watch mode).
- `releaseContract.test.ts` is pure fs/JSON assertions (no build) — fast; keep in a separate file as the brief specifies.

## macos-release.sh Integration Points

[VERIFIED: scripts/macos-release.sh, read this session]

| Line(s) | Current state | Hardening hook |
|---|---|---|
| 10 | `PRODUCT_VERSION="0.8.0"` | Bump to `0.8.1`; single source |
| 105 | `config.version !== '0.8.0'` hardcoded in `validate_tauri_config` node heredoc | Pass `$PRODUCT_VERSION` as argv to the node script; compare dynamically |
| 93-123 | `validate_tauri_config` checks productName/identifier/hardenedRuntime/resources | Extend: `build.beforeBuildCommand === 'pnpm build'`, `build.frontendDist === '../dist'`, `bundle.icon` equals the exact 5-file array, each icon file exists + non-empty, `icon.icns` has `icns` magic, canonical source PNG (SPECS) exists and is 1024x1024 RGBA (sips or od on IHDR) |
| 125-164 | `run_preflight` executable probes | Add simulated codesign resolution: `PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign` must print `/usr/bin/codesign` (CONTEXT-locked) |
| 294 | DMG glob `*/release/bundle/dmg/*_0.8.0_*.dmg` | Interpolate `"*_${PRODUCT_VERSION}_*.dmg"` |
| 345 | `"$PNPM_BIN" --dir "$REPO_ROOT/app" tauri build --bundles app,dmg --ci` | Prefix env: `PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" "$PNPM_BIN" ...` so Tauri's internal codesign invocations resolve system binaries first |
| 258-272 | `verify_app()` — signature/team/runtime/entitlements/spctl/stapler | Extend with Info.plist metadata via `$PLUTIL -extract ...` on `Contents/Info.plist`: `CFBundleShortVersionString == $PRODUCT_VERSION`, `CFBundleVersion` present, `CFBundleIconFile` present; and `Contents/Resources/<CFBundleIconFile>` exists, non-empty, `icns` magic. Called by both `run_release` (line 349) and `run_verify_downloaded` (line 389) — one edit covers both |

No conflicts with the planned hardening: pnpm/node are resolved via `require_command` (PATH lookup) at lines 137-138, and all Apple tools are already absolute-pinned (lines 13-21).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Multi-entry input merge | Custom merge logic | spread the contributed object + validate shape | `mergeConfig` deep-merges, but explicit construction satisfies the "fail loudly" requirement |
| ICNS/PNG sniffing | Image library | `head -c 4`/`od` magic-byte check; PNG IHDR width/height at fixed offsets (or `sips -g pixelWidth -g pixelHeight -g hasAlpha`) | Deterministic, dependency-free |
| Icon resizing | Any custom resizer | `tauri icon` CLI | Canonical Tauri toolchain, already validated |
| Bundle guard HTML parsing | Full HTML parser | Targeted regex for `<script ... src=` / `<link ... href=` | Guard only needs local asset refs |

## Common Pitfalls

1. **`configResolved` mutation of `config.esbuild` is a no-op** (vite:esbuild snapshots options at creation). This is the trap the current config already fell into — the comment "Restore Preact as default JSX runtime" is currently false. Fix must return esbuild config from a `config` hook.
2. **Input key with a slash** (`src/project`) silently relocates the emitted entry to `dist/src/`; tests globbing `dist/project-*.js` at the root will false-fail.
3. **Assuming plugin config loses to user config** — in Vite 5, plugin `config` hook returns override the config file; post plugins override normal plugins.
4. **`emptyOutDir` not defaulting** when a test overrides outDir outside root — builds will refuse or warn without it.
5. **Vitest default timeout** killing the real production build test.
6. **Cargo.lock global replace** — dependencies legitimately contain `0.8.0`; only the `name = "efx-motion-editor"` block's version (Cargo.lock lines 971-972) may change.
7. **Leaving `ios/`/`android/`/`64x64.png`/`StoreLogo.png`/`Square*` tracked** after `tauri icon` — CONTEXT locks desktop-only tracking.
8. **Guard passing on stale dist** — the guard must run inside the same build (writeBundle), not as a post-build script reading a possibly-stale `app/dist`.

## Code Example (validated probe shape)

```ts
// enforce: 'post' plugin — config hook (validated by real build this session)
{
  name: 'efx-production-entry',
  enforce: 'post' as const,
  config(config) {
    const input = config.build?.rollupOptions?.input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error(`Expected motion-canvas:project to contribute object rollupOptions.input, got: ${JSON.stringify(input)}`);
    }
    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== 'string') throw new Error(`Unexpected input entry ${key}: ${typeof value}`);
    }
    return {
      build: {
        rollupOptions: {
          input: { ...input, app: fileURLToPath(new URL('./index.html', import.meta.url)) },
        },
      },
      esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
    };
  },
}
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | build/tests/script probes | ✓ | v24.15.0 | — |
| pnpm | all commands | ✓ | 10.27.0 | — |
| Tauri CLI | `tauri icon` | ✓ (ran this session) | @tauri-apps/cli ^2.10.0 | — |
| Vite `build()` API | viteBuild.test.ts | ✓ (validated) | vite 5.4.21 | — |
| macOS tooling (codesign/plutil/sips) | preflight/verify | ✓ platform is Darwin 24.6.0 | — | — |
| SPECS/efxmotioneditor-icon.png | icon generation | ✓ 1024x1024 RGBA PNG, gitignored | — | — |

No missing dependencies.

## Package Legitimacy Audit

**No new packages installed by this phase.** All work uses existing devDependencies (vite, vitest, @tauri-apps/cli) — audit not applicable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (vite 5.4.21) |
| Config file | none (Vitest reads `app/vite.config.ts`; no `test` field) |
| Quick run command | `pnpm --dir app vitest run src/viteBuild.test.ts src/releaseContract.test.ts` |
| Full suite command | `pnpm --dir app vitest run` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|
| Rollup input contains both entries | integration (real build) | `pnpm --dir app vitest run src/viteBuild.test.ts` | ❌ Wave 0/new |
| Build emits index.html + referenced assets + project-*.js | integration (real build) | same file, temp outDir | ❌ new |
| Bundle guard fails on missing/broken index.html | unit/integration (guard in isolation or fixture) | same file | ❌ new |
| Version consistency (package.json/tauri.conf/Cargo.toml+lock/PRODUCT_VERSION) | contract | `pnpm --dir app vitest run src/releaseContract.test.ts` | ❌ new |
| Icon contract (5-file array, files exist, ICNS magic) | contract | same file | ❌ new |
| No `_0.8.0_` literal; PATH ordering in script | contract (script text + simulated resolution) | same file | ❌ new |

### Sampling Rate
- **Per task commit:** `pnpm --dir app vitest run src/viteBuild.test.ts src/releaseContract.test.ts`
- **Phase gate:** `pnpm --dir app vitest run` green (full suite incl. existing main.test.ts)

### Wave 0 Gaps
- [x] Both test files are new — they are the deliverable (failing-first per brief: input test and contract tests fail against current 0.8.0 state)
- [ ] None other — existing infrastructure suffices

## Security Domain

Packaging/release-pipeline hardening; no new runtime attack surface.

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V14 Configuration | yes | Reuse existing fail-loud preflight pattern; keep private-asset guards (lines 59-91) untouched; extend `validate_tauri_config` rather than adding a parallel path |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Malicious/shadowed codesign on PATH | Tampering | PATH prefix `/usr/bin:/bin:/usr/sbin:/sbin` + simulated-resolution preflight check (CONTEXT-locked) |
| Placeholder/unsigned icon in signed bundle | Tampering/Repudiation | ICNS magic-byte + non-empty checks in preflight and `verify_app()` |

## Project Constraints (from CLAUDE.md)

- Use project-local GSD install from `.claude/gsd-core`.
- Do not run the dev server.
- Tests: `vitest run` only; never watch mode.
- pnpm, not npm (monorepo).
- Prefer Preact/Signals patterns — N/A for this phase (no UI code).
- GSD artifacts in English.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Bundle-guard HTML ref extraction via targeted regex is sufficient (no full parser) | Bundle Guard | Guard misses an exotic ref form; build ships broken HTML — mitigated by guard also checking the module-script requirement and by UAT |
| A2 | Absolute `/asset` URLs in emitted index.html load correctly inside the packaged Tauri webview (matches template default of unset `base`) | Validated output shape | Packaged app shows blank window — caught by user-owned native UAT before release |
| A3 | `app-icon.png` scratch input at `app/src-tauri/app-icon.png` should remain untracked | Tauri Icon Behavior | One stray file committed — cosmetic, easily removed |

## Open Questions

1. **Should the dead `build.target: 'safari13'` be restored?** MC's `'modules'` overrides it. The probe built successfully with `'modules'`; restoring safari13 is out of the brief's scope. Recommendation: leave as-is; optionally note in a code comment.
2. **Deletion vs gitignore for non-tracked icon outputs** — CONTEXT allows either; deletion is simpler (no new .gitignore file needed).

## Sources

### Primary (HIGH confidence)
- `app/node_modules/@efxlab/motion-canvas-vite-plugin/lib/partials/projects.js` + `lib/utils.js` — input shape, config hook, key derivation (read this session)
- `app/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js` — runConfigHook merge semantics (line 66998), default input skip (65526), esbuildPlugin option snapshot (19264)
- **Empirical probe**: real production build to temp outDir with the proposed fix — succeeded, output tree verified (this session)
- `tauri icon` CLI run against real SPECS PNG — full generated file tree + ICNS magic bytes (this session)
- `app/src-tauri/icons/icon.png`, `app/dist/`, `SPECS/`, `.gitignore:36` — filesystem state (this session)

### Secondary (MEDIUM confidence)
- [CITED: raw.githubusercontent.com/tauri-apps/create-tauri-app/dev/templates/_base_/src-tauri/%(v2)%tauri.conf.json.lte] — exact 5-file `bundle.icon` array
- [CITED: v2.tauri.app/reference/config/#icon] — `bundle.icon` schema default is `[]`

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Vite/MC fix shape: HIGH — empirically validated end-to-end
- Guard hook choice: HIGH — plugin order verified in Vite source
- Icon contract: HIGH — generated and inspected this session
- Script hardening points: HIGH — file read in full this session

**Research date:** 2026-08-01
**Valid until:** 2026-08-31 (stable pinned versions; probe results are repo-state-specific)
