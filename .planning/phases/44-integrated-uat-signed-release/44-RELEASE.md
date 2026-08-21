# Phase 44: Signed Release Ledger (v0.9.0)

**Plan:** 44-02 — user-run credentialed release (D-04) via `efx-release-efx-motion` wrapper
**Status:** RELEASE PASS RECORDED (user-reported ledger + agent-verified freshness/notarization evidence)
**Recorded:** 2026-08-21
**Release run:** 2026-08-21 (user terminal, repo root)

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

## Release ledger (user-reported — RECORDED 2026-08-21)

The user ran `~/.config/efx/scripts/efx-release-efx-motion` from a terminal at the repo root and
reported the wrapper output verbatim. The wrapper sourced the trusted Apple environment file,
validated the four credential vars, ran `bash scripts/macos-release.sh release`, and trap-unset
every variable on exit. Credentials never entered the repo, project files, or agent context.

| Ledger item | Value |
|-------------|-------|
| Local release ledger | **RELEASE PASS** |
| app notarization status | **Accepted** (`source=Notarized Developer ID`) |
| DMG notarization status | **Accepted** (`source=Notarized Developer ID`) |
| app stapler validation | **PASS** |
| DMG stapler validation | **PASS** |

User-reported output (verbatim):

```
The validate action worked!
/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_0.9.0_aarch64.dmg: accepted
source=Notarized Developer ID
RELEASE PASS
- app: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app
- dmg: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_0.9.0_aarch64.dmg
- app signature, Developer ID team, Hardened Runtime, no-custom-entitlements, Gatekeeper, and stapler checks passed
- DMG integrity, signature, Developer ID team, notarization, stapler, and Gatekeeper checks passed
```

## Freshness evidence (agent-verified after the user reported back — D-05, Pitfall 3)

| Artifact | Path | mtime (must be ≥ release run) |
|----------|------|-------------------------------|
| inner binary | `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app/Contents/MacOS/efx-motion-editor` | **Aug 21 12:30:58 2026** — fresh, postdates release run |
| `.app` directory | `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` | **Aug 21 12:30:57 2026** — fresh, postdates release run |
| built DMG | `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_0.9.0_aarch64.dmg` | **Aug 21 12:32 2026** — exactly one `_0.9.0_` DMG (15.7 MB); `_0.8.1_` glob empty |
| notarization evidence | `app/src-tauri/target/release/bundle/dmg/notarization-evidence/` | **Aug 21 12:32 2026** — `dmg-log.json` + `dmg-submit.json` present |

> Freshness is judged by the `.app` + inner-binary mtime, NEVER by `bundle/dmg/` timestamps
> (the DMG folder can hold stale artifacts — Pitfall 3).

### Notarization evidence (agent-verified)

- `dmg-log.json`: `status` **Accepted**, `statusSummary` **Ready for distribution**, `statusCode` **0**,
  `archiveFilename` `EFX Motion Editor_0.9.0_aarch64.dmg`, `uploadDate` `2026-08-21T10:32:03.903Z`,
  `sha256` `71ea46c3f183e872469761737761ed5413b8a27b7cba897f7e4e03ea90b8e076`, `issues` null.
- `dmg-submit.json`: `status` **Accepted**, `id` `2b2a37f1-108f-4daa-8be6-02322fe63d61`.

> **Path discrepancy (noted, not a defect):** the plan and RESEARCH.md state the evidence lives at
> `app/src-tauri/target/dmg/notarization-evidence/`; the actual evidence is at
> `app/src-tauri/target/release/bundle/dmg/notarization-evidence/` (the release script writes it
> beside the built DMG). The evidence exists and is complete — only the documented path differs.
