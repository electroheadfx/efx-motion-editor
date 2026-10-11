# Phase 53 — Signed Packaged-App UAT Evidence Record (v1.0.0)

**Plan:** 53-03 — comprehensive single signed-artifact pass (ACC-02, D-01)
**Artifact under test:** `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` (signed, notarized, stapled, v1.0.0)
**DMG:** `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_1.0.0_aarch64.dmg` (15,942,003 bytes; signed, notarized, stapled)
**Freshness (skill rule 6):** inner binary `Contents/MacOS/efx-motion-editor` mtime **Oct 11 12:09:58 2026 (local)**; `.app` dir mtime **Oct 11 12:09:58 2026 (local)** — both postdate the 53-01 six-gate run (captured 2026-10-11 10:18:43–10:21:03 local) and the credentialed wrapper run of the same day. The freshness rule is judged by inner-binary mtime only, never by `bundle/dmg/` mtime. Bundle contents: exactly one `.app` in `bundle/macos/` and exactly one `*_1.0.0_*.dmg` in `bundle/dmg/` (1 / 1); Info.plist `CFBundleShortVersionString` = `1.0.0`, `CFBundleVersion` = `1.0.0`. Notarization evidence present at `bundle/dmg/notarization-evidence/` (`dmg-log.json`, `dmg-submit.json`, 12:11 local).
**Version surfaces at 1.0.0:** `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock` (efx-motion-editor block), `scripts/macos-release.sh:10` `PRODUCT_VERSION` — all five read 1.0.0 (53-01, `releaseContract.test.ts` 11 passed).
**Oracle:** shipped English labels/values (D-01).
**Mode:** one comprehensive pass (D-01) over the full worksheet in D-04 order against this single signed bundle; a failing row is recorded and flagged per D-21, never fixed in-phase.
**Commit under test:** `0c9e7defd9e13ba9f7b782d96242e8ce9692dafb` (= `origin/HEAD` at release time)
**Date:** 2026-10-11
**Result:** PENDING — matrix pending the comprehensive pass (Task 2)

## Pass/Fail Matrix

Matrix pending the comprehensive pass (Task 2) — one row per worksheet card (same R-numbers as `53-UAT.html`), each carrying spec-step text, the shipped-English expected marker, and the live verdict.

## Hard boundaries respected

- No functional source file changed (D-21 — release-only phase).
- No Apple credential/certificate file accessed, opened, or searched (D-22 — the credentialed run was user-run via `~/.config/efx/scripts/efx-release-efx-motion`).
- No dev server started; no Vitest watch mode.
