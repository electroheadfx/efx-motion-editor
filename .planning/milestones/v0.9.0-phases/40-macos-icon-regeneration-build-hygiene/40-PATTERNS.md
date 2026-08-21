# Phase 40: macOS Icon Regeneration + Build Hygiene - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 7 (5 modify/create targets + 2 conditional)
**Analogs found:** 5 / 7 (2 are CLI/evidence artifacts with no code analog by design)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/vite.config.ts` (modify — add `chunkSizeWarningLimit: 1100` + comment) | config | build-transform | itself (existing `build` block, lines 180-187) | exact (self-extension) |
| `app/src/viteBuild.test.ts` (modify — warning capture, limit assertion, chunk-separation pin) | test | build-integration | itself (existing capture-plugin + build seam, lines 52-98) | exact (self-extension) |
| `app/src/releaseContract.test.ts` (verify completeness; extend only for gaps per D-04) | test | static-contract (fs/JSON) | itself (icon contract, lines 63-72) | exact (self-extension; likely zero changes) |
| `app/src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.icns,icon.ico}` (regenerate) | generated asset | file-I/O (CLI) | none — `tauri icon` CLI output | no analog (tool-generated) |
| `.planning/phases/40-macos-icon-regeneration-build-hygiene/check-unsigned-app-icon.sh` (new, D-05; name is planner discretion) | script (shell) | batch validation | `scripts/macos-release.sh` `verify_app` icon block (lines 305-323) | partial (extract-and-eval reuse, not copy) |
| `.planning/phases/40-macos-icon-regeneration-build-hygiene/baseline-build-warnings.txt` (new, D-07) | evidence artifact | batch capture | none — raw build output | no analog (evidence, not code) |
| Triage-approved mixed-import corrections in `app/src/**` (conditional, D-08 gate) | source edit | module-graph | existing static importers of the same modules (e.g. `app/src/main.tsx`, `app/src/lib/shortcuts.ts`) | role-match |

## Pattern Assignments

### `app/vite.config.ts` (config, build-transform)

**Analog:** itself — the existing `build` block at lines 180-187 and the file's established heavy-rationale-comment convention.

**Imports pattern** — no change; the file's import block (lines 1-7) stays untouched:
```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import motionCanvasModule from '@efxlab/motion-canvas-vite-plugin';
```

**Core pattern — `build` block where the new key lands** (lines 180-187):
```typescript
  build: {
    // NOTE: motion-canvas:project's config hook contributes build.target
    // 'modules', which silently overrides this 'safari13' (plugin config-hook
    // returns win over the config file). Pre-existing behavior — left as-is.
    target: 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
```

**Comment convention to copy** — the file documents non-obvious config decisions with multi-line rationale blocks directly above the key (copy the style from lines 81-94 and 175-179):
```typescript
    // Fix: Motion Canvas excludes preact from optimizeDeps, but @preact/preset-vite
    // includes it. esbuild can't have an entry point marked as external.
```
Per D-11, the new `chunkSizeWarningLimit: 1100` gets a comment block directly above it stating: packaged Tauri desktop app loading local assets; Vite's 500 kB default is a generic web threshold; 1100 is a monitored desktop entry-bundle budget, not a performance claim; must not be raised again without measurement. **The comment wording is itself a verification target (Pitfall 5).**

**Prohibited here (spec + D-11):** no `manualChunks`, no fake lazy bootstrap imports, no warning filters.

---

### `app/src/viteBuild.test.ts` (test, build-integration)

**Analog:** itself — the existing input-capture plugin (lines 52-60) and the programmatic `build()` seam (lines 62-98).

**Imports pattern** (lines 1-15) — new assertions add `createLogger` to the existing vite import; everything else already imported:
```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build, createLogger, type Plugin } from 'vite';
```

**Core pattern 1 — capture plugin to extend for D-14** (lines 52-60; extend `captured` shape with `chunkLimit`):
```typescript
function createInputCapturePlugin(captured: { input: unknown }): Plugin {
  return {
    name: 'test-capture-rollup-input',
    enforce: 'post',
    configResolved(config) {
      captured.input = config.build.rollupOptions.input;
      // D-14 extension: captured.chunkLimit = config.build.chunkSizeWarningLimit;
    },
  };
}
```

**Core pattern 2 — programmatic build call to modify for D-12** (lines 66-75; `customLogger` REPLACES `logLevel: 'silent'` — a custom logger ignores logLevel gating for captured messages, so the wrap sees all `warn` calls):
```typescript
  beforeAll(async () => {
    outDir = makeTempDir('efx-build-');
    await build({
      root: APP_DIR,
      configFile: join(APP_DIR, 'vite.config.ts'),
      logLevel: 'silent',                       // replaced by customLogger below
      plugins: [createInputCapturePlugin(captured)],
      build: { outDir, emptyOutDir: true },     // hermetic — never touches app/dist
    });
  }, BUILD_TIMEOUT);
```

**Warning-capture wrap to add** (verified empirically in RESEARCH Pattern 1 against Vite 5.4.21 — 13/13 baseline warnings captured with full module-path text):
```typescript
const warnings: string[] = [];
const logger = createLogger();
const origWarn = logger.warn;
logger.warn = (msg, options) => {
  warnings.push(String(msg));   // capture everything; do NOT filter here
  origWarn(msg, options);       // or drop delegation to keep test output clean
};
// ...then pass `customLogger: logger` in place of `logLevel: 'silent'`.
```
Assertion shape per D-13: `expect(warnings.some(w => w.includes(correctedModulePath))).toBe(false)` — **module-path absence only**; never exact message text, never line-0 assumptions (messages are prefixed by a `[plugin:vite:reporter]` line).

**Core pattern 3 — prefix-based chunk assertion to copy for the new `PhysicsPaintStudio-*` separation pin** (lines 122-124; D-15 pins exactly two separations — `src/project-*.js` already covered here, `PhysicsPaintStudio-*.js` is the new one):
```typescript
      // The slash in the input key "src/project" relocates the bundle under src/.
      const projectBundles = collectFiles(outDir).filter((rel) => /(^|\/)project-[^/]*\.js$/.test(rel));
      expect(projectBundles.length, 'a project-*.js bundle must be emitted').toBeGreaterThan(0);
```
New assertion mirrors this with `/PhysicsPaintStudio-[^/]*\.js$/` against `collectFiles(outDir)`. Never pin content-hash filenames (`index-DiQjlua3.js`); never pin exact chunk counts.

**Test-structure conventions to preserve:**
- Generous explicit timeouts: `BUILD_TIMEOUT = 300_000` on the hook, `{ timeout: 180_000 }` per test (lines 19, 85).
- Assertion messages as second `expect` argument: `expect(x, 'reason string').toBe(...)` — used throughout.
- Hermetic output: `makeTempDir` + `afterAll` cleanup (lines 23-29, 77-81).
- Test organization inside existing `describe` blocks is planner discretion (CONTEXT.md).

---

### `app/src/releaseContract.test.ts` (test, static-contract)

**Analog:** itself — icon contract at lines 15-21 and 63-72. Research verdict: **ICON-02/ICON-03 static coverage is complete verbatim; expected outcome is zero changes (D-04: extend only if a gap is found during execution).**

**Existing icon contract (do not duplicate)** (lines 15-21, 63-72):
```typescript
const EXPECTED_ICONS = [
  'icons/32x32.png',
  'icons/128x128.png',
  'icons/128x128@2x.png',
  'icons/icon.icns',
  'icons/icon.ico',
];
```
```typescript
  it('bundle.icon names exactly the 5 desktop files, all present and non-empty, ICNS signed', () => {
    expect(tauriConfig.bundle?.icon).toEqual(EXPECTED_ICONS);
    for (const rel of EXPECTED_ICONS) {
      const filePath = join(TAURI_DIR, rel);
      expect(existsSync(filePath), `${rel} must exist`).toBe(true);
      expect(statSync(filePath).size, `${rel} must be non-empty`).toBeGreaterThan(0);
    }
    const icns = readFileSync(join(TAURI_DIR, 'icons', 'icon.icns'));
    expect(icns.subarray(0, 4).toString('ascii'), 'icon.icns must start with the icns magic bytes').toBe('icns');
  });
```

**Conventions if an extension IS needed (gap found):** pure fs/JSON/text assertions only — no build, no special timeout (header comment lines 7-8); platform-gated probes use `it.runIf(process.platform === 'darwin')` (line 98). Build-dependent assertions belong in `viteBuild.test.ts`, never here — keep the established split.

---

### `app/src-tauri/icons/*` (generated asset — CLI pattern, no code analog)

**Analog:** none in-repo code; the pattern is the verified CLI sequence from RESEARCH Pattern 3 (ran clean this session against `@tauri-apps/cli` 2.10.x):

```bash
# Run from app/ — staging dir keeps the ~45 extras (Square logos, StoreLogo,
# 64x64.png, icon.png, ios/, android/) out of the tracked tree:
cd app && pnpm tauri icon ../SPECS/efxmotioneditor-icon-2.png -o /tmp/efx-icons-staging
cp /tmp/efx-icons-staging/{32x32.png,128x128.png,128x128@2x.png,icon.icns,icon.ico} src-tauri/icons/
```

**Guard (Pitfall 1):** the exact-5-file contract is pinned by `releaseContract.test.ts:64` + `tauri.conf.json:14-20`, but the test only checks the declared 5 — the real guard is `git status app/src-tauri/icons/` showing exactly 5 modified, 0 untracked. Staging (`-o`) is preferred over default output + deletion: zero risk of deleting a tracked file or leaving an extra.

---

### D-05 phase check script (new shell script in phase dir)

**Analog:** `scripts/macos-release.sh` — but **extract-and-eval, never copy and never source**.

**Source pattern being reused** (`scripts/macos-release.sh:305-323`, the Info.plist/icon block inside `verify_app`):
```bash
  # Info.plist metadata: the packaged app must report the release version and
  # ship a real icon (v0.8.0 shipped the template placeholder — T-jun-02).
  local info_plist="$app_path/Contents/Info.plist"
  [[ -f "$info_plist" ]] || die "App bundle is missing Contents/Info.plist"
  local short_version bundle_version icon_file
  short_version="$("$PLUTIL" -extract CFBundleShortVersionString raw -o - "$info_plist" 2>/dev/null)" \
    || die "Info.plist is missing CFBundleShortVersionString"
  # ... version equality check ...
  icon_file="$("$PLUTIL" -extract CFBundleIconFile raw -o - "$info_plist" 2>/dev/null)" \
    || die "Info.plist is missing CFBundleIconFile"
  [[ -n "$icon_file" ]] || die "Info.plist CFBundleIconFile is empty"
  local bundled_icon="$app_path/Contents/Resources/$icon_file"
  [[ -s "$bundled_icon" ]] || die "Bundled icon is missing or empty: Contents/Resources/$icon_file"
  [[ "$(/usr/bin/head -c 4 "$bundled_icon")" == "icns" ]] \
    || die "Bundled icon does not start with the icns magic bytes: Contents/Resources/$icon_file"
```

**Reuse mechanic** (RESEARCH Pattern 4, Claude's-discretion area): the check script extracts these exact lines from `macos-release.sh` at check time (e.g. `sed -n '/Info.plist metadata: the packaged app/,/icns magic bytes/p'`) and evaluates them inside a function providing `$PLUTIL` (`/usr/bin/plutil`, defined at script line 21) and a local `die` (pattern at script lines 32-35):
```bash
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}
```

**Hard constraints:**
- **Never `source scripts/macos-release.sh`** — the file ends with an unconditional `main "$@"` (no source guard); sourcing executes the full signed-release CLI.
- **Never run all of `verify_app`** — it also runs `codesign --verify`, `spctl --assess`, `xcrun stapler validate` (lines 294-328), which fail by design on the unsigned UAT bundle. Only the Info.plist/bundled-icon portion is in scope.
- **Never edit `scripts/macos-release.sh`** (D-06); the existing releaseContract grep-pins (lines 74-94 of the test) detect accidental edits.
- Target bundle path: `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` — must be the FRESH D-06 build (check mtime; the current bundle is stale, dated 2026-08-01).
- The version-equality line (`CFBundleShortVersionString == $PRODUCT_VERSION`) is part of the extracted block; the check script must supply `PRODUCT_VERSION` matching the current `app/package.json` version or narrow the extraction to the icon lines only — planner decision.

---

### Triage-approved mixed-import corrections (conditional source edits, D-08 gate)

**Analog:** the existing static importers of each warned module — the correction converts a dynamic `await import(...)` to a top-level static import matching how the module is already imported elsewhere. Full 12-warning inventory with dynamic/static import sites is in RESEARCH "Mixed-import baseline inventory" (Code Examples section).

**Representative analog — static import style in `app/src/main.tsx` / `app/src/lib/shortcuts.ts`:** candidate-fix modules (`appConfig.ts`, `unsavedGuard.ts`, `themeManager.ts`, `paintPreferences.ts`) already have multiple static importers; the corrected file adopts the same plain top-level `import { x } from '../lib/y'` form used by those importers.

**Guardrails (D-08/D-09 — these ARE the pattern here):**
- No edit happens before the executor presents per-case evidence (eager import proven, no cycle created, no init-timing change) and the user approves.
- Default is preserve-with-reason. Store-to-store dynamic imports (`paintStore.ts` → `timelineStore.ts`/`layerStore.ts` at lines 478-479, 545-546) are presumed cycle-breakers until proven otherwise (Pitfall 3).
- Tauri/browser runtime-guard dynamic imports (warnings #1-#4, #8) are expected preserves per the spec.
- DI cases are reported, not fixed (D-10).

---

## Shared Patterns

### Vitest test conventions (applies to both test files)
**Source:** `app/src/viteBuild.test.ts` + `app/src/releaseContract.test.ts`
**Apply to:** all test modifications
- Run via `pnpm --dir app exec vitest run` — never watch mode (CLAUDE.md).
- No new test config, no one-off setup files (MEMORY: "No test config hacks").
- Descriptive assertion messages as second `expect` argument.
- Platform-specific live probes gated with `it.runIf(process.platform === 'darwin')` (`releaseContract.test.ts:98`).

### Release-change guard pattern (v0.8.1 precedent)
**Source:** `app/src/releaseContract.test.ts` (CSP contract at lines 107-132 shipped with the v0.8.1 CSP grant)
**Apply to:** the `chunkSizeWarningLimit: 1100` config change — every release-affecting config change ships with a contract/build-seam assertion pinning it (here: the D-14 resolved-limit assertion in `viteBuild.test.ts`).

### Evidence capture
**Source:** D-07 + RESEARCH baseline (`/tmp/efx-phase40-baseline-build.txt` from the research session)
**Apply to:** `baseline-build-warnings.txt` — executor re-runs `pnpm --dir app build` and saves raw output to the phase dir as before/after triage evidence. Executor must NOT reuse the researcher's `/tmp` file; it re-captures per D-07.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/src-tauri/icons/*` (5 regenerated files) | generated asset | file-I/O | Output of `tauri icon` CLI; no hand-written analog exists or should exist (D-02 forbids hand-rolled image pipelines). Use the verified CLI sequence above. |
| `baseline-build-warnings.txt` | evidence artifact | batch capture | Raw command output saved verbatim; not code. |

## Metadata

**Analog search scope:** `app/src/releaseContract.test.ts`, `app/src/viteBuild.test.ts`, `app/vite.config.ts`, `scripts/macos-release.sh` (read verbatim); `.claude/skills/` + `.agents/skills/` listed (generic workflow skills only — no phase-relevant skill; no component/Preact work in this phase)
**Files scanned:** 4 source files read in full + 2 targeted reads of `macos-release.sh`
**Pattern extraction date:** 2026-08-04
