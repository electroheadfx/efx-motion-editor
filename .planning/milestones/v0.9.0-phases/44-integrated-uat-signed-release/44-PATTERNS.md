# Phase 44: Integrated UAT + Signed Release - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 8 (5 version surfaces to bump + 2 existing gate seams + 1 release doc)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/package.json` | config | config (single source of truth) | `releaseContract.test.ts:53` (single-source contract) | exact |
| `app/src-tauri/tauri.conf.json` | config | config | `validate_tauri_config` in `scripts/macos-release.sh:93-118` + `releaseContract.test.ts:24,55` | exact |
| `app/src-tauri/Cargo.toml` | config | config | `cargoTomlPackageVersion()` in `releaseContract.test.ts:33-36,56` | exact |
| `app/src-tauri/Cargo.lock` | config | config | `cargoLockPackageVersion()` in `releaseContract.test.ts:38-41,57` | exact |
| `scripts/macos-release.sh` (line 10) | release pipeline | config | `scriptProductVersion()` in `releaseContract.test.ts:43-45,60` | exact |
| `app/src/releaseContract.test.ts` | test (verification gate) | verification | itself — re-run after bump, no edit | n/a (unchanged) |
| `app/src/viteBuild.test.ts` | test (verification gate) | verification | itself — re-run, no edit | n/a (unchanged) |
| `scripts/macos-release.sh` (full) | release pipeline | batch (release modes) | reused as-is; never modify | n/a (read-only) |
| `docs/macos-signed-release.md` | docs | reference | reuse planned sequence verbatim | n/a (read-only) |

## Pattern Assignments

### `app/package.json` (config, config) — the single source

**Purpose:** `package.json` is the single source of truth (`version: "0.8.1"`). Every other surface must agree. The bump touches `"version": "0.8.1"` → `"0.9.0"` on line 4.

**Contract that enforces it:** `app/src/releaseContract.test.ts:53-61` — the test reads `packageJson.version` as `expected` and asserts all four other surfaces equal it. **This is the analog for the whole bump.** It is the proof the 5 surfaces stay in lockstep.

```typescript
// app/src/releaseContract.test.ts:52-61
describe('release contract', () => {
  it('all product-owned version surfaces agree with app/package.json (single source)', () => {
    const expected = packageJson.version;
    expect(tauriConfig.version, 'tauri.conf.json version').toBe(expected);
    expect(cargoTomlPackageVersion(cargoToml), 'Cargo.toml package version').toBe(expected);
    expect(cargoLockPackageVersion(cargoLock, 'efx-motion-editor'), 'Cargo.lock efx-motion-editor version').toBe(expected);
    expect(scriptProductVersion(script), 'PRODUCT_VERSION in scripts/macos-release.sh').toBe(expected);
  });
```

**Execution pattern (the bump):** edit the single line in each of the 5 files to `0.9.0`, then immediately re-run `pnpm --dir app exec vitest run app/src/releaseContract.test.ts` — it will pass only when all five agree. Do not re-run any other gate until this green (Pitfall 8: run compile-proof gates after the contract-stable code).

---

### `app/src-tauri/tauri.conf.json` (config, config)

**Purpose:** `"version": "0.8.1"` on line 4 must become `"0.9.0"`. The other config keys are contract-locked and must NOT change (the script's `validate_tauri_config` rejects drift).

**Validation analog — `scripts/macos-release.sh:93-118` (the canonical tauri.conf.json guard):**

```bash
# scripts/macos-release.sh:104-110  (abridged)
if (config.productName !== 'EFX Motion Editor') fail('productName must be EFX Motion Editor');
if (config.version !== productVersion) fail(`version must equal PRODUCT_VERSION (${productVersion})`);
if (config.identifier !== 'com.efxlab.motion-editor') fail('identifier must be com.efxlab.motion-editor');
if (config.build?.beforeBuildCommand !== 'pnpm build') fail("build.beforeBuildCommand must be 'pnpm build'");
if (config.build?.frontendDist !== '../dist') fail("build.frontendDist must be '../dist'");
if (config.bundle?.macOS?.hardenedRuntime !== true) fail('bundle.macOS.hardenedRuntime must be true');
```

Do not touch `bundle.icon` (5 files, lines 14-20), `csp` (line 38), `identifier` (line 5), `productName` (line 3) — all are separately contract-pinned by `releaseContract.test.ts:63-162`.

---

### `app/src-tauri/Cargo.toml` + `app/src-tauri/Cargo.lock` (config, config)

**Purpose:** `Cargo.toml:3` `version = "0.8.1"` and `Cargo.lock:972` `version = "0.8.1"` (under `[[package]] name = "efx-motion-editor"`) both become `"0.9.0"`. Cargo.toml is the human-written source; Cargo.lock mirrors it for the root package. Both must change in the same commit as package.json or the contract test fails.

**Contract extraction helpers (`app/src/releaseContract.test.ts:33-41`) — the exact parse the gate uses:**

```typescript
// app/src/releaseContract.test.ts:33-41
function cargoTomlPackageVersion(toml: string): string | undefined {
  const packageSection = toml.match(/^\[package\]\n([\s\S]*?)(?=^\[|\s*$(?![\s\S]))/m);
  return packageSection?.[1].match(/^version = "([^"]+)"/m)?.[1];
}
function cargoLockPackageVersion(lock: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return lock.match(new RegExp(`\\[\\[package\\]\\]\\nname = "${escaped}"\\nversion = "([^"]+)"`))?.[1];
}
```

The `Cargo.lock` change is line 972 only (the root `efx-motion-editor` package); all transitive dependency versions must stay untouched.

---

### `scripts/macos-release.sh` line 10 (`PRODUCT_VERSION`) (release pipeline, config)

**Purpose:** `PRODUCT_VERSION="0.8.1"` on line 10 must become `"0.9.0"`. This is the ONLY permitted modification to this file in the whole phase. The script is otherwise frozen (`REQUIREMENTS`: "Must remain unaltered"). `PRODUCT_VERSION` is interpolated by the DMG artifact glob (`:350` `*_${PRODUCT_VERSION}_*.dmg`), the `validate_tauri_config` version check (`:105`), and the Info.plist `CFBundleShortVersionString` check (`:312`).

**Contract assertion (`app/src/releaseContract.test.ts:43-45,60,74-86`) — also proves the script keeps NO hardcoded version:**

```typescript
// app/src/releaseContract.test.ts:43-45
function scriptProductVersion(text: string): string | undefined {
  return text.match(/^PRODUCT_VERSION="([^"]+)"/m)?.[1];
}
// line 60:
expect(scriptProductVersion(script), 'PRODUCT_VERSION in scripts/macos-release.sh').toBe(expected);
// lines 74-86 — the script must interpolate, never pin:
expect(script).toContain('_${PRODUCT_VERSION}_');
const validateBody = script.slice(script.indexOf('validate_tauri_config() {'), script.indexOf('run_preflight() {'));
expect(validateBody).not.toMatch(/config\.version\s*!==\s*'\d/);
expect(validateBody).toContain('"$PRODUCT_VERSION"');
```

**Auth/guard pattern (relies on system-first PATH — proven by `releaseContract.test.ts:88-104`):**
```typescript
// app/src/releaseContract.test.ts:91,98-103
expect(script).toMatch(/PATH="\/usr\/bin:\/bin:\/usr\/sbin:\/sbin:\$PATH" "\$PNPM_BIN" --dir/);
// live probe (darwin only):
const resolved = execSync('PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign', { shell: '/bin/bash', encoding: 'utf8' }).trim();
expect(resolved).toBe('/usr/bin/codesign');
```

**Stale-artifact pitfall (Pitfall 2):** the script's `find_release_artifacts` (`:341-357`) is exactly-one-or-fatal. Before the credentialed run, archive/remove `app/src-tauri/target/**/release/bundle/*` outputs so only one `.app` and one `*_0.9.0_*.dmg` exist. Judge freshness by `bundle/macos/EFX Motion Editor.app` + inner-binary timestamps, never `bundle/dmg/` (D-05, Pitfall 3).

---

### `app/src/releaseContract.test.ts` + `app/src/viteBuild.test.ts` (test / verification gate)

**Purpose:** Existing seams, NO code changes in this phase (A5). They are re-run as gates. Pattern = `describe`/`expect` blocks using pure fs/JSON/text reads (release contract) and a real hermetic production Vite build (viteBuild). Both are the verification analog for the release version surfaces.

**Release-contract run pattern (quick subset):**
```bash
pnpm --dir app exec vitest run app/src/releaseContract.test.ts app/src/viteBuild.test.ts
```

**Build-gate pattern (`app/src/viteBuild.test.ts:117-140`) — hermetic build + resolved budget:**
```typescript
// app/src/viteBuild.test.ts:88-109  (beforeAll runs a real build to a temp dir)
await build({ root: APP_DIR, configFile: join(APP_DIR, 'vite.config.ts'), customLogger: logger, plugins: [createInputCapturePlugin(captured)], build: { outDir, emptyOutDir: true } });
// line 138 — chunk budget is an implementation contract, gated on actual 1120 (Pitfall 6):
expect(captured.chunkLimit, 'chunkSizeWarningLimit must resolve to the documented 1120 desktop budget').toBe(1120);
```

**Gate-order pattern (Pitfall 8):** re-run all six REL-01 gates (D-03) in exact order AFTER the version bump lands, capturing each exit status — so the compile-proof gates (typecheck/build/cargo test) run against the contract-stable 0.9.0 code, not stale 0.8.1.

---

### `scripts/macos-release.sh` (read-only) + `docs/macos-signed-release.md` (read-only)

**Purpose:** Reuse verbatim, do not modify. The three modes (`preflight`/`release`/`verify-downloaded`, `main` at `:460-482`) and the release doc's planned sequence (preflight → release → verify-downloaded → install/launch → publish Latest) are the proven v0.8.1 execution analog the planner reuses.

**Mode dispatch pattern (`scripts/macos-release.sh:460-482`):**
```bash
main() {
  local mode="${1:-}"
  case "$mode" in
    preflight)         [[ "$#" -eq 1 ]] || { usage >&2; exit 2; } ; run_preflight ;;
    release)           [[ "$#" -eq 1 ]] || { usage >&2; exit 2; } ; run_release ;;
    verify-downloaded) shift ; run_verify_downloaded "$@" ;;
    *) usage >&2 ; exit 2 ;;
  esac
}
main "$@"
```

**Credential-boundary pattern (`docs/macos-signed-release.md` / RESEARCH Pattern 1):** the user-owned `efx-release-efx-motion` wrapper (outside repo, mode 700) sources the trusted env file, validates the 4 vars, runs `bash scripts/macos-release.sh release`, then `trap cleanup EXIT INT TERM` unsets them. The agent never holds credentials (D-04).

---

## Shared Patterns

### 1. Single-source version agreement
**Source:** `app/src/releaseContract.test.ts:53-61`
**Apply to:** the 5-surface bump (any change to any surface must be mirrored on all 5, in one commit).
```typescript
const expected = packageJson.version;                     // app/package.json is the oracle
expect(tauriConfig.version).toBe(expected);               // tauri.conf.json
expect(cargoTomlPackageVersion(cargoToml)).toBe(expected);   // Cargo.toml
expect(cargoLockPackageVersion(cargoLock, 'efx-motion-editor')).toBe(expected); // Cargo.lock
expect(scriptProductVersion(script)).toBe(expected);      // scripts/macos-release.sh:10
```

### 2. Release gate-run pattern (D-03) — exact six commands, in order, capture exit status:
```bash
pnpm --dir app exec vitest run
pnpm --dir app run typecheck
pnpm build
cargo test --manifest-path app/src-tauri/Cargo.toml
bash -n scripts/macos-release.sh
bash scripts/macos-release.sh preflight
```
Run only AFTER the bump (Pitfall 8 - contract change must precede compile-proof gates).

### 3. Tauri config guard pattern (Node side)
**Source:** `scripts/macos-release.sh:93-146`
**Apply to:** any edit to `tauri.conf.json` — the bump touches `version` only; the guard fails on any other drift.

### 4. Release ledger evidence contract
**Source:** `docs/macos-signed-release.md` (RESEARCH evidence ledger shape)
**Apply to:** gate evidence capture — every gate exit status recorded explicitly, plus `RELEASE PASS` / `DOWNLOADED ARTIFACT PASS` user-reported ledgers. Never assume "exit 0" without recording it.

## No Analog Found

None — every in-scope file has a direct in-repo analog, because this is a release-only phase with zero new code. The version bump reuses `releaseContract.test.ts` as its enforcement analog; the release pipeline (`scripts/macos-release.sh`) is its own proven analog, reused as-is.

## Metadata

**Analog search scope:** `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock`, `app/src/releaseContract.test.ts`, `app/src/viteBuild.test.ts`, `scripts/macos-release.sh`, `docs/macos-signed-release.md`
**Files scanned:** 8 (all in-scope surfaces read)
**Pattern extraction date:** 2026-08-21
