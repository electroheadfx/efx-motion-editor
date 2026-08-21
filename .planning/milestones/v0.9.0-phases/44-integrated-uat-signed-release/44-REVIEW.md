---
phase: 44-integrated-uat-signed-release
reviewed: 2026-08-21T12:50:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - app/package.json
  - app/src-tauri/Cargo.lock
  - app/src-tauri/Cargo.toml
  - app/src-tauri/tauri.conf.json
  - scripts/macos-release.sh
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-08-21T12:50:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This phase is a release/UAT phase whose only product changes are the v0.8.1 → v0.9.0 version bump across five surfaces, with app/package.json declared as the single source. The review verified:

1. **5-surface version agreement — PASSED.** All five surfaces read `0.9.0`:
   - `app/package.json:4` → `"version": "0.9.0"`
   - `app/src-tauri/Cargo.toml:3` → `version = "0.9.0"`
   - `app/src-tauri/Cargo.lock:972` → `version = "0.9.0"` (efx-motion-editor package only)
   - `app/src-tauri/tauri.conf.json:4` → `"version": "0.9.0"`
   - `scripts/macos-release.sh:10` → `PRODUCT_VERSION="0.9.0"`
2. **Cargo.lock single-line change — PASSED.** Diff shows exactly 1 insertion / 1 deletion, both on the `efx-motion-editor` package version line (line 972). No global 0.8.1 replace, no dependency drift. The other `0.8.1` entries in Cargo.lock (litemap, rav1e, webview2-com-macros, yoke, yoke-derive) are unrelated third-party crates.
3. **Release script scope — PASSED.** `git show d66feaf8` confirms `scripts/macos-release.sh` was modified only at the `PRODUCT_VERSION` line (line 10). No other functional changes.
4. **No functional source changes — PASSED.** The full phase range `7424219c^..HEAD` contains only the 5 config/version files plus `.planning/` documentation artifacts. D-09 boundary respected.
5. **Built artifacts match the script's own verification — PASSED.** The current `target/release/bundle/macos/EFX Motion Editor.app` reports `CFBundleShortVersionString = 0.9.0`, is codesigned with `flags=0x10000(runtime)` (Hardened Runtime), `Identifier=com.efxlab.motion-editor`, `TeamIdentifier=TCYJ9HH9RS`, passes `stapler validate`, and passes `spctl --assess`. The `EFX Motion Editor_0.9.0_aarch64.dmg` passes `codesign --verify`, `stapler validate`, and carries `Notarization Ticket=stapled`.

The remaining findings are robustness/forward-compatibility concerns in the release script and pre-existing configuration notes — no blockers, and no correctness defects in the version bump itself.

## Warnings

### WR-01: `codesign --entitlements :-` deprecation can silently weaken the no-entitlements check

**File:** `scripts/macos-release.sh:272`
**Issue:** `verify_no_entitlements` relies on `codesign --display --entitlements :- "$app_path"` to dump the entitlements plist to stdout. Apple already emits a deprecation warning on the current toolchain (`Specifying ':' in the path is deprecated and will not work in a future release` — observed on this machine). If a future macOS release changes this so no plist is written to stdout, the `[[ -s "$entitlements_file" ]]` guard becomes false and the function passes **vacuously** — the "app has no custom entitlements" guarantee (a load-bearing property of this release design: hardened runtime with zero entitlements) silently becomes a no-op rather than failing loudly. If the syntax instead errors, the release breaks with a non-obvious failure.
**Fix:** Write the entitlements dump to a real temp file path instead of `:-` and assert the file is a valid plist that parses to an empty dict — e.g.:
```bash
entitlements_file="$(/usr/bin/mktemp -t efx-motion-entitlements.XXXXXX)"
"$CODESIGN" --display --entitlements "$entitlements_file" "$app_path" >/dev/null 2>&1 \
  || die "Unable to extract app entitlements"
if [[ -s "$entitlements_file" ]]; then
  json="$($PLUTIL -convert json -o - "$entitlements_file" 2>/dev/null)" || { rm -f "$entitlements_file"; die "Extracted app entitlements are not a valid property list"; }
  if ! printf '%s' "$json" | "$NODE_BIN" -e 'const fs=require("node:fs"); const v=JSON.parse(fs.readFileSync(0,"utf8")); if(!v||Array.isArray(v)||typeof v!=="object"||Object.keys(v).length!==0) process.exit(1);'; then
    rm -f "$entitlements_file"; die "App signature contains unexpected entitlement keys"
  fi
fi
```

### WR-02: `worktree_private_asset_exists` scans unbounded build and worktree directories

**File:** `scripts/macos-release.sh:79-91`
**Issue:** The private-asset guard runs `find "$REPO_ROOT"` pruning only `.git` and `*/node_modules`. It does **not** prune `app/src-tauri/target/` (currently ~18 GB on this machine) or `.claude/worktrees/*` (full repo clones, e.g. `agent-a4d9eb669ea067e29` currently holds its own ~3.4 GB `target/`). Two consequences:
- Every `preflight`/`release`/`verify-downloaded` invocation walks ~21 GB of build artifacts, most of it irrelevant to the guard's purpose.
- More importantly, a **stale worktree clone** or a build-output directory that happens to contain a file matching `is_private_asset_name` (e.g. `id_rsa.*`, `*.p8`) would spuriously **block the release**, even though that file is not part of the shipped tree. The guard must restrict itself to files that could actually be committed (i.e., exclude build output and non-tracked clone dirs).
**Fix:** Prune the same paths a commit would exclude, e.g. add `-o -path '*/target' -o -path '*/.claude/worktrees' -o -path '*/.planning'` to the prune expression. For a stricter guard, compare against `git ls-files`-tracked paths plus untracked-but-not-ignored files instead of a blind filesystem walk.

## Info

### IN-01: The de-facto version source is the script's hardcoded `PRODUCT_VERSION`, not package.json

**File:** `scripts/macos-release.sh:10,94-146`
**Issue:** The phase documentation declares `app/package.json` as the single source of truth, but `validate_tauri_config` only cross-checks `tauri.conf.json.version` against the script's **hardcoded** `PRODUCT_VERSION`. It never reads `package.json` or `Cargo.toml`. If a future bump updates package.json but forgets the script line (or vice versa), the machine gate cannot detect the drift. The 44-01 plan's grep pipelines do verify all five surfaces, but those are doc-level checks, not enforced here.
**Fix:** Have `validate_tauri_config` also read `../package.json` (relative to `TAURI_DIR`) and assert `JSON.parse(...).version === productVersion`, making the declared single source actually enforced.

### IN-02: `devtools` feature shipped in the signed production app

**File:** `app/src-tauri/Cargo.toml:20`
**Issue:** `tauri = { version = "2", features = ["devtools", "protocol-asset"] }` — the `devtools` feature is compiled into the signed, hardened-runtime release. In a hardened app with `assetProtocol` scope covering `$HOME/**` and `/Volumes/**`, an attacker who can inject content into the webview could open the inspector and evaluate arbitrary JS in the app context. Pre-existing config, not introduced by this phase's diff, but relevant to a release-surface review.
**Fix:** Consider a release-only profile that drops the `devtools` feature (e.g. `[features] release = []` + `default = ["devtools"]`), or gate it behind the dev build.

### IN-03: CSP allows `'unsafe-eval'` and broad `https://*` network grants

**File:** `app/src-tauri/tauri.conf.json:38`
**Issue:** `script-src 'self' 'unsafe-eval'` combined with `connect-src ... https://*` and `img-src ... https://*` broadens the attack surface: any injected script can eval and exfiltrate to any HTTPS endpoint. This was deliberately approved and contract-tested in the v0.8.1 CSP fix (per project memory, the `img-src data:` grant is final and guarded by a contract test), so it is recorded here as an observation, not a regression. The `'unsafe-eval'` and `https://*` grants should be revisited if the app no longer needs dynamic code or remote media.
**Fix:** No action required for this phase. If future phases remove the eval/remote needs, tighten `script-src` to `'self'` and scope `connect-src`/`img-src` to the specific hosts actually used.

### IN-04: `is_private_asset_name` conservatively blocks public key files

**File:** `scripts/macos-release.sh:59-67`
**Issue:** The `id_rsa.*|id_ed25519.*` patterns match `id_rsa.pub` / `id_ed25519.pub` — **public** keys that pose no secret-leak risk. A repo containing such a file would spuriously fail preflight. This is fail-safe (blocks rather than leaks), so severity is low, but the pattern set conflates public and private keys.
**Fix:** If public-key files are expected in the repo, exclude the `.pub` suffix: `id_rsa|id_ed25519` (exact) plus `id_rsa.*|id_ed25519.*` with an explicit guard skipping names ending in `.pub`.

---

_Reviewed: 2026-08-21T12:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
