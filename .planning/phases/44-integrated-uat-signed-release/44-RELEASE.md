# Phase 44: Signed Release Ledger (v0.9.0)

**Plan:** 44-02 — user-run credentialed release (D-04) via `efx-release-efx-motion` wrapper
**Status:** AWAITING USER RELEASE RUN
**Recorded:** 2026-08-21

## Pre-conditions (agent-verified before the user release run)

Recorded per PLAN 44-02 Task 1 agent-side steps 1-4. All checks credential-free.

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | `bash scripts/macos-release.sh preflight` passes | **PASS** | `PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards` (2026-08-21) |
| 2 | Zero stale `.app` bundles under `bundle/macos/` | **PASS** | `find app/src-tauri/target/release/bundle/macos -maxdepth 1 -name '*.app'` → empty |
| 3 | Zero stale `_0.8.1_` DMGs under `bundle/dmg/` | **PASS** | `find app/src-tauri/target/release/bundle/dmg -name '*_0.8.1_*.dmg'` → empty (v0.8.1 archived by 44-01 under `bundle/archive-v0.8.1-20260821/`) |
| 4 | Wrapper exists at `~/.config/efx/scripts/efx-release-efx-motion` | **PASS** | mode `-rwx------` (700), executable, 1570 bytes, 2026-08-01 |
| 5 | Version surfaces at 0.9.0 (from 44-01 bump) | **PASS** | `app/package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`, `scripts/macos-release.sh` all `0.9.0` |

## User release run (D-04 — the ONE credentialed step)

**Wrapper:** `~/.config/efx/scripts/efx-release-efx-motion`

User run from a terminal at the repo root. The wrapper prompts to drag the trusted Apple
environment file, sources it, validates `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`,
`APPLE_API_KEY`, `APPLE_API_KEY_PATH`, runs `bash scripts/macos-release.sh release`, then
trap-unsets every variable. Credentials never enter the repo, project files, or agent context.

Fallback if the wrapper is unavailable: the documented manual 4-export flow in
`docs/macos-signed-release.md` (also user-run).

## Release ledger (user-reported — pending)

| Ledger item | Value |
|-------------|-------|
| Local release ledger | **PENDING** |
| app notarization status | **PENDING** |
| DMG notarization status | **PENDING** |
| app stapler validation | **PENDING** |
| DMG stapler validation | **PENDING** |

## Freshness evidence (agent-verified after the user reports back — D-05, Pitfall 3)

| Artifact | Path | mtime (must be ≥ release run) |
|----------|------|-------------------------------|
| inner binary | `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app/Contents/MacOS/efx-motion-editor` | **PENDING** |
| `.app` directory | `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` | **PENDING** |
| built DMG | `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_0.9.0_aarch64.dmg` | **PENDING** (exactly one, `_0.9.0_` glob) |
| notarization evidence | `app/src-tauri/target/dmg/notarization-evidence/` | **PENDING** |

> Freshness is judged by the `.app` + inner-binary mtime, NEVER by `bundle/dmg/` timestamps
> (the DMG folder can hold stale artifacts — Pitfall 3).
