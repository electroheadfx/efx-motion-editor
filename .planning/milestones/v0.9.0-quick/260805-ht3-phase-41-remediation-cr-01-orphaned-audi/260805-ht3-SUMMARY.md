---
phase: quick-260805-ht3
plan: 1
subsystem: audio/bridge + rust-protocol
tags: [code-review-remediation, cr-01, wr-07, wr-08, efxasset, audio-ownership]
status: complete

requires:
  - phase: 41-efx-paint-audio-preview-monitoring-toggle
    provides: 41-REVIEW.md findings CR-01/WR-07/WR-08, efxPaintAudioMonitor, efxasset connect-src grant
provides:
  - Playback-session generation guard for deferred audio prepare→play (CR-01)
  - Pure efxasset byte-range resolution with 416/500 semantics, no u64 underflow (WR-07)
  - efxasset path scoping: canonical roots, component-boundary compare, symlink-escape rejection, shared media extension set (WR-08)
affects: [efx-paint-audio, efxasset-protocol, security]

tech-stack:
  added: []
  patterns: [monotonic session ref guard (plain useRef, no signals/effects), pure Rust helpers unit-tested in existing #[cfg(test)] module]

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts
    - app/src-tauri/src/lib.rs
    - app/src-tauri/src/services/project_io.rs

key-decisions:
  - CR-01 fixed hook-side only (monotonic audioSessionRef + timerRef null check); no monitor/ownership API changes
  - WR-07/WR-08 fixed Rust-side only in lib.rs; extension set shared with the existing MIME mapping, extended with the ImportedView.tsx:384 audio import set (wav/mp3/aac/flac/m4a/aif/aiff)
  - Allowed roots mirror tauri.conf.json assetProtocol.scope ($APPDATA, $RESOURCE, /Volumes, $HOME, /tmp, /private); tauri.conf.json untouched
  - Security tests use temp fixtures only; no real sensitive files read

requirements: [CR-01, WR-07, WR-08]
---

# Quick 260805-ht3: Phase 41 remediation (CR-01, WR-07, WR-08)

Bounded remediation of the three blocking-candidate findings from 41-REVIEW.md. Nothing else in scope: WR-01..06, IN-01..04, and the style-src observation remain deferred.

## Commits

| Commit | Content |
|--------|---------|
| `38f0e461` | fix(41): CR-01 guard deferred audio play behind playback session generation (RED observed → GREEN 10/10) |
| `b8396711` | fix(36.14): repair stale project_io test referencing removed MCE fields (prerequisite — blocked all cargo test compilation) |
| `54de7d9b` | fix(41): WR-07 resolve efxasset byte ranges without u64 underflow (RED observed → GREEN 8/8) |
| `b3a83841` | fix(41): WR-08 scope efxasset protocol to canonical media roots (RED observed → GREEN 10/10) |

## Gates

- Focused RED→GREEN per finding (RED failure observed in output before each fix)
- Full Vitest: 1095 passed / 1 skipped / 101 todo (97 files)
- `tsc --noEmit` (`pnpm typecheck`): clean
- Full `cargo test`: 30 passed / 0 failed
- `cargo check`: clean
- Fresh unsigned packaged build: `bundle/macos/EFX Motion Editor.app` at 2026-08-05 13:35 local; embedded asset hashes match current dist (`index-4P0L4OVs.js`, `PhysicsPaintStudio-43naB2WK.js`). Note: plain `pnpm tauri build` skipped the bundling step this run; `--bundles app` produced the bundle.

## Native UAT (packaged, 2026-08-05) — APPROVED

Combined focused re-UAT on the fresh unsigned bundle: audio Play/Stop at cursor; stop-during-prepare silence with no latched ownership (main-editor audio unaffected); ownership doubling guard + auto-resume; close release; video layer render + seek; image layer render; legitimate audio fetch passing (WR-08 scoping did not 403 user media).

## Deviations

- One out-of-finding commit (`b8396711`, Rule 3): stale pre-existing `project_io.rs` test referenced removed MCE fields and blocked the entire `cargo test` gate; repaired in place, no behavior change.
- Plain `pnpm tauri build` did not run the bundler on this tree (binary only); re-ran as `pnpm tauri build --bundles app`. Worth watching on the next release build.

## Self-Check: PASSED
