---
phase: quick-261013-ctd
plan: 261013-ctd
subsystem: export
tags: [ffmpeg, mux, shortest, audio, export, rust, tdd, exp-01]

# Dependency graph
requires:
  - phase: quick-261012-exn
    provides: audioExportMixer pre-scan + duration pad (totalDurationSec + 0.5)
provides:
  - "Pure encode_video_args argv builder in app/src-tauri/src/services/ffmpeg.rs (single source of output options)"
  - "Mux-truncation output option (-shortest) on the audio arm so container stream durations match the shorter one (EXP-01)"
  - "Source-scan pin that the mixer anti-cut-off duration pad stays internal"
  - "EXP-01 requirement row in .planning/REQUIREMENTS.md"
affects: [export, ffmpeg, audioExportMixer, v1.0.1-release]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 3316
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure argv builder extract (encode_video_args) so output options have one call site and are unit-testable without spawning ffmpeg"

key-files:
  created: []
  modified:
    - app/src-tauri/src/services/ffmpeg.rs
    - app/src/lib/audioExportMixer.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Option 2 only: truncate at mux time via -shortest; the mixer's anti-cut-off duration pad stays internal and audioExportMixer.ts is byte-untouched"
  - "Mux-truncation option lives only in encode_video_args' audio arm; the None arm keeps -an and omits -shortest (video-only encode unchanged)"
  - "GREEN commit type is fix(...) per the plan's locked commit style (EXP-01 is a bug fix), not feat(...)"

patterns-established:
  - "encode_video_args is the single pure argv builder encode_video consumes — the mux-truncation pin lives there, never in a second call site"

requirements-completed: [EXP-01]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "encode_video_args audio arm carries the mux-truncation output option (-shortest) plus the map/codec args; video-only arm keeps -an and omits it"
    requirement: "EXP-01"
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/ffmpeg.rs#encode_video_args_audio_h264_carries_shortest_and_maps"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/ffmpeg.rs#encode_video_args_audio_prores_carries_shortest_and_pcm"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/ffmpeg.rs#encode_video_args_no_audio_keeps_an_and_omits_shortest"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/ffmpeg.rs#encode_video_args_unknown_codec_errors"
        status: pass
    human_judgment: false
  - id: D2
    description: "Short export with audio — ffprobe confirms container audio duration == video duration (the shorter one); no player divergence on the tail frame"
    requirement: "EXP-01"
    verification: []
    human_judgment: true
    rationale: "Native ffprobe/player judgment on a real export is the acceptance row; the executor does not run the server or perform live UAT"

# Metrics
duration: 7min
completed: 2026-10-13
status: complete
plan_head_before: cec011cf22f35d885a3c333dc4dd7f4c37a22c23
plan_head_after: c27b94281fe6a9bbaac5377ea89462385c33a3d5
commits: 2
---

# Quick 261013-ctd: Export Mux Duration Law Summary

**ffmpeg encode argv now carries `-shortest` on the audio arm so the exported container's audio and video streams end at the shorter length — closing the Preview vs VLC/QuickTime tail divergence while keeping the mixer's anti-cut-off pad internal.**

## Performance

- **Duration:** 7 min
- **Tasks:** 2/2
- **Commits:** 2 (RED `0c234cc6`, GREEN `c27b9428`)

## Accomplishments

- Extracted a pure `encode_video_args(...) -> Result<Vec<String>, String>` in `app/src-tauri/src/services/ffmpeg.rs` — `encode_video` now builds `Command::new(&ffmpeg)` from that vec (behavior-identical spawn/output/error body).
- Added `-shortest` (mux-truncation output option) in the audio arm only, beside the map/codec args and before `output_path`, so the longer stream is cut at mux time (EXP-01).
- Pinned four argv legs (h264+audio, prores+audio, no-audio non-regression, unknown-codec fail-closed) plus a green-at-birth source-scan pin that `audioExportMixer.ts` keeps `totalDurationSec + 0.5`.
- Added EXP-01 to `.planning/REQUIREMENTS.md` (checklist, traceability `Quick 5 | Pending`, coverage 12/12, footer).

## TDD Gate Compliance

- **RED commit present:** `0c234cc6 test(261013-ctd): RED — pin ffmpeg mux args carry -shortest (EXP-01)` — matches `^test(261013-ctd):`.
- **GREEN commit present:** `c27b9428 fix(261013-ctd): ffmpeg mux truncates at the shorter stream (EXP-01)`.
- **Note on GREEN type:** the generic TDD gate table lists `feat(...)` for GREEN, but this plan's locked commit style (and `<output>`) names `fix(...)` because EXP-01 is a bug fix, not a new feature. The RED→GREEN ordering holds and both legs flipped green with zero Task 1 assertion edits.
- **RED evidence:** `RED_EVIDENCE_OK` (`target_test_failed`) via `gsd_run check tdd-red-evidence`. cargo libtest has no TAP reporter in this repo, so a faithful parser adapter mapped the real libtest `ok`/`FAILED` lines to TAP (4 tests, 2 pass, 2 fail); raw cargo text preserved at `/tmp/ctd-cargo-red-full.txt` and the record at `.planning/quick/261013-ctd-261013-export-mux-duration-law-pick-fix-/red-evidence-task1.json`. Semantic assessment: target `encode_video_args_audio_h264_carries_shortest_and_maps` failed on the planned mux-truncation assertion; sister RED leg failed on the same omission; legs (c)/(d) passed; no syntax/collection/fixture faults.

## Deviations from Plan

None — plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None — the new surface is exactly the plan's T-261013-CTD-01 mitigation (mux-length policy on an already app-produced WAV path); no new endpoints, auth paths, file-access patterns, or schema changes.

## Verification

- `cargo test --manifest-path app/src-tauri/Cargo.toml encode_video --lib` — 4 passed / 0 failed (GREEN).
- `pnpm --filter efx-motion-editor exec vitest run src/lib/audioExportMixer.test.ts` — 7 passed (6 existing byte-untouched + 1 new pad-stay pin).
- Guardrails: `git diff app/src/lib/audioExportMixer.ts app/src/lib/exportEngine.ts app/src-tauri/src/commands/export.rs` empty; 53.1 frame-model files, version surfaces, exportRenderer/previewRenderer untouched; no version bump.

### Native UAT (user-owned, status = automated-ready)

| # | Case | Pass condition | Status |
|---|------|----------------|--------|
| 1 | Short export with audio, ffprobe | container audio duration == video duration (the shorter one); no player divergence on the tail frame | PENDING |

After UAT pass: this quick is non-blocking for the v1.0.1 release (53.1 frame-model UAT remains the only release gate).

## Decisions Made

- Option 2 only (mux-time truncation). The mixer pad stays as anti-cut-off safety; dropping it was explicitly out of scope.
- `-shortest` is spelled in its short form and lives with the other output options before `output_path`, only on the `audio_path = Some` arm.

## Self-Check: PASSED

- FOUND: `app/src-tauri/src/services/ffmpeg.rs`
- FOUND: `app/src/lib/audioExportMixer.test.ts`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: commit `0c234cc6` (RED)
- FOUND: commit `c27b9428` (GREEN)
